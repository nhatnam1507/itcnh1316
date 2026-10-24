---
title: "Phase 6: CI/CD and Release Checks"
status: todo
priority: P1
effort: 6h
dependencies: [1, 2, 3, 4, 5]
---

# Phase 6: CI/CD and Release Checks

## Overview

Set up the GitHub Actions workflows:
- **On pull requests:** lint, typecheck, unit tests, pgTAP tests against a local Supabase stack, the build, the client-bundle key scan, and Playwright end-to-end tests.
- **On pushes to `main`:** apply Supabase migrations and deploy the prebuilt app to Vercel production.

Also document setup, secrets, first-admin seeding, and passcode rotation.

## Key Insights

- GitHub-hosted Ubuntu runners have Docker, so CI can run `supabase start`, `supabase test db`, and Playwright against the seeded local stack. This covers the gap left by Docker not being available locally.
- Deploying with `vercel pull`, `vercel build --prod`, and `vercel deploy --prebuilt --prod` lets the bundle scan check the exact artifact that ships.
- Turning off Vercel's own Git deploys (`vercel.json` with `git.deploymentEnabled: false`) means only Actions deploys. No preview deployment ever reaches production data.
- Project rule: back up before any schema change. The deploy job takes an encrypted schema-and-data dump before every `db push`.

## Requirements

- [ ] `scripts/check-client-bundle.mjs` scans `.next/static/**` and Vercel's `.vercel/output/static/**`. It fails on:
  - the patterns `sb_secret_`, `sb_publishable_`, `supabase.co`, and `eyJhbGciOi` (a JWT header);
  - the literal value of any env var listed in `SCAN_SECRET_ENV_NAMES` that is set in the job.
  - It prints only the file path and the pattern name, never the matched value.
- [ ] `e2e/` Playwright tests, run against `next start` with the local Supabase stack and seed data:
  - **gate:** `/` redirects to `/unlock`. A wrong passcode shows an error, and the correct one shows the dashboard.
  - **dashboard:** hovering a pin fills the intel panel, and the roster count equals the number of seeded people.
  - **network:** across the whole session, no request goes to a host other than the app or `tiles.openfreemap.org`. In particular, none goes to `*.supabase.co` or to the local Supabase port.
  - **change request:** submitting a request makes it appear in the admin queue. Approving it updates the dossier. Uses a test admin created in the seed script for the local stack only.
- [ ] `.github/workflows/ci.yml`, triggered on `pull_request` and on `push` to `main`:
  1. Set up Node from `.nvmrc` with an npm cache, then run `npm ci`.
  2. Run lint, typecheck, and unit tests.
  3. Start Supabase (`npx supabase start`), then run `npx supabase db lint` and `npx supabase test db`.
  4. Build with env vars pointing at the local stack, using throwaway CI-only values.
  5. Run `npm run scan:bundle`.
  6. Run `npx playwright install --with-deps chromium`, then the e2e tests.
  7. Upload the Playwright report as an artifact when the run fails.
- [ ] `.github/workflows/deploy.yml`, triggered on `push` to `main` with `needs: ci` (use a `workflow_run` trigger or a combined workflow):
  - Uses GitHub environment `production`, which holds the deploy secrets. There is no manual approval gate.
  - **Backup:** <!-- Updated: Validation Session 1 - encrypted dump in workflow -->
    1. Run `npx supabase db dump --linked -f schema.sql`, then `npx supabase db dump --linked --data-only -f data.sql`.
    2. Combine them into `tar czf` and encrypt with `gpg --batch --symmetric --cipher-algo AES256 --passphrase-fd 0`, reading the `BACKUP_PASSPHRASE` secret from stdin.
    3. Upload only the `.gpg` file with `actions/upload-artifact`, using `retention-days: 7`. Delete the plaintext files in the same step.
    4. If the backup step fails, the job stops before `db push`.
  - **Migrate:** `npx supabase link --project-ref $SUPABASE_PROJECT_ID`, then `npx supabase db push`.
  - **Build:** `npx vercel pull --yes --environment=production`, then `npx vercel build --prod`, then `npm run scan:bundle` on the prebuilt output.
  - **Deploy:** `npx vercel deploy --prebuilt --prod`.
  - Smoke test: `curl` the production URL and expect a redirect to `/unlock` and the `X-Robots-Tag` header.
