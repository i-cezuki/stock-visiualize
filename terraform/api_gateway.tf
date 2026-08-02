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

  # Hashing the whole file (not just a hand-picked list of resource IDs) means
  # ANY change in here — a new route, a CORS header value, a gateway response —
  # forces a redeployment. A resource-ID-only trigger misses edits to arguments
  # (e.g. response_parameters content) that don't change the resource's ID,
  # which would otherwise leave the live stage silently serving stale config.
  # var.allowed_origin is included separately because its value is interpolated
  # into this file's CORS headers but re-applying with a different `-var` (the
  # documented prod cutover in variables.tf's description) doesn't change this
  # file's own bytes, so filesha1() alone wouldn't notice that change.
  triggers = {
    redeployment = sha1(join(",", [
      filesha1("${path.module}/api_gateway.tf"),
      var.allowed_origin,
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
