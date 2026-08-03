variable "github_repo" {
  description = "GitHub repo allowed to assume the deploy role, as \"owner/name\""
  type        = string
  default     = "i-cezuki/stock-visiualize"
}

locals {
  github_owner     = split("/", var.github_repo)[0]
  github_repo_name = split("/", var.github_repo)[1]
}

resource "aws_iam_openid_connect_provider" "github_actions" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]

  tags = local.common_tags
}

resource "aws_iam_role" "github_actions_deploy" {
  name = "${local.name_prefix}-github-actions-deploy"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Federated = aws_iam_openid_connect_provider.github_actions.arn }
        Action    = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          # Restrict to pushes to main only — PRs from forks can't assume this role.
          # GitHub's sub claim includes each side's immutable numeric ID
          # (repo:owner@ownerId/name@repoId:...), not just "owner/name", so
          # both the owner and repo segments need their own wildcard suffix.
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:${local.github_owner}*/${local.github_repo_name}*:ref:refs/heads/main"
          }
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "github_actions_deploy" {
  name = "${local.name_prefix}-github-actions-deploy"
  role = aws_iam_role.github_actions_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = aws_s3_bucket.frontend.arn
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.frontend.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["cloudfront:CreateInvalidation"]
        Resource = aws_cloudfront_distribution.frontend.arn
      }
    ]
  })
}
