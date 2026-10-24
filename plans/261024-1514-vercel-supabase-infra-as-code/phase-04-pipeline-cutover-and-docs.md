---
phase: 4
title: "Pipeline wiring, cutover and docs"
status: in-progress
priority: P1
effort: 4h
dependencies: [3]
---

# Phase 4: Pipeline wiring, cutover and docs

## Goal

GitHub Actions plans infrastructure on pull requests and applies it on `main` before the existing deploy job. The first full pipeline run succeeds, and the docs describe Terraform as the owner of every production setting.

## Context

- `ci.yml` runs on `pull_request` and through `workflow_call` from `deploy.yml`. Infra planning goes in a separate workflow, so the deploy's CI call doesn't plan twice.
- `deploy.yml` currently sets `concurrency: production-deploy` on the deploy job only.
- `hashicorp/setup-terraform@v4` accepts `cli_config_credentials_token` and `terraform_version`. With the `cloud` block, `plan` and `apply` run remotely, and their output streams into the Actions log.
- Every value in the workspace is sensitive and redacted in run output.

## Files to Create / Modify

- Create: `/home/namnn/src/itcnh1316/.github/workflows/infra-plan.yml`:
  - Triggers: `pull_request` with `paths: [infra/**, .github/workflows/infra-plan.yml]`, plus `workflow_dispatch`.
  - `permissions: contents: read`.
  - Steps: checkout, setup-terraform (1.17.0, `TF_API_TOKEN`), `fmt -check -recursive`, `init -input=false`, `validate`, then `plan -input=false`.
  - The plan step is skipped when `TF_API_TOKEN` is empty (fork PRs), and the `fmt` and `validate` steps still run.
- Modify: `/home/namnn/src/itcnh1316/.github/workflows/deploy.yml`:
  - Add an `infra` job (`needs: ci`) that runs `terraform -chdir=infra init -input=false` and `terraform -chdir=infra apply -input=false -auto-approve`.
  - Make `deploy` depend on `[ci, infra]`.
  - Move `concurrency: { group: production-deploy, cancel-in-progress: false }` from the job to the workflow level, so one run's apply and deploy can't interleave with another run's.
  - Update the job name to cover the infra job.
- Modify (only if the probe below fails): `/home/namnn/src/itcnh1316/.github/workflows/deploy.yml` scan step, and `/home/namnn/src/itcnh1316/infra/outputs.tf`.
- Modify: `/home/namnn/src/itcnh1316/docs/setup-and-deployment.md`: the configuration reference, first-time setup, the CI and deploy pipeline, rotation runbooks and the secret-leak runbook.
- Modify: `/home/namnn/src/itcnh1316/docs/architecture.md`: add a short "Infrastructure" section with the ownership table from `plan.md`, and link to `infra/`.

## Tasks & Steps

- [ ] Add the repository secret `TF_API_TOKEN`, an HCP team token limited to this workspace. It is the only GitHub secret set by hand.
- [ ] Write `infra-plan.yml` and open a PR that touches `infra/`. Confirm the `Infra plan` check shows the speculative plan.
- [x] Change `deploy.yml` as described above.
- [x] **Probe `vercel pull` with Secret variables.** In the first deploy run, check that the scan step loads non-empty values from `.vercel/.env.production.local`. Print only `[ -n "$SUPABASE_SECRET_KEY" ] && echo present`, never the value.
  - If the Secret values are missing, add a sensitive output `scan_literals` (the Secret runtime values) to `outputs.tf`.
  - In that case, the scan step reads them through `terraform output -json scan_literals`, masks each one with `::add-mask::`, and exports them before calling `scripts/check-client-bundle.mjs`.
- [ ] Merge to `main` and watch the run. Infra apply must report no changes, or only the expected ones. Then backup, migrate, build, scan, deploy and the smoke test must all pass on `https://<production_domain>`.
- [ ] Create the first admin as before, following the existing doc step. Users are data, not infrastructure.
- [x] Rewrite the docs:
  - **First-time production setup:**
    1. Create the accounts and tokens (Supabase access token, Vercel token, fine-grained GitHub PAT, HCP workspace).
    2. Set the workspace variables, including the passcode hash from `node scripts/hash-passcode.mjs`.
    3. Fill in `infra/production.auto.tfvars`.
    4. Set the GitHub secret `TF_API_TOKEN`.
    5. Buy or delegate the domain on Vercel, push to `main`, and create the first admin.
  - **Configuration reference:** change the "Where it lives" column to name Terraform and the source of each value (generated, derived, or an HCP variable). State that production Auth settings come from `infra/supabase-settings.json`, which the parity test keeps equal to `supabase/config.toml`.
  - **Rotation:**
    - Passcode: update `class_passcode_hash` in HCP, then rerun Deploy.
    - Session secret or rate-limit salt: bump `session_secret_version` or `rate_limit_salt_version` in a PR.
    - Supabase secret key leak: use whichever path phase 2 chose (`-replace`, or rotate in the dashboard and re-apply).
  - **A warning that dashboard edits to Terraform-managed settings get reverted on the next deploy.**

## Verification

- `actionlint .github/workflows/*.yml` passes if the tool is available. Otherwise, a PR run of both workflows starts without a YAML error.
- The Deploy run's job order is `ci` → `infra` → `deploy`, all green, and the smoke step prints `Smoke test passed.`
- A second Deploy run, with no infra change, shows `No changes.` in the infra job.
- `grep -nE 'dashboard|by hand' docs/setup-and-deployment.md` returns only steps that are still manual: account creation, HCP variables, buying or delegating the domain on Vercel, and the first admin.
- The secret-masking check: searching the downloaded Deploy logs for the first 8 characters of `SESSION_SECRET` finds nothing.

## Risks

- **An infra apply fails after CI passes.** The deploy job never starts, so production stays on the previous app and configuration. Fix forward in a PR.
- **A bad Terraform change breaks production config**, for example a wrong env value. Revert the commit; the next push re-applies the previous values and redeploys.
- **HCP is unavailable.** Deploys block. The emergency path is `vercel deploy` and `supabase db push` from a workstation with the GitHub-held secrets, followed by a re-apply. Document this in one paragraph.
- **The PR plan runs PR code with workspace credentials.** Acceptable for a one-maintainer private repository. Document that only trusted collaborators should get write access.

## Implementation notes (2026-10-24)

- **Probe resolved from the provider schema:** Vercel describes a sensitive variable as one that "cannot be read via the API or Vercel Dashboard once set", so `vercel pull` cannot download it. The fallback is implemented: the `scan_literals` sensitive output, and a deploy scan step that reads it, masks each value, and fails on an empty value instead of silently weakening the scan.
- `actionlint` 1.7.12 passes on all workflows.
- The repository is **public** (user decision; GitHub Free private repos cannot use environment secrets). This replaces the "private repository" assumption in the risks above: fork PRs still get no secrets, but Actions logs and the encrypted backup artifacts are world-readable, so the docs require a random `backup_passphrase`.
- Open: `TF_API_TOKEN`, the first PR plan, the first green Deploy run, and the first admin.
