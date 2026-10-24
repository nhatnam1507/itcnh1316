terraform {
  required_version = "~> 1.17.0"

  # State and runs live in HCP Terraform (remote execution). Credentials are sensitive workspace variables.
  cloud {
    organization = "nhatnam1507"

    workspaces {
      name = "classmate-directory-production"
    }
  }

  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 5.24"
    }
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.11"
    }
    github = {
      source  = "integrations/github"
      version = "~> 6.13"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.9"
    }
  }
}
