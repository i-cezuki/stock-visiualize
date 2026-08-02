# Only `ulid` is staged in dist/node_modules (see backend/package.json's build
# script) — @aws-sdk/client-dynamodb and @aws-sdk/lib-dynamodb are not zipped
# because the nodejs22.x managed runtime bundles the AWS SDK v3. If AWS ever
# ships a runtime SDK version incompatible with backend/package.json's pinned
# ^3.632.0, that mismatch would only surface at invoke time, not here.
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
