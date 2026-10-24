# Generated secrets. special = false keeps them safe in connection strings and env files.

resource "random_password" "supabase_db" {
  length  = 40
  special = false
}

resource "random_password" "session_secret" {
  length  = 64
  special = false

  keepers = {
    version = var.session_secret_version
  }
}

resource "random_password" "rate_limit_salt" {
  length  = 48
  special = false

  keepers = {
    version = var.rate_limit_salt_version
  }
}