- [ ] `vercel.json` with `{"git": {"deploymentEnabled": false}}`.
- [ ] `concurrency: production-deploy` so only one deployment runs at a time.
- [ ] GitHub secrets (names only in docs):
  - Supabase: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID`.
  - Backup: `BACKUP_PASSPHRASE`.
  - Vercel: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
  - App runtime variables live in Vercel project settings, not GitHub.
- [ ] Docs:
  - `docs/setup-and-deployment.md` covers:
    - local setup;
    - every env var and where it lives;
    - generating the passcode hash;
    - creating the first admin (create a user in the Supabase Auth dashboard, then `insert into public.admins`);
    - rotating the passcode and session secret;
    - restoring a backup (download the artifact, `gpg --decrypt`, then `psql` the schema and data files against the project);
    - responding to a leaked secret key (rotate it in Supabase).
  - `docs/architecture.md` covers the request flow, the security boundary, the data model, and the approval transaction.

## Related Code Files

Create:
- `scripts/check-client-bundle.mjs`
- `e2e/gate.spec.ts`, `e2e/dashboard.spec.ts`, `e2e/network-isolation.spec.ts`, `e2e/change-request.spec.ts`
- `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
- `vercel.json`
- `docs/setup-and-deployment.md`, `docs/architecture.md`

Modify:
- `supabase/seed.sql` (add the local-only test admin user and its `admins` row)
- `playwright.config.ts` (`webServer` runs `npm run start` with the local env)

## Implementation Steps

1. Write the bundle scan script. Prove it works by temporarily adding a fake `sb_secret_test` string to a client component, confirming the scan fails, then removing the string.
2. Write the Playwright specs and configuration, and extend the seed with a test admin for the local stack only.
3. Write `ci.yml` and confirm it passes on a first pull request.
4. Write `deploy.yml` and `vercel.json`. Set up the GitHub `production` environment and its secrets.
5. Write the two docs files and check every command and env name against the source.

## Todo

- [ ] Write the bundle scan script and its negative check.
- [ ] Write the Playwright e2e specs, including network isolation.
- [ ] Write the CI workflow.
- [ ] Write the deploy workflow, `vercel.json`, and production environment.
- [ ] Write the setup, deployment, and architecture docs.

## Success Criteria

- A pull request run shows lint, typecheck, unit, `db lint`, pgTAP, build, scan, and e2e all passing.
- Merging to `main` runs the backup step, `supabase db push`, the scan on the prebuilt output, and the Vercel production deploy. The smoke test passes.
- A deliberately leaked `sb_secret_` string makes CI fail at the scan step without printing the value.

## Risk Assessment

- **Supabase CLI start-up time in CI** is about 1–2 minutes. Exclude unused services in `config.toml`, such as Studio, Inbucket, and Storage.
- **`supabase db push` could fail partway.** Migrations run in a transaction per file. Recover by restoring the backup from the backup step and pushing a forward-fix migration.
- **The e2e map hover test can be flaky on WebGL.** Use a headless Chromium with SwiftShader, and hover pins by projecting their known coordinates with `map.project` through a test hook. If that remains flaky, use the roster-to-panel path as the fallback.

## Security Considerations

- Logs never print secrets. The scan reports pattern names only.
- The backup artifact contains classmate personal data. It is uploaded only after encryption, and it expires after 7 days.
- Fork pull requests don't get production secrets, because the deploy runs only on pushes to `main`.
- Seed data and the test admin live only in the local stack. `supabase db push` never applies `seed.sql`.
