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
