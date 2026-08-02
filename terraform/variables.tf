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
  type        = string
  default     = "http://localhost:5173"
}
