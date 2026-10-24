---
title: "Terraform owns Vercel, Supabase and GitHub production"
date: 2026-10-24
summary: "infra/ module, CI plan/apply wiring and docs landed; HCP bootstrap and first apply still need the maintainer's accounts"
---

# Terraform owns Vercel, Supabase and GitHub production

## What happened

Executed plan `261024-1514-vercel-supabase-infra-as-code`. All repository-side work is done and pushed to the new public repo `nhatnam1507/itcnh1316`:

- `infra/` root module (Terraform 1.17.0, HCP workspace `classmate-directory-production` in org `nhatnam1507`): Supabase project, settings and managed server key; Vercel project, 9 runtime vars and domain; GitHub `production` environment with 7 secrets and `PRODUCTION_URL`.
- `scripts/supabase-settings-parity.test.ts` keeps `infra/supabase-settings.json` equal to `supabase/config.toml` (proved by flipping `minimum_password_length`).
- `infra-plan.yml` (speculative plan on PRs) and an `infra` apply job in `deploy.yml`, with concurrency moved to workflow level.

## Decisions

- Both plan `[UNVERIFIED]` items were resolved from evidence instead of live probes. In provider source, `supabase_apikey` always creates a secret-type `service_role` key, so rotation is `-replace`. The Vercel schema says sensitive vars cannot be read back, so the deploy scan reads a `scan_literals` sensitive output and fails on empty values.
- `prevent_destroy` on `supabase_project`; the production data lives there.
- The repo is public because GitHub Free private repos lack environment secrets. Consequences: Actions artifacts (the encrypted backups) are world-downloadable, so `backup_passphrase` must be random.
- `.claude/` is ignored. Commits use the GitHub noreply email.

## Verification

`terraform fmt -check` and `validate` passed, and a mock-provider `terraform test` (scratch, 7 runs) applied the graph and rejected bad inputs. `npm test` (123), lint, typecheck and actionlint passed.

## Next steps

Create the HCP workspace and its 5 sensitive variables, then fill the 4 commented values in `production.auto.tfvars`. Buy the domain on Vercel, set `TF_API_TOKEN`, run the first apply locally, re-plan to `No changes`, push, and create the first admin.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
