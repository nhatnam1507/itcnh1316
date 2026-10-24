resource "github_repository_environment" "production" {
  repository  = var.github_repository
  environment = "production"
}

locals {
  # Secrets read by .github/workflows/deploy.yml; the names must stay identical.
  deploy_secrets = sensitive({
    SUPABASE_ACCESS_TOKEN = var.supabase_access_token
    SUPABASE_DB_PASSWORD  = random_password.supabase_db.result
    SUPABASE_PROJECT_ID   = supabase_project.this.id
    BACKUP_PASSPHRASE     = var.backup_passphrase
    VERCEL_TOKEN          = var.vercel_api_token
    VERCEL_ORG_ID         = var.vercel_team_id
    VERCEL_PROJECT_ID     = vercel_project.app.id
  })
}

resource "github_actions_environment_secret" "deploy" {
  # Only the names reach resource addresses; the values stay sensitive.
  for_each = nonsensitive(toset(keys(local.deploy_secrets)))

  repository  = var.github_repository
  environment = github_repository_environment.production.environment
  secret_name = each.key
  value       = local.deploy_secrets[each.key]
}

resource "github_actions_environment_variable" "production_url" {
  repository    = var.github_repository
  environment   = github_repository_environment.production.environment
  variable_name = "PRODUCTION_URL"
  value         = "https://${var.production_domain}"
}
