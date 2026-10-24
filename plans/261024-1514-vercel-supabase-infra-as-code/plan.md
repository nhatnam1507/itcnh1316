---
title: "Vercel and Supabase Infrastructure as Code"
description: "Manage the production Supabase project, the Vercel project and the GitHub production environment with Terraform on HCP Terraform, applied from GitHub Actions before every deploy."
status: pending
priority: P1
effort: 13h
branch: main
tags: [infra, database, security]
blockedBy: []
blocks: []
created: 2026-10-24
---

# Vercel and Supabase Infrastructure as Code

## Overview

Today the following are already code:
- Schema changes, through `supabase/migrations/` and `supabase db push`.
- Build and deploy, through `.github/workflows/deploy.yml`.
- Git deploys being off, through `vercel.json`.

Everything else is set by hand in three dashboards, following `docs/setup-and-deployment.md`:
- The Supabase project and its production Auth and API settings. `supabase/config.toml` configures only the local stack.
- The Vercel project, its build settings, its 9 runtime env vars and its domain.
- The GitHub `production` environment with its 7 secrets and the `PRODUCTION_URL` variable.

This plan moves all of these into a Terraform root module in `infra/`. State lives in HCP Terraform (free tier), and runs use remote execution. A pull request that touches `infra/` gets a speculative plan. Every push to `main` applies the module before the existing backup → migrate → build → deploy job, so the app always deploys against the infrastructure it was written for.

Responsibilities stay split by tool:

| Concern | Owner after this plan |
|---|---|
| Supabase project, Auth and API settings, API keys | Terraform (`supabase/supabase ~> 1.11`) |
| Vercel project settings, env vars, domain | Terraform (`vercel/vercel ~> 5.24`) |
| GitHub `production` environment, deploy secrets, `PRODUCTION_URL` | Terraform (`integrations/github ~> 6.13`) |
| Generated secrets (DB password, session secret, rate-limit salt) | Terraform (`hashicorp/random ~> 3.9`) |
| Database schema | unchanged: `supabase db push` in `deploy.yml` |
| App build and deploy | unchanged: `vercel build` and `vercel deploy --prebuilt` in `deploy.yml` |
| Local stack | unchanged: `supabase/config.toml` |

## Scope decisions (from the user, 2026-10-24)

- **Tooling:** Terraform. State lives in HCP Terraform on the free tier.
- **Surfaces:** Supabase Auth and API settings; the Vercel project and its env vars; the Vercel custom domain; the GitHub environment and its secrets.
- **Environments:** production only. Git deploys stay off, and no preview deployment ever reads production data.
- **Scope mode:** HOLD SCOPE (no `--yagni`).

## Not in scope

- Creating the GitHub repository itself. It must exist before phase 3 applies; create it with `gh repo create`.
- Creating the HCP Terraform organization and workspace. These are a one-time bootstrap, documented in phase 4.
- Supabase branching, preview environments and staging.
- Moving schema migrations into Terraform.
- Buying the domain or delegating it to Vercel DNS. This is done by hand once, and then Vercel configures the records automatically.
- Scheduled drift detection. Drift is reverted on the next push to `main` (validation session 1).

## Phases

| # | Phase | Status | Depends on |
|---|-------|--------|------------|
| 1 | [Terraform foundation and HCP workspace](./phase-01-terraform-foundation.md) | Pending | — |
| 2 | [Supabase project, settings and keys](./phase-02-supabase-resources.md) | Pending | 1 |
| 3 | [Vercel project and GitHub production environment](./phase-03-vercel-and-github-resources.md) | Pending | 2 |
| 4 | [Pipeline wiring, cutover and docs](./phase-04-pipeline-cutover-and-docs.md) | Pending | 3 |

Phases are sequential. Phase 3 consumes phase 2's project ref and API keys, and phase 4 wires the finished module into CI.

```text
PR touching infra/ ──► infra-plan.yml: fmt -check → init → validate → speculative plan (HCP)

push to main ──► deploy.yml
                  ci (ci.yml)
                   └─► infra: terraform apply (HCP remote run)
                         writes Supabase settings, Vercel project + env, GitHub env secrets
                        └─► deploy (reads the fresh production secrets)
                              backup → db push → vercel pull/build → scan → deploy → smoke
```

## Success Criteria

- [ ] `terraform -chdir=infra fmt -check -recursive` and `terraform -chdir=infra validate` pass. The provider lock file is committed.
- [ ] A PR that touches `infra/` shows a speculative HCP plan in the `Infra plan` check.
- [ ] After the first apply, a second `terraform plan` reports `No changes`.
- [ ] Production Supabase refuses `POST /auth/v1/signup`, matching the local stack. `password_min_length` is 12.
- [ ] Every one of the 9 runtime variables in `src/lib/env.ts` is set by Terraform on the Vercel project. Credentials use the Secret type, and nothing is entered by hand in the Vercel dashboard.
- [ ] The GitHub `production` environment holds the 7 deploy secrets and `PRODUCTION_URL`, all written by Terraform. The only hand-set GitHub secret is the repository secret `TF_API_TOKEN`.
- [ ] A push to `main` runs infra apply → backup → migrate → build → scan → deploy → smoke test, and the smoke test passes on the custom domain.
- [ ] `docs/setup-and-deployment.md` describes the Terraform bootstrap, where each value lives, and rotation through Terraform. No step tells the operator to edit a Terraform-managed setting in a dashboard.
- [ ] No secret value appears in any committed file or in any workflow log.

