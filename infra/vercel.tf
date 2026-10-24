# No git_repository is attached and vercel.json turns Git deploys off:
# only deploy.yml deploys, and no preview deployment ever reads production data.
resource "vercel_project" "app" {
  name         = var.project_name
  framework    = "nextjs"
  node_version = "24.x" # matches .nvmrc and package.json engines

  vercel_authentication = {
    deployment_type = "standard_protection_new"
  }

  resource_config = {
    function_default_regions = [var.vercel_function_region]
  }
}

locals {
  # Keys must match src/lib/env.ts exactly.
  runtime_env = {
    SUPABASE_URL             = { value = local.supabase_url, sensitive = false }
    SUPABASE_PUBLISHABLE_KEY = { value = local.supabase_publishable_key, sensitive = true }
    SUPABASE_SECRET_KEY      = { value = local.supabase_secret_key, sensitive = true }
    CLASS_PASSCODE_HASH      = { value = var.class_passcode_hash, sensitive = true }
    SESSION_SECRET           = { value = random_password.session_secret.result, sensitive = true }
    RATE_LIMIT_SALT          = { value = random_password.rate_limit_salt.result, sensitive = true }
    PASSCODE_SESSION_DAYS    = { value = tostring(var.passcode_session_days), sensitive = false }
    NOMINATIM_CONTACT_EMAIL  = { value = var.nominatim_contact_email, sensitive = false }
    GEOCODE_COUNTRY_CODES    = { value = var.geocode_country_codes, sensitive = false }
  }
}

resource "vercel_project_environment_variables" "production" {
  project_id = vercel_project.app.id

  variables = [
    for key, env in local.runtime_env : {
      key       = key
      value     = env.value
      sensitive = env.sensitive
      target    = ["production"]
    }
  ]
}

# The domain is on Vercel DNS, so attaching it configures the records automatically.
resource "vercel_project_domain" "production" {
  project_id = vercel_project.app.id
  domain     = var.production_domain
}
