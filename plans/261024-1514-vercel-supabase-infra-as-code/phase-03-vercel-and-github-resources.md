---
phase: 3
title: "Vercel project and GitHub production environment"
status: in-progress
priority: P1
effort: 3h
dependencies: [2]
---

# Phase 3: Vercel project and GitHub production environment

## Goal

Terraform owns the Vercel project, its 9 production runtime variables and its custom domain. It also owns the GitHub `production` environment, with the 7 deploy secrets and `PRODUCTION_URL` that `deploy.yml` reads.

## Context

- `vercel_project` supports:
  - `name`, `framework`, `node_version`, `build_command` and `install_command`;
  - `vercel_authentication { deployment_type }`, with the values `standard_protection_new`, `all_deployments`, `only_preview_deployments` and `none`;
  - `auto_assign_custom_domains`, which defaults to `true` and also applies to `vercel deploy --prod`;
  - `resource_config` for function regions. `serverless_function_region` is deprecated.
- `vercel_project_environment_variables` manages a set of `{ key, value, target, sensitive }`. `sensitive = true` makes a write-only Secret.
- `vercel_project_domain` takes `{ project_id, domain }`.
- `vercel.json` stays as-is (`git.deploymentEnabled: false`). No `git_repository` is attached, so pushes never trigger Vercel builds.
- GitHub provider resources: `github_repository_environment`, `github_actions_environment_secret` and `github_actions_environment_variable`.
- The repository must exist before apply (out of scope; `gh repo create`).

## Files to Create / Modify

- Modify: `/home/namnn/src/itcnh1316/infra/secrets.tf`: add these, each with `keepers = { version = var.<name>_version }` so that a reviewed bump in tfvars rotates it:
  - `random_password.session_secret` (length 64, `special = false`);
  - `random_password.rate_limit_salt` (length 48, `special = false`).
- Create: `/home/namnn/src/itcnh1316/infra/vercel.tf`: `vercel_project.app`, `vercel_project_environment_variables.production`, `vercel_project_domain.production`.
- Create: `/home/namnn/src/itcnh1316/infra/github.tf`: `github_repository_environment.production`, a `github_actions_environment_secret` per deploy secret (`for_each` over a sensitive map), and `github_actions_environment_variable.production_url`.
- Modify: `/home/namnn/src/itcnh1316/infra/outputs.tf`: add `vercel_project_id` and `production_url`.
<!-- Updated: Validation Session 1 - Vercel DNS, so no registrar records; Singapore functions -->
- Prerequisite (manual, outside Terraform): buy the domain on Vercel, or point its nameservers at Vercel, under the same team as `vercel_team_id`. With Vercel DNS, attaching the domain to the project configures the records automatically, so no `vercel_dns_record` resources are needed.

## Runtime variables (`target = ["production"]`)

| Key | Value source | Secret |
|---|---|---|
| `SUPABASE_URL` | `local.supabase_url` | no |
| `SUPABASE_PUBLISHABLE_KEY` | `local.supabase_publishable_key` | yes |
| `SUPABASE_SECRET_KEY` | `local.supabase_secret_key` | yes |
| `CLASS_PASSCODE_HASH` | `var.class_passcode_hash` | yes |
| `SESSION_SECRET` | `random_password.session_secret.result` | yes |
| `RATE_LIMIT_SALT` | `random_password.rate_limit_salt.result` | yes |
| `PASSCODE_SESSION_DAYS` | `var.passcode_session_days` | no |
| `NOMINATIM_CONTACT_EMAIL` | `var.nominatim_contact_email` | no |
| `GEOCODE_COUNTRY_CODES` | `var.geocode_country_codes` | no |

The keys must match `src/lib/env.ts` exactly. Add a comment that points at that file.

## GitHub `production` environment

| Name | Kind | Value source |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | secret | `var.supabase_access_token` |
| `SUPABASE_DB_PASSWORD` | secret | `random_password.supabase_db.result` |
| `SUPABASE_PROJECT_ID` | secret | `supabase_project.this.id` |
| `BACKUP_PASSPHRASE` | secret | `var.backup_passphrase` (supplied by hand and kept in the maintainer's password manager) |
| `VERCEL_TOKEN` | secret | `var.vercel_api_token` |
| `VERCEL_ORG_ID` | secret | `var.vercel_team_id` |
| `VERCEL_PROJECT_ID` | secret | `vercel_project.app.id` |
| `PRODUCTION_URL` | variable | `"https://${var.production_domain}"` |

The names stay identical to today's, so the deploy steps in `deploy.yml` need no edits.

## Tasks & Steps

- [x] Write `vercel.tf`:
  - `framework = "nextjs"` and `node_version = "24.x"`, matching `.nvmrc` and `engines`.
  - `vercel_authentication { deployment_type = "standard_protection_new" }`.
  - `resource_config { function_default_regions = [var.vercel_function_region] }`, with `sin1` next to Supabase `ap-southeast-1`.
- [x] Write the environment-variable resource with the table above, then the domain resource.
- [x] Write `github.tf`. Build the secrets map in a `locals` block marked `sensitive`, and iterate over `nonsensitive(toset(keys(local.deploy_secrets)))` so that only names, never values, appear in resource addresses.
- [ ] Apply locally, then re-plan.
- [ ] Confirm that Vercel shows the domain as verified on the project. Vercel DNS needs no manual records.

## Verification

- A second `terraform -chdir=infra plan` reports `No changes`.
- `gh secret list --env production` lists exactly the 7 names. `gh variable list --env production` shows `PRODUCTION_URL`.
- `npx vercel@64.5.0 env ls production --token=…` lists the 9 keys, with credentials shown as Secret. Run it from a shell.
- `curl -sI https://<production_domain>/` resolves with a valid TLS certificate. It returns 404 or an error until the first deploy in phase 4, and that is expected.
- `grep -rnE 'sb_(secret|publishable)_|scrypt:' infra/` finds nothing.

## Risks

- **GitHub environment adoption.** If the `production` environment already exists, `github_repository_environment` uses an idempotent PUT. Confirm the plan shows a create, not a destroy and recreate, before apply.
- **The PAT needs the correct fine-grained permissions.** A 403 on apply names the missing permission. Fix it on the token and do not widen it to the classic `repo` scope.
- **Rotating `SESSION_SECRET` logs every viewer out**, which is the existing documented behavior. Rotation only takes effect after the next deploy, and phase 4's pipeline always deploys after apply.

## Implementation notes (2026-10-24)

- `github_actions_environment_secret` uses `value`; `plaintext_value` is deprecated in provider 6.13.
- Vercel env vars set only `sensitive`; `visibility` is inferred from it.
