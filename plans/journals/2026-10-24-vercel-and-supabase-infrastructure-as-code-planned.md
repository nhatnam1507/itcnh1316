---
title: Vercel and Supabase infrastructure-as-code planned
date: 2026-10-24
summary: "Planned a Terraform module on HCP Terraform that owns the Supabase project, Vercel project and GitHub production environment, applied before every deploy."
---

# Vercel and Supabase infrastructure-as-code planned

## What happened
Planned how to move the production platform settings that are still set by hand into code. The plan is in `plans/261024-1514-vercel-supabase-infra-as-code/`. Migrations, the deploy workflow and `vercel.json` were already code. The Supabase Auth settings, the Vercel project with its 9 runtime env vars and domain, and the GitHub `production` environment secrets were dashboard-only.

## Decision
- Terraform 1.17 with HCP Terraform (free tier) state and remote execution, using these providers: `vercel/vercel ~> 5.24`, `supabase/supabase ~> 1.11`, `integrations/github ~> 6.13` and `hashicorp/random ~> 3.9`.
- Production only, with Supabase in `ap-southeast-1` and Vercel functions in `sin1`. The domain is on Vercel DNS, and both projects are created fresh by Terraform.
- The DB password, session secret and rate-limit salt are generated. The passcode hash and backup passphrase are supplied by hand as HCP variables. `TF_API_TOKEN` is the only GitHub secret set by hand.
- The production Auth settings live in `infra/supabase-settings.json`, and a Vitest parity test keeps them equal to `supabase/config.toml`.
- `deploy.yml` gains an `infra` apply job between `ci` and `deploy`, with concurrency at workflow level. PRs get a speculative plan from `infra-plan.yml`.
- Every Supabase Management API field name in the plan was verified against the OpenAPI spec.

## Next steps
- Resolve two probes during cooking: the Supabase secret-key selection, and whether `vercel pull` downloads Secret-type values for the bundle scan.
- Create the GitHub repository and the HCP workspace before phase 1 and phase 3 apply.
- Run `/ak:cook plans/261024-1514-vercel-supabase-infra-as-code/plan.md`.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
