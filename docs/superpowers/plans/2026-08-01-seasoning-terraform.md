# Seasoning Terraform Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `terraform/` module that provisions all AWS infrastructure for Seasoning Stock — Cognito (admin-create-only User Pool + SPA client), DynamoDB (single-table), Lambda (packaging the already-built `backend/`), API Gateway (REST API with a Cognito Authorizer, CORS on every path including errors), and S3 + CloudFront (static frontend hosting) — matching `調味料管理アプリ設計書.md` §2/§4/§6/§7 and the already-implemented `backend/src/handler.ts` / `backend/src/auth/getUserId.ts`.

**Architecture:** One flat Terraform root module (per the design doc's "Terraformはモジュール化しすぎない"), one file per AWS service area. **Critical compatibility constraint:** `backend/src/auth/getUserId.ts` reads `event.requestContext.authorizer.claims.sub` — this is the **REST API (v1) + `COGNITO_USER_POOLS` authorizer** event shape, NOT the HTTP API (v2) JWT-authorizer shape (`event.requestContext.authorizer.jwt.claims`). This plan therefore provisions `aws_api_gateway_rest_api` (API Gateway v1/REST), never `aws_apigatewayv2_api`. Getting this wrong would silently break every authenticated request.

**Verification model (different from the backend plan):** Terraform resource declarations aren't unit-testable pre-apply the way TypeScript functions are — there's no meaningful "red test" for an HCL resource block. Each task's verification is `terraform fmt -check` (formatting) + `terraform validate` (internal consistency — attribute types, resource references, required arguments — checked against provider schemas from `terraform init`, without calling AWS). **This plan does not run `terraform plan` or `terraform apply`.** Those require live AWS credentials (this session's are expired) and create real, billable AWS resources — an irreversible-ish, cost-incurring action that needs the user's own authenticated session and explicit go-ahead, done outside this task sequence.

**Tech Stack:** Terraform >= 1.5.0, `hashicorp/aws` ~> 6.0 (current major as of 2026-08; confirmed via the Terraform Registry), `hashicorp/archive` ~> 2.4 (zips the Lambda package).

**Packaging decision:** AWS Lambda's `nodejs22.x` managed runtime bundles the AWS SDK for JavaScript v3 (including `@aws-sdk/client-dynamodb` and `@aws-sdk/lib-dynamodb`), so the deployment zip only needs `backend/dist/**/*.js` (tsc output) plus the one dependency the runtime does *not* provide: `ulid`. Task 4 extends `backend/package.json`'s `build` script to copy `node_modules/ulid` into `dist/node_modules/ulid` after compiling, so `archive_file` can zip `backend/dist` as a single self-contained directory. This avoids a `null_resource`/`local-exec` build-during-apply step (a common Terraform anti-pattern) — building is a documented manual prerequisite (`cd backend && npm ci && npm run build`) before a real `terraform apply`, not something this plan's Terraform code executes itself.

**CORS decision:** `var.allowed_origin` is a plain variable (default `http://localhost:5173`), not dynamically wired to the CloudFront distribution's domain name. This matches the design doc's literal wording ("許可オリジンの切替: Terraform変数で管理") and avoids a two-phase-apply UX. For a real production deploy: apply once, read the `cloudfront_domain_name` output, then re-apply with `-var="allowed_origin=https://<that-domain>"`.

**State:** Local `terraform.tfstate` (gitignored) — no remote backend. This is a single-developer personal project; a remote backend (S3 + lock table) is explicitly out of scope for this plan (YAGNI) and can be added later without changing any resource blocks.

**Out of scope for this plan:** `terraform plan`/`apply` execution, a remote state backend, custom domain names / ACM certificates (CloudFront uses its default certificate), the frontend application itself (separate plan).

---

## File Structure

