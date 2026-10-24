output "supabase_project_ref" {
  description = "Production Supabase project ref."
  value       = supabase_project.this.id
}

output "supabase_url" {
  description = "Production Supabase API URL."
  value       = local.supabase_url
}

# Read on demand with `terraform -chdir=infra output -raw supabase_db_password` (for supabase link or a restore).
output "supabase_db_password" {
  description = "Generated production database password."
  sensitive   = true
  value       = random_password.supabase_db.result
}

output "vercel_project_id" {
  description = "Vercel project ID."
  value       = vercel_project.app.id
}

output "production_url" {
  description = "URL the deploy smoke test checks."
  value       = "https://${var.production_domain}"
}

# Vercel Secret values cannot be read back through the API, so `vercel pull` leaves them empty.
# deploy.yml reads these to scan the client bundle for their literal values.
output "scan_literals" {
  description = "Secret runtime values that must never appear in the client bundle."
  sensitive   = true
  value       = { for key, env in local.runtime_env : key => env.value if env.sensitive }
}
