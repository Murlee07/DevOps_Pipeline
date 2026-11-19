terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.95"
    }
  }

  # Recommended: remote state in S3 with native locking (Terraform >= 1.10).
  # Create the bucket once, then uncomment and run `terraform init -migrate-state`.
  # backend "s3" {
  #   bucket       = "shieldboard-tfstate-<your-account-id>"
  #   key          = "shieldboard/terraform.tfstate"
  #   region       = "ap-south-1"
  #   encrypt      = true
  #   use_lockfile = true
  # }
}