```
terraform/
├── main.tf              # terraform{} block, provider "aws", locals (name_prefix, common_tags), data.aws_caller_identity
├── variables.tf          # project_name, environment, aws_region, allowed_origin
├── dynamodb.tf            # aws_dynamodb_table.seasonings
├── cognito.tf              # aws_cognito_user_pool.this, aws_cognito_user_pool_client.frontend
├── iam.tf                  # aws_iam_role.lambda_exec + basic-execution attachment + scoped DynamoDB policy
├── lambda.tf                # data.archive_file.backend, aws_lambda_function.api
├── api_gateway.tf            # REST API, resources, Cognito authorizer, 4 methods+integrations, Lambda permission,
│                              # CORS OPTIONS (for_each), gateway responses, deployment + stage
├── s3.tf                    # aws_s3_bucket.frontend, public access block, bucket policy (CloudFront OAC only)
├── cloudfront.tf              # aws_cloudfront_origin_access_control, aws_cloudfront_distribution
├── outputs.tf                # api_invoke_url, cognito ids, cloudfront_domain_name, s3_bucket_name, dynamodb_table_name
└── .gitignore                # .terraform/, *.tfstate*, build/ (zip output) — .terraform.lock.hcl IS committed
```

Also modifies (in Task 4): `backend/package.json` (`build` script).

---

## Task 0: Scaffolding

**Files:**
- Create: `terraform/main.tf`
- Create: `terraform/variables.tf`
- Create: `terraform/.gitignore`

- [ ] **Step 1: Write the Terraform/provider block and locals**

`terraform/main.tf`:
```hcl
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}

locals {
  name_prefix = "${var.project_name}-${var.environment}"

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
```

- [ ] **Step 2: Write the shared variables**

`terraform/variables.tf`:
```hcl
variable "project_name" {
  description = "Short project name used as a resource name prefix"
  type        = string
  default     = "seasoning-stock"
}

variable "environment" {
  description = "Deployment environment name (used as a resource name suffix and API Gateway stage name)"
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "ap-northeast-1"
}

variable "allowed_origin" {
  description = <<-EOT
    CORS allowed origin for the API. Defaults to the local frontend dev
    server. For production: apply once, read the `cloudfront_domain_name`
    output, then re-apply with `-var="allowed_origin=https://<that-domain>"`.
  EOT
  type    = string
  default = "http://localhost:5173"
}
```

- [ ] **Step 3: Write the Terraform-specific gitignore**

`terraform/.gitignore`:
```
.terraform/
*.tfstate
*.tfstate.*
*.tfplan
build/
```

> `.terraform.lock.hcl` is intentionally NOT ignored — like `package-lock.json`, it should be committed so everyone (and every `terraform init`) resolves the same provider versions.

- [ ] **Step 4: Initialize and validate**

Run: `cd terraform && terraform init`
Expected: Downloads the `aws` (~> 6.0) and `archive` (~> 2.4) providers, creates `.terraform/` and `.terraform.lock.hcl`, exits 0.

Run: `terraform fmt -check -recursive`
Expected: No output, exit 0 (files are already correctly formatted).

Run: `terraform validate`
Expected: `Success! The configuration is valid.`

- [ ] **Step 5: Commit**

```bash
git add terraform/main.tf terraform/variables.tf terraform/.gitignore terraform/.terraform.lock.hcl
git commit -m "chore: scaffold terraform module (provider, variables, gitignore)"
```

---

## Task 1: DynamoDB Table

**Files:**
- Create: `terraform/dynamodb.tf`

> Matches `調味料管理アプリ設計書.md` §6 exactly: single table, `PK` = `USER#{userId}`, `SK` = `SEASONING#{id}`, both strings. `PAY_PER_REQUEST` billing avoids capacity planning for a low-traffic personal app.

- [ ] **Step 1: Write the table resource**

`terraform/dynamodb.tf`:
```hcl
resource "aws_dynamodb_table" "seasonings" {
  name         = "${local.name_prefix}-seasonings"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  tags = local.common_tags
}
```

- [ ] **Step 2: Format and validate**

Run: `terraform fmt -check -recursive`
Expected: No output, exit 0.

Run: `terraform validate`
Expected: `Success! The configuration is valid.`

- [ ] **Step 3: Commit**

```bash
git add terraform/dynamodb.tf
git commit -m "feat: add DynamoDB Seasonings table"
```

---

## Task 2: Cognito User Pool + Client

**Files:**
- Create: `terraform/cognito.tf`

