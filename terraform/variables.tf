variable "project" {
  description = "Project name used for naming and tagging"
  type        = string
  default     = "shieldboard"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region (ap-south-1 = Mumbai)"
  type        = string
  default     = "ap-south-1"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.20.0.0/16"
}

variable "kubernetes_version" {
  description = "EKS Kubernetes version"
  type        = string
  default     = "1.33"
}

variable "node_instance_types" {
  description = "Instance types for the EKS managed node group"
  type        = list(string)
  default     = ["t3.medium"]
}

variable "node_desired_size" {
  type    = number
  default = 2
}

variable "node_min_size" {
  type    = number
  default = 1
}

variable "node_max_size" {
  type    = number
  default = 3
}

variable "cluster_admin_arns" {
  description = "Extra IAM principals (e.g. the Jenkins IAM user) to grant cluster-admin. Map of name => ARN."
  type        = map(string)
  default     = {}
}

variable "ecr_repositories" {
  description = "ECR repositories to create"
  type        = list(string)
  default     = ["shieldboard-backend", "shieldboard-frontend"]
}
