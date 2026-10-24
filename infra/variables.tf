# Sensitive inputs are set as sensitive Terraform variables on the HCP workspace.
# Non-secret inputs are committed in production.auto.tfvars.

variable "vercel_api_token" {
  description = "Vercel API token for the team that owns the project. Also used by deploy.yml as VERCEL_TOKEN."
  type        = string
  sensitive   = true
}

variable "supabase_access_token" {
  description = "Supabase account access token. Also used by deploy.yml as SUPABASE_ACCESS_TOKEN."
  type        = string
  sensitive   = true
}

variable "github_token" {
  description = "Fine-grained GitHub PAT for this repository only: Environments, Secrets and Variables (read/write), Metadata (read)."
  type        = string
  sensitive   = true
}

variable "class_passcode_hash" {
  description = "CLASS_PASSCODE_HASH, from node scripts/hash-passcode.mjs."
  type        = string
  sensitive   = true

  validation {
    condition     = startswith(var.class_passcode_hash, "scrypt:")
    error_message = "class_passcode_hash must be the output of scripts/hash-passcode.mjs (starts with \"scrypt:\")."
  }
}

variable "backup_passphrase" {
  description = "Encrypts the pre-migration database backup. Keep a copy in the maintainer's password manager."
  type        = string
  sensitive   = true
}

variable "supabase_organization_id" {
  description = "Supabase organization slug that owns the project."
  type        = string
}

variable "supabase_region" {
  description = "Supabase project region."
  type        = string
}

variable "vercel_team_id" {
  description = "Vercel team ID (team_...). Also written to GitHub as VERCEL_ORG_ID."
  type        = string
}

variable "vercel_function_region" {
  description = "Default Vercel Functions region; keep it next to the Supabase region."
  type        = string
}

variable "project_name" {
  description = "Name of the Supabase and Vercel projects."
  type        = string
}

variable "production_domain" {
  description = "Production hostname, on Vercel DNS under vercel_team_id (for example classnet.example.com)."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$", var.production_domain))
    error_message = "production_domain must be a lowercase hostname without a scheme or path."
  }
}

variable "github_owner" {
  description = "GitHub user or organization that owns the repository."
  type        = string
}

variable "github_repository" {
  description = "GitHub repository name (without the owner)."
  type        = string
}

# Runtime settings; the rules mirror src/lib/env.ts.

variable "nominatim_contact_email" {
  description = "NOMINATIM_CONTACT_EMAIL, sent to Nominatim in the User-Agent."
  type        = string

  validation {
    condition     = can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.nominatim_contact_email))
    error_message = "nominatim_contact_email must be an email address."
  }
}

variable "geocode_country_codes" {
  description = "GEOCODE_COUNTRY_CODES: comma-separated ISO 3166-1 alpha-2 codes."
  type        = string
  default     = "vn"

  validation {
    condition     = can(regex("^[a-z]{2}(,[a-z]{2})*$", var.geocode_country_codes))
    error_message = "geocode_country_codes must look like \"vn\" or \"vn,la\"."
  }
}

variable "passcode_session_days" {
  description = "PASSCODE_SESSION_DAYS: how long a viewer stays unlocked."
  type        = number
  default     = 30

  validation {
    condition     = var.passcode_session_days == floor(var.passcode_session_days) && var.passcode_session_days >= 1 && var.passcode_session_days <= 365
    error_message = "passcode_session_days must be an integer from 1 to 365."
  }
}

# Bump a version in a reviewed PR to rotate that generated secret.

variable "session_secret_version" {
  description = "Rotation counter for SESSION_SECRET. Bumping it logs every viewer out."
  type        = number
  default     = 1
}

variable "rate_limit_salt_version" {
  description = "Rotation counter for RATE_LIMIT_SALT. Bumping it resets rate-limit buckets."
  type        = number
  default     = 1
}
