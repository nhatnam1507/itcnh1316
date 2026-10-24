---
phase: 2
title: "Supabase project, settings and keys"
status: in-progress
priority: P1
effort: 4h
dependencies: [1]
---

# Phase 2: Supabase project, settings and keys

## Goal

Terraform owns the production Supabase project, its generated database password, its Auth and API settings (mirroring `supabase/config.toml`), and its API keys. Phase 3 consumes the keys.

## Context

- `supabase_project` requires `organization_id`, `name`, `region` and a sensitive `database_password`. Import an existing project with `supabase_project.<name> <project_ref>`.
- `supabase_settings` takes JSON strings for `api`, `auth`, `database`, `network`, `pooler` and `storage`. Only the fields you declare are managed, and deleting the resource is a no-op.
- Field names were checked against the Management API OpenAPI spec (`UpdateAuthConfigBody` and `V1UpdatePostgrestConfigBody`) on 2026-10-24. Every name in the tables below exists.
- `data "supabase_apikeys"` exposes `publishable_key` and a `secret_keys` list of `{ name, api_key }`. All values are sensitive.
- `supabase_apikey` creates a named key, but its `type` is read-only. `[UNVERIFIED]`: whether it creates a secret-type key, and the name of the project's default secret key.

## Files to Create / Modify

- Create: `/home/namnn/src/itcnh1316/infra/secrets.tf`: `random_password.supabase_db` (length 40, `special = false` so connection strings need no escaping).
- Create: `/home/namnn/src/itcnh1316/infra/supabase.tf`:
  - `supabase_project.this` (`region = var.supabase_region`, which is `ap-southeast-1`);
  - `supabase_settings.this`, built from `local.supabase_settings = jsondecode(file("${path.module}/supabase-settings.json"))`, with `site_url` and `uri_allow_list` merged into `auth`;
  - the key source;
  - `locals { supabase_url = "https://${supabase_project.this.id}.supabase.co" }`.
  <!-- Updated: Validation Session 1 - settings in JSON for the parity test; Singapore region -->
- Create: `/home/namnn/src/itcnh1316/infra/supabase-settings.json`: `{ "auth": {…}, "api": {…} }`, holding every row of the mapping below except `site_url` and `uri_allow_list`, which are production-only and set in `supabase.tf`.
- Create: `/home/namnn/src/itcnh1316/scripts/supabase-settings-parity.test.ts`: a Vitest test. It parses `supabase/config.toml` with `smol-toml` and asserts that each mapped `config.toml` value equals its counterpart in `infra/supabase-settings.json`, including the boolean inversions (`enable_signup` ↔ `disable_signup`, `enable_confirmations` ↔ `mailer_autoconfirm`). It also asserts that the JSON has no keys outside the mapping, so a new field can't skip the check. `vitest.config.mts` already includes `scripts/**/*.test.ts`.
- Modify: `/home/namnn/src/itcnh1316/package.json` and `package-lock.json`: run `npm install --save-dev --save-exact smol-toml@1.9.1`.
- Create: `/home/namnn/src/itcnh1316/infra/outputs.tf`: `supabase_project_ref` (not sensitive) and `supabase_url`.

## Settings mapping (`config.toml` → production)

Auth (`supabase_settings.this.auth`):

| `config.toml` | Management API field | Value |
|---|---|---|
| `[auth] enable_signup = false` | `disable_signup` | `true` |
| `[auth.email]` email login | `external_email_enabled` | `true` |
| `[auth.email] enable_confirmations = false` | `mailer_autoconfirm` | `true` |
| `[auth.email] double_confirm_changes = true` | `mailer_secure_email_change_enabled` | `true` |
| `enable_anonymous_sign_ins = false` | `external_anonymous_users_enabled` | `false` |
| `[auth.sms] enable_signup = false` | `external_phone_enabled` | `false` |
| `enable_manual_linking = false` | `security_manual_linking_enabled` | `false` |
| `minimum_password_length = 12` | `password_min_length` | `12` |
| `jwt_expiry = 3600` | `jwt_exp` | `3600` |
| `enable_refresh_token_rotation = true` | `refresh_token_rotation_enabled` | `true` |
| `refresh_token_reuse_interval = 10` | `security_refresh_token_reuse_interval` | `10` |
| `[auth.rate_limit] token_refresh = 150` | `rate_limit_token_refresh` | `150` |
| `[auth.rate_limit] token_verifications = 30` | `rate_limit_verify` | `30` |
| `site_url` (local `127.0.0.1:3000`) | `site_url` | `"https://${var.production_domain}"` |
| `additional_redirect_urls` | `uri_allow_list` | `""` (admins sign in with a password; no redirects) |