> Matches `調味料管理アプリ設計書.md` §4: email sign-in, **admin-create-only** (no self-signup — `allow_admin_create_user_only = true`), password policy (8+ chars, upper/lower/number, symbols not required), no MFA, **no Hosted UI** (achieved simply by not creating an `aws_cognito_user_pool_domain` resource — omitting it means there is no Hosted UI). Client has `generate_secret = false` (required for a browser SPA — Cognito Hosted UI Public Clients don't hold secrets) and the three auth flows the frontend needs (password auth, SRP auth, refresh).

- [ ] **Step 1: Write the User Pool and Client**

`terraform/cognito.tf`:
```hcl
resource "aws_cognito_user_pool" "this" {
  name = "${local.name_prefix}-users"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = false
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  tags = local.common_tags
}

resource "aws_cognito_user_pool_client" "frontend" {
  name         = "${local.name_prefix}-frontend"
  user_pool_id = aws_cognito_user_pool.this.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  prevent_user_existence_errors = "ENABLED"

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}
```

- [ ] **Step 2: Format and validate**

Run: `terraform fmt -check -recursive`
Expected: No output, exit 0.

Run: `terraform validate`
Expected: `Success! The configuration is valid.`

- [ ] **Step 3: Commit**

```bash
git add terraform/cognito.tf
git commit -m "feat: add Cognito User Pool (admin-create-only) and SPA client"
```

---

## Task 3: IAM Role for Lambda

**Files:**
- Create: `terraform/iam.tf`

> Least-privilege policy: only the 4 DynamoDB actions `backend/src/repository/seasoningRepository.ts` actually calls (`Query`, `GetItem`, `PutItem`, `DeleteItem`), scoped to the one table's ARN. Depends on Task 1 (`aws_dynamodb_table.seasonings.arn`).

- [ ] **Step 1: Write the execution role and policies**

`terraform/iam.tf`:
```hcl
resource "aws_iam_role" "lambda_exec" {
  name = "${local.name_prefix}-lambda-exec"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "lambda.amazonaws.com" }
        Action    = "sts:AssumeRole"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_dynamodb" {
  name = "${local.name_prefix}-lambda-dynamodb"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:Query",
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem",
        ]
        Resource = aws_dynamodb_table.seasonings.arn
      }
    ]
  })
}
```

- [ ] **Step 2: Format and validate**

Run: `terraform fmt -check -recursive`
Expected: No output, exit 0.

Run: `terraform validate`
Expected: `Success! The configuration is valid.`

- [ ] **Step 3: Commit**

```bash
git add terraform/iam.tf
git commit -m "feat: add Lambda execution role scoped to the Seasonings table"
```

---

## Task 4: Lambda Packaging and Function

**Files:**
- Modify: `backend/package.json`
- Create: `terraform/lambda.tf`

> Depends on Task 1 (`aws_dynamodb_table.seasonings.name`) and Task 3 (`aws_iam_role.lambda_exec.arn`). Does NOT yet reference API Gateway — `aws_lambda_permission` (which needs `aws_api_gateway_rest_api.this.execution_arn`) is added in Task 5 alongside the REST API itself, so this task's `terraform validate` doesn't depend on a file that doesn't exist yet.

- [ ] **Step 1: Extend the backend build script to stage `ulid` for packaging**

In `backend/package.json`, change the `build` script from:
```json
    "build": "tsc -p tsconfig.json"
```
to:
```json
    "build": "tsc -p tsconfig.json && rm -rf dist/node_modules && mkdir -p dist/node_modules && cp -r node_modules/ulid dist/node_modules/ulid"
```

Run: `cd ../backend && npm run build && ls dist/node_modules`
Expected: `dist/` contains the compiled `.js` files (`handler.js`, etc.) and `dist/node_modules/ulid/` now exists.

Run: `npm test`
Expected: All 43 tests still pass (the build script change doesn't touch source or test files).

- [ ] **Step 2: Write the Lambda function resource**

`terraform/lambda.tf`:
```hcl
data "archive_file" "backend" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/dist"
  output_path = "${path.module}/build/backend.zip"
}

resource "aws_lambda_function" "api" {
  function_name = "${local.name_prefix}-api"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "handler.handler"
  runtime       = "nodejs22.x"

  filename         = data.archive_file.backend.output_path
  source_code_hash = data.archive_file.backend.output_base64sha256

  timeout     = 10
  memory_size = 256

  environment {
    variables = {
      TABLE_NAME     = aws_dynamodb_table.seasonings.name
      ALLOWED_ORIGIN = var.allowed_origin
    }
  }

  tags = local.common_tags
}
```

> Before a real `terraform apply`, `backend/dist/` must exist and be current: run `cd backend && npm ci && npm run build`. `terraform validate` does not require the zip to actually exist (it only checks configuration syntax/types against provider schemas), so this task's validation below will pass regardless.

- [ ] **Step 3: Format and validate**

Run: `cd ../terraform && terraform fmt -check -recursive`
Expected: No output, exit 0.

Run: `terraform validate`
Expected: `Success! The configuration is valid.`

- [ ] **Step 4: Commit**

```bash
git add backend/package.json terraform/lambda.tf
git commit -m "feat: package backend for Lambda (bundle ulid) and add function resource"
```

---

## Task 5: API Gateway — REST API, Resources, Methods, Cognito Authorizer

**Files:**
- Create: `terraform/api_gateway.tf`

> Depends on Task 2 (Cognito User Pool ARN) and Task 4 (Lambda invoke ARN / function name). This is the file where the REST-API-v1-not-HTTP-API-v2 decision from the plan's Architecture section is load-bearing: `type = "COGNITO_USER_POOLS"` on `aws_api_gateway_authorizer` only exists on the REST API resource family.

- [ ] **Step 1: Write the REST API, Cognito authorizer, resources, methods, integrations, and Lambda permission**

`terraform/api_gateway.tf`:
```hcl
resource "aws_api_gateway_rest_api" "this" {
  name = "${local.name_prefix}-api"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = local.common_tags
}

resource "aws_api_gateway_authorizer" "cognito" {
  name            = "${local.name_prefix}-cognito-authorizer"
  rest_api_id     = aws_api_gateway_rest_api.this.id
  type            = "COGNITO_USER_POOLS"
  provider_arns   = [aws_cognito_user_pool.this.arn]
  identity_source = "method.request.header.Authorization"
}

resource "aws_api_gateway_resource" "seasonings" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  parent_id   = aws_api_gateway_rest_api.this.root_resource_id
  path_part   = "seasonings"
}

resource "aws_api_gateway_resource" "seasoning_item" {
  rest_api_id = aws_api_gateway_rest_api.this.id
  parent_id   = aws_api_gateway_resource.seasonings.id
  path_part   = "{id}"
}

# GET /seasonings
resource "aws_api_gateway_method" "list_seasonings" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.seasonings.id
  http_method   = "GET"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito.id
}

resource "aws_api_gateway_integration" "list_seasonings" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.seasonings.id
  http_method             = aws_api_gateway_method.list_seasonings.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.api.invoke_arn
}

# POST /seasonings
resource "aws_api_gateway_method" "create_seasoning" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.seasonings.id
  http_method   = "POST"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito.id
}

resource "aws_api_gateway_integration" "create_seasoning" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.seasonings.id
  http_method             = aws_api_gateway_method.create_seasoning.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.api.invoke_arn
}

# PATCH /seasonings/{id}
resource "aws_api_gateway_method" "update_seasoning" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.seasoning_item.id
  http_method   = "PATCH"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito.id

  request_parameters = {
    "method.request.path.id" = true
  }
}

resource "aws_api_gateway_integration" "update_seasoning" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.seasoning_item.id
  http_method             = aws_api_gateway_method.update_seasoning.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.api.invoke_arn
}

# DELETE /seasonings/{id}
resource "aws_api_gateway_method" "delete_seasoning" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = aws_api_gateway_resource.seasoning_item.id
  http_method   = "DELETE"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito.id

  request_parameters = {
    "method.request.path.id" = true
  }
}

resource "aws_api_gateway_integration" "delete_seasoning" {
  rest_api_id             = aws_api_gateway_rest_api.this.id
  resource_id             = aws_api_gateway_resource.seasoning_item.id
  http_method             = aws_api_gateway_method.delete_seasoning.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.api.invoke_arn
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.this.execution_arn}/*/*"
}
```

- [ ] **Step 2: Format and validate**

Run: `terraform fmt -check -recursive`
Expected: No output, exit 0.

Run: `terraform validate`
Expected: `Success! The configuration is valid.`

- [ ] **Step 3: Commit**

```bash
git add terraform/api_gateway.tf
git commit -m "feat: add REST API with Cognito authorizer and 4 seasonings routes"
```

---

## Task 6: API Gateway — CORS (OPTIONS), Gateway Responses, Deployment

**Files:**
- Modify: `terraform/api_gateway.tf` (append)

> Two CORS layers, matching the design doc's hardened requirement that *every* response — success, Lambda-thrown errors, and errors API Gateway itself generates before Lambda ever runs (e.g. a rejected/missing Cognito token) — carries CORS headers:
> 1. **`OPTIONS` preflight** on both resources — `MOCK` integration, no authorizer, returns the CORS headers directly from API Gateway (the Lambda's own `OPTIONS` handling in `handler.ts` is defense-in-depth for direct invocation/testing; API Gateway answers real browser preflights here without ever invoking Lambda).
> 2. **`DEFAULT_4XX`/`DEFAULT_5XX` gateway responses** — covers API-Gateway-generated errors (e.g. `401` from a bad/missing Cognito token, rejected before Lambda runs) that never reach `handler.ts`'s own CORS-header logic.
>
> The 4 `OPTIONS`-related resource types are identical for both `/seasonings` and `/seasonings/{id}`, so this section uses `for_each` over a small local map — the plan's earlier main routes were left as explicit blocks (4 distinct routes, each meaningfully different); here it's the *same* CORS boilerplate applied twice, which is exactly the case `for_each` is for.

- [ ] **Step 1: Append CORS OPTIONS methods, gateway responses, and deployment/stage**

Append to `terraform/api_gateway.tf`:
```hcl
locals {
  cors_resources = {
    seasonings     = aws_api_gateway_resource.seasonings.id
    seasoning_item = aws_api_gateway_resource.seasoning_item.id
  }
}

resource "aws_api_gateway_method" "options" {
  for_each      = local.cors_resources
  rest_api_id   = aws_api_gateway_rest_api.this.id
  resource_id   = each.value
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options" {
  for_each    = local.cors_resources
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = each.value
  http_method = aws_api_gateway_method.options[each.key].http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "options" {
  for_each    = local.cors_resources
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = each.value
  http_method = aws_api_gateway_method.options[each.key].http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "options" {
  for_each    = local.cors_resources
  rest_api_id = aws_api_gateway_rest_api.this.id
  resource_id = each.value
  http_method = aws_api_gateway_method.options[each.key].http_method
  status_code = aws_api_gateway_method_response.options[each.key].status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Authorization,Content-Type'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,PATCH,DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'${var.allowed_origin}'"
  }

  depends_on = [aws_api_gateway_integration.options]
}

resource "aws_api_gateway_gateway_response" "default_4xx" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  response_type = "DEFAULT_4XX"

  response_parameters = {
    "gatewayresponse.header.Access-Control-Allow-Origin"  = "'${var.allowed_origin}'"
    "gatewayresponse.header.Access-Control-Allow-Headers" = "'Authorization,Content-Type'"
  }
}

resource "aws_api_gateway_gateway_response" "default_5xx" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  response_type = "DEFAULT_5XX"

  response_parameters = {
    "gatewayresponse.header.Access-Control-Allow-Origin"  = "'${var.allowed_origin}'"
    "gatewayresponse.header.Access-Control-Allow-Headers" = "'Authorization,Content-Type'"
  }
}

resource "aws_api_gateway_deployment" "this" {
  rest_api_id = aws_api_gateway_rest_api.this.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.seasonings.id,
      aws_api_gateway_resource.seasoning_item.id,
      aws_api_gateway_method.list_seasonings.id,
      aws_api_gateway_method.create_seasoning.id,
      aws_api_gateway_method.update_seasoning.id,
      aws_api_gateway_method.delete_seasoning.id,
      aws_api_gateway_integration.list_seasonings.id,
      aws_api_gateway_integration.create_seasoning.id,
      aws_api_gateway_integration.update_seasoning.id,
      aws_api_gateway_integration.delete_seasoning.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_integration.list_seasonings,
    aws_api_gateway_integration.create_seasoning,
    aws_api_gateway_integration.update_seasoning,
    aws_api_gateway_integration.delete_seasoning,
    aws_api_gateway_integration.options,
  ]
}

resource "aws_api_gateway_stage" "this" {
  deployment_id = aws_api_gateway_deployment.this.id
  rest_api_id   = aws_api_gateway_rest_api.this.id
  stage_name    = var.environment
}
```

- [ ] **Step 2: Format and validate**

Run: `terraform fmt -check -recursive`
Expected: No output, exit 0.

Run: `terraform validate`
Expected: `Success! The configuration is valid.`

- [ ] **Step 3: Commit**

```bash
git add terraform/api_gateway.tf
git commit -m "feat: add CORS preflight, gateway-response CORS, and API deployment/stage"
```

---

## Task 7: S3 Bucket (Frontend Hosting)

**Files:**
- Create: `terraform/s3.tf`

> Bucket name includes the AWS account ID (via `data.aws_caller_identity.current` from Task 0's `main.tf`) because S3 bucket names must be globally unique across all AWS accounts, not just within this account. No bucket policy yet — that needs the CloudFront distribution's ARN (Task 8, not created yet); added in Task 9.

- [ ] **Step 1: Write the bucket and its public access block**

`terraform/s3.tf`:
```hcl
resource "aws_s3_bucket" "frontend" {
  bucket = "${local.name_prefix}-frontend-${data.aws_caller_identity.current.account_id}"

  tags = local.common_tags
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
```

- [ ] **Step 2: Format and validate**

Run: `terraform fmt -check -recursive`
Expected: No output, exit 0.

Run: `terraform validate`
Expected: `Success! The configuration is valid.`

- [ ] **Step 3: Commit**

```bash
git add terraform/s3.tf
git commit -m "feat: add private S3 bucket for frontend static assets"
```

---

## Task 8: CloudFront Distribution

**Files:**
- Create: `terraform/cloudfront.tf`

> Uses Origin Access Control (OAC, the modern replacement for the older Origin Access Identity) so the S3 bucket stays fully private and is only reachable through CloudFront. Uses the AWS-managed `CachingOptimized` cache policy (`cache_policy_id`) rather than the deprecated `forwarded_values` block (deprecated in `hashicorp/aws` ~> 6.0's upstream CloudFront API in favor of cache policies — confirmed via the provider's v6 upgrade guide). The two `custom_error_response` blocks (403/404 → `200 /index.html`) are the standard SPA fallback: React Router's client-side routes 404 against S3 directly (there's no `/some/route` object in the bucket), so CloudFront rewrites those to `index.html` and lets the client-side router take over.

- [ ] **Step 1: Write the OAC and distribution**

`terraform/cloudfront.tf`:
```hcl
resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${local.name_prefix}-frontend-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  default_root_object = "index.html"
  price_class         = "PriceClass_200"

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "frontend-s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "frontend-s3"
    viewer_protocol_policy = "redirect-to-https"

    # AWS-managed "CachingOptimized" policy (forwards no query strings/cookies/headers).
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  # SPA fallback: client-side routes 404 against S3 directly, so rewrite to index.html.
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = local.common_tags
}
```

- [ ] **Step 2: Format and validate**

Run: `terraform fmt -check -recursive`
Expected: No output, exit 0.

Run: `terraform validate`
Expected: `Success! The configuration is valid.`

- [ ] **Step 3: Commit**

```bash
git add terraform/cloudfront.tf
git commit -m "feat: add CloudFront distribution with OAC and SPA fallback routing"
```

---

## Task 9: S3 Bucket Policy (CloudFront-Only Access)

**Files:**
- Modify: `terraform/s3.tf` (append)

> Now that Task 8 created the CloudFront distribution, this closes the loop: only that specific distribution (matched via `AWS:SourceArn`) may `s3:GetObject` from the bucket. No public access, no other principal.

- [ ] **Step 1: Append the bucket policy**

Append to `terraform/s3.tf`:
```hcl
data "aws_iam_policy_document" "frontend_cloudfront_access" {
  statement {
    sid     = "AllowCloudFrontOAC"
    effect  = "Allow"
    actions = ["s3:GetObject"]

    resources = ["${aws_s3_bucket.frontend.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.frontend.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  policy = data.aws_iam_policy_document.frontend_cloudfront_access.json
}
```

- [ ] **Step 2: Format and validate**

Run: `terraform fmt -check -recursive`
Expected: No output, exit 0.

Run: `terraform validate`
Expected: `Success! The configuration is valid.`

- [ ] **Step 3: Commit**

```bash
git add terraform/s3.tf
git commit -m "feat: restrict frontend bucket access to the CloudFront distribution"
```

---

## Task 10: Outputs

**Files:**
- Create: `terraform/outputs.tf`

> These are the values the frontend (a separate, future plan) needs: the API base URL, the two Cognito IDs for Amplify Auth configuration, and the CloudFront domain (also needed to close the `allowed_origin` loop described in this plan's Architecture section).

- [ ] **Step 1: Write the outputs**

`terraform/outputs.tf`:
```hcl
output "api_invoke_url" {
  description = "Base URL for the seasonings API"
  value       = aws_api_gateway_stage.this.invoke_url
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID for frontend auth configuration"
  value       = aws_cognito_user_pool.this.id
}

output "cognito_user_pool_client_id" {
  description = "Cognito User Pool Client ID for frontend auth configuration"
  value       = aws_cognito_user_pool_client.frontend.id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name; use as https://<this> for allowed_origin in a real prod deploy"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "s3_bucket_name" {
  description = "S3 bucket name for frontend static asset uploads"
  value       = aws_s3_bucket.frontend.bucket
}

output "dynamodb_table_name" {
  description = "DynamoDB table name (matches the Lambda's TABLE_NAME env var)"
  value       = aws_dynamodb_table.seasonings.name
}
```

- [ ] **Step 2: Format and validate**

Run: `terraform fmt -check -recursive`
Expected: No output, exit 0.

Run: `terraform validate`
Expected: `Success! The configuration is valid.`

- [ ] **Step 3: Commit**

```bash
git add terraform/outputs.tf
git commit -m "feat: add terraform outputs for frontend integration"
```

---

## Task 11: Full Module Verification

**Files:** none (verification only)

- [ ] **Step 1: Format the entire module**

Run: `terraform fmt -recursive` then `git status --short`
Expected: No changes reported (everything was already correctly formatted task-by-task).

- [ ] **Step 2: Validate the entire module**

Run: `terraform validate`
Expected: `Success! The configuration is valid.`

- [ ] **Step 3: Sanity-check for unused/undeclared variables and obvious drift**

Run: `terraform validate -json | python3 -c "import json,sys; d=json.load(sys.stdin); print('valid:', d['valid']); print('error_count:', d['error_count']); print('warning_count:', d['warning_count'])"`
Expected: `valid: True`, `error_count: 0`.

- [ ] **Step 4: Commit (only if Step 1 found formatting drift)**

```bash
git status --short
```
If clean, no commit needed — this task is a checkpoint, not a code change. If `terraform fmt -recursive` changed anything, commit it:
```bash
git add terraform/
git commit -m "chore: terraform fmt"
```

---

## What This Plan Does Not Cover

- **`terraform plan` / `terraform apply`:** requires live, authenticated AWS credentials (this session's are expired) and creates real, billable AWS resources. Run these yourself after `aws sso login` (or equivalent), or explicitly ask for them to be run once you're authenticated — do not run `apply` without that explicit, separate go-ahead.
- **Remote state backend:** local `terraform.tfstate` only, gitignored. Fine for a single developer; revisit if this ever becomes a team project.
- **Custom domain / ACM certificate:** CloudFront uses its default `*.cloudfront.net` certificate.
- **The frontend application:** React app, Amplify Auth wiring using this plan's `cognito_user_pool_id`/`cognito_user_pool_client_id`/`api_invoke_url` outputs, offline caching. Needs its own plan.
