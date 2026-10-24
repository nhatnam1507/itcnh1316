# supabase-settings.json mirrors supabase/config.toml (the local stack);
# scripts/supabase-settings-parity.test.ts fails CI when they diverge.
# Only production-only fields are added here.
locals {
  supabase_settings = jsondecode(file("${path.module}/supabase-settings.json"))
  supabase_url      = "https://${supabase_project.this.id}.supabase.co"
}

resource "supabase_project" "this" {
  organization_id   = var.supabase_organization_id
  name              = var.project_name
  region            = var.supabase_region
  database_password = random_password.supabase_db.result

  timeouts {
    create = "15m"
  }

  # Destroying the project deletes every classmate's data.
  lifecycle {
    prevent_destroy = true
  }
}

resource "supabase_settings" "this" {
  project_ref = supabase_project.this.id

  api = jsonencode(local.supabase_settings.api)
  auth = jsonencode(merge(local.supabase_settings.auth, {
    site_url = "https://${var.production_domain}"
    # Admins sign in with a password, so no redirect URLs are allowed.
    uri_allow_list = ""
  }))
}

# The provider always creates this as a secret-type key (service_role). Rotate a leaked key with
# terraform apply -replace=supabase_apikey.vercel_server.
resource "supabase_apikey" "vercel_server" {
  project_ref = supabase_project.this.id
  name        = "vercel_server"
  description = "Server-side key for the Vercel app, managed by Terraform."
}

data "supabase_apikeys" "this" {
  project_ref = supabase_project.this.id

  # Creating the managed key also makes sure the default publishable key exists.
  depends_on = [supabase_apikey.vercel_server]
}

locals {
  supabase_secret_key      = supabase_apikey.vercel_server.api_key
  supabase_publishable_key = data.supabase_apikeys.this.publishable_key
}