API (`supabase_settings.this.api`): `db_schema = "public,graphql_public"`, `db_extra_search_path = "public,extensions"`, `max_rows = 1000`.

Add a comment in `supabase.tf` saying that `supabase-settings.json` mirrors `supabase/config.toml` and that `scripts/supabase-settings-parity.test.ts` enforces it.

## Tasks & Steps

- [x] Write the parity test first and watch it fail because `infra/supabase-settings.json` is missing. Then write the JSON and watch the test pass.
- [x] Write `secrets.tf` and `supabase.tf`. The project does not exist yet (validation session 1), so Terraform creates it, using the generated password. No import is needed.
- [x] Resolve the `[UNVERIFIED]` key question. After the project exists, run `terraform -chdir=infra console` and evaluate `[for k in data.supabase_apikeys.this.secret_keys : k.name]`.
  - Prefer a managed `supabase_apikey.vercel_server` if its `api_key` starts with `sb_secret_`. That makes leak rotation a `-replace`.
  - Otherwise select the secret key by name from the data source.
  - Record which way was chosen in this phase file.
- [x] Add `locals { supabase_secret_key = ..., supabase_publishable_key = data.supabase_apikeys.this.publishable_key }` for phase 3. Do not output them.
- [ ] Run `terraform -chdir=infra apply` from a local CLI-driven run. Review the plan before approving.

## Verification

- `npx vitest run scripts/supabase-settings-parity.test.ts` passes. Temporarily flip `minimum_password_length` in `config.toml`: the test fails, naming the field. Revert the change.
- A second `terraform -chdir=infra plan` reports `No changes`.
- `curl -s -o /dev/null -w '%{http_code}' -X POST "https://<ref>.supabase.co/auth/v1/signup" -H "apikey: <publishable>" -H 'content-type: application/json' -d '{"email":"probe@example.invalid","password":"probe-password-123"}'` returns a 4xx refusal. Run it from a shell; don't paste the key into any file.
- `npx supabase link --project-ref <ref>`, using the Terraform-generated password from `terraform output` run once locally with `-raw` and kept in memory only, followed by `npx supabase db push --dry-run`, lists the 3 pending migrations.
- `terraform output` prints no key or password.

## Risks

- **The project takes minutes to provision.** The data source can be read before keys exist. Add `depends_on = [supabase_project.this]` and the provider's `timeouts { create = "15m" }`.
- **Setting `site_url` before the domain resolves** is harmless; it only builds email links, and no emails are sent.
- **Divergence between `config.toml` and the Terraform auth settings.** The parity test, run by `npm test` in CI, fails the PR when they diverge.

## Implementation notes (2026-10-24)

- **Key question resolved from provider source** (`internal/provider/apikey_resource.go`, v1.11): `supabase_apikey` always creates `type = secret` with `secret_jwt_template.role = service_role`, and first makes sure a `default` publishable key exists. The module uses the managed `supabase_apikey.vercel_server`, so leak rotation is `terraform apply -replace=supabase_apikey.vercel_server`. Still confirm the `sb_secret_` prefix live after the first apply.
- `supabase_project` has `lifecycle { prevent_destroy = true }`. No attribute forces replacement (all update in place), but a destroy would delete the production data.
- A sensitive output `supabase_db_password` serves the `-raw` verification step and the restore runbook.
- Verified locally: the parity test (18 cases) failed before the JSON existed and when `minimum_password_length` was flipped; a mock-provider `terraform test` (scratch only) applied the whole graph and rejected invalid inputs.
