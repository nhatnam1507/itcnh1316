provider "vercel" {
  api_token = var.vercel_api_token
  team      = var.vercel_team_id
}

provider "supabase" {
  access_token = var.supabase_access_token
}

provider "github" {
  owner = var.github_owner
  token = var.github_token
}