## Red Team Review (inline, 2026-10-24)

The four personas reviewed the plan inline, since this plan is small and sequential.

| Persona | Concern | Resolution |
|---|---|---|
| Assumptions | `vercel pull` may not download Secret-type values, so the bundle scan's literal-value check could silently weaken. | Phase 4 checks this empirically. If the values don't download, the scan reads them from a sensitive Terraform output instead. Phase 4 has a step for this. |
| Assumptions | The name of the default Supabase secret key, and whether `supabase_apikey` can create a secret-type key, are not documented. | Tagged `[UNVERIFIED]` in phase 2, with a probe step to resolve it before Vercel consumes the key. |
| Failure | Manual dashboard edits drift from state, then get silently reverted on the next apply. | The docs state that Terraform owns these settings, and the rotation runbooks go through Terraform. The `No changes` re-plan proves convergence. |
| Failure | A newer push could slip its infra apply between an older run's apply and that run's deploy. | Phase 4 moves `concurrency: production-deploy` to workflow level in `deploy.yml`. |
| Scope | Rewriting `deploy.yml` deploy steps is unnecessary churn. | Only one job is added and concurrency moves to workflow level. The deploy steps are unchanged. |
| Security | HCP state holds every secret. Speculative PR plans run PR code with workspace credentials. | The HCP workspace is restricted to the maintainer. Fork PRs receive no `TF_API_TOKEN`. The GitHub PAT is fine-grained and limited to one repository, and phase 4 documents this boundary. |
| Security | Losing HCP access would lose the backup passphrase if Terraform generated it. | The passphrase is supplied by hand and also kept in the maintainer's password manager (validation session 1). |

## Validation Log

### Session 1 — 2026-10-24

#### Verification Results

- **Claims checked:** 14. **Verified:** 12. **Failed:** 0. **Unverified:** 2. **Tier:** Standard.
- Checked against live sources:
  - The provider and tool versions: the Terraform registry, GitHub releases and the HashiCorp checkpoint API.
  - Every Supabase Auth and PostgREST field name in phase 2: the Management API OpenAPI spec.
  - The schemas for `supabase_project`, `supabase_settings`, `supabase_apikey` and `data.supabase_apikeys`.
  - The `vercel_project`, `vercel_project_environment_variables` and `vercel_project_domain` attributes, and the `vercel_authentication` values.
  - Local `supabase` CLI 2.121.0.
  - The env var names and rules in `src/lib/env.ts`.
  - The secret names in `deploy.yml`.
  - That `vitest.config.mts` includes `scripts/**/*.test.ts`.
- **Unverified, with probe steps in the plan:**
  - The default Supabase secret key's name, and whether `supabase_apikey` can mint a secret-type key (phase 2).
  - Whether `vercel pull` downloads Secret-type values for the bundle scan (phase 4, with a fallback).

#### Decisions

| Question | Decision | Phases affected |
|---|---|---|
| Do the projects exist? | Neither does. Terraform creates both, with a generated DB password and no imports. | 2, 3 |
| Domain and DNS | The domain is on Vercel DNS. It is attached by `vercel_project_domain`, and no manual records are needed. | 3, 4 |
| Regions | Supabase `ap-southeast-1` and Vercel functions `sin1`. | 1, 2, 3 |
| Backup passphrase | Supplied by hand as an HCP variable and also kept in a password manager. | 1, 3 |
| Drift detection | None scheduled. Apply on every deploy reverts drift. | 4 (not added) |
| Parity of Auth settings and `config.toml` | Yes. The values live in `infra/supabase-settings.json`, checked by the Vitest test `scripts/supabase-settings-parity.test.ts`, using `smol-toml@1.9.1` as a dev dependency. | 2, 4 |

#### Whole-Plan Consistency Sweep

- Searched every plan file for "validation question", "pending", "adopted" and "registrar". No stale conditional remains. The red-team table rows that pointed at questions now state the decisions.
- Region values match across the phase 1 tfvars, the phase 2 `supabase_project` and the phase 3 `resource_config`.
- The backup passphrase source matches across the phase 1 inputs, the phase 3 GitHub secrets and the red-team table.
- The parity test file path matches the `vitest.config.mts` include glob. The JSON settings file is referenced the same way in phase 2 and phase 4.
- No contradictions are unresolved.
