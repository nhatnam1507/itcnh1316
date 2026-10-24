---
title: "Classmate Directory Map"
description: "Passcode-gated Next.js + Supabase classmate phone directory with a cyberpunk map dashboard, admin-reviewed change requests, and GitHub Actions deploys to Vercel."
status: in-progress
priority: P1
effort: 40h
branch: main
tags: [feature, frontend, backend, database, auth, infra]
blockedBy: []
blocks: []
created: 2026-10-19
---

# Classmate Directory Map

## Overview

Build a greenfield Next.js 16 app that serves as the class phone directory.
- **Dashboard:** a MapLibre map with one pin per classmate. Hovering a pin fills the left panel with that classmate's details. The right panel lists every classmate.
- **Admin:** the admin logs in to create and edit records, correct pins, and approve or reject change requests.
- **Change requests:** visitors who know the class passcode submit change requests without logging in.

All Supabase access runs on the server. The browser never receives a Supabase URL or key, or any other key.

Source contract: [brainstorm report](../reports/brainstorm-261019-1135-classmate-directory-map.md).

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | No Supabase URL or key, and no map or geocoding key, reaches the browser bundle or network log | P1 |
| 2 | Every page, data route, and server action requires a valid class-passcode session | P1 |
| 3 | Only the admin can change records. Approval is atomic and keeps the old values for audit | P1 |
| 4 | Map dashboard with hover detail (left) and full list (right), in the cyberpunk theme | P1 |
| 5 | GitHub Actions gates every PR and deploys `main` to Vercel production | P1 |

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Project Foundation](./phase-01-start.md) | Pending |
| 2 | [Database Schema and RLS](./phase-02-database-schema-and-rls.md) | Pending |
| 3 | [Server Data Layer and Passcode Gate](./phase-03-server-data-layer-and-passcode-gate.md) | Pending |
| 4 | [Admin Console](./phase-04-admin-console.md) | Pending |
| 5 | [Dashboard and Change Requests](./phase-05-dashboard-and-change-requests.md) | Pending |
| 6 | [CI/CD and Release Checks](./phase-06-ci-cd-and-release-checks.md) | Pending |

Phase order: 1 → 2 → 3. Phases 4 and 5 both depend on phase 3 and can run in either order. Phase 6 depends on all earlier phases.

## Dependencies

- **External accounts:** a GitHub repository, a Supabase project (free tier is enough), and a Vercel project. Each needs secrets added to its encrypted settings.
- **Third-party services:**
  - OpenFreeMap style `https://tiles.openfreemap.org/styles/dark`: no key. Show OpenStreetMap attribution.
  - Nominatim search API: called only from the server, about one request per second at most, with an identifying User-Agent.
- **Local tools:** Node 26 and npm 11 are present. Docker is not available in this WSL distro yet; enable Docker Desktop's WSL integration before phase 2 so the local Supabase stack runs.
- **Versions checked on 2026-10-19:**
  - `next@16.4.2`. Next.js 16 replaces `middleware.ts` with `proxy.ts`, which runs on the Node runtime.
  - `@supabase/supabase-js@2.118.0`, `@supabase/ssr@0.12.7`, `maplibre-gl@6.15.0`, and the `supabase` CLI `2.121.0`.

## Success Criteria

- [ ] CI's bundle scan finds no Supabase URL, `sb_publishable_` or `sb_secret_` key, JWT, or configured secret value in `.next/static`. The Playwright test sees no browser requests to `*.supabase.co`.
- [ ] Without the passcode cookie, every route redirects to `/unlock` or returns 401, and no classmate data appears in the response. Responses carry `X-Robots-Tag: noindex, nofollow`.
- [ ] pgTAP tests prove that the anon and authenticated non-admin roles cannot read or write any table. Admin approval updates the record and the request in one transaction and stores the old values.
- [ ] Every person with coordinates has a pin. Hovering or tapping a pin fills the left panel, and the right panel lists every person.
- [ ] A PR run executes lint, typecheck, unit, pgTAP, build, bundle scan, and e2e checks. A push to `main` applies migrations and deploys to Vercel production.

## Validation Log

### Session 1 — 2026-10-19

#### Verification Results

- **Claims checked:** 9. **Verified:** 9. **Failed:** 0. **Unverified:** 0. **Tier:** Full.
- This is a greenfield repo, so the checks covered external facts, not existing code:
  - Next.js 16 `proxy.ts` on the Node runtime, and Next's guidance to check authorization inside server functions.
  - Supabase's `sb_secret_` and `sb_publishable_` key types, that the secret key bypasses RLS, and that the legacy keys are being deprecated.
  - The OpenFreeMap dark style URL returns HTTP 200.
  - Current package versions from npm.
  - The local toolchain: Node 26 and `gh` are present, while Docker, the Supabase CLI, and the Vercel CLI are absent.

#### Decisions

| Question | Decision | Phases affected |
|---|---|---|
| Phone format | Vietnamese mobile numbers only, normalized to `+84…` | 2, 3 |
| Admin delete | Yes, behind a type-the-name confirmation; deletes the person's requests too | 3, 4 |
| Local development | Enable Docker Desktop's WSL integration and run the full local Supabase stack | 1, 2 |
| Production backup | Encrypted schema-and-data dump kept as a 7-day workflow artifact before each `db push` | 6 |

#### Whole-Plan Consistency Sweep

- Searched every plan file for leftover "decided in validation" or "if confirmed" placeholders; none remain.
- The phone format is consistent across the DB CHECK in phase 2, the zod schema and tests in phase 3, and the form in phase 4.
- Delete is consistent across the FK cascade in phase 2, the service in phase 3, and the UI in phase 4.
- Backup is consistent across the deploy steps, secrets, docs, and security notes in phase 6.
- No contradictions are unresolved.

## Implementation Notes — 2026-10-19

Phases 1–5 are implemented and verified locally (all checkboxes checked through `ak plan check`; the phases table above and the phase `status:` fields are not rewritten by the CLI). Phase 6 code is complete; its remaining items need the external accounts.

Verified locally against the Docker-backed Supabase stack: lint, typecheck, 82 unit tests, `supabase db lint`, 83 pgTAP assertions, a production build with no `.env`, the bundle scan (including a planted `sb_secret_` negative check), and 11 Playwright e2e specs against `next start`.

Deviations from the phase text, each for a verified reason:

- **Passcode hash format** is `scrypt:N:r:p:saltB64:hashB64`, not `scrypt$…`. Next's `.env` loader expands `$…`, which corrupted the hash.
- **Unlock rate limit counts only failures** through a new `refund_rate_limit()` function. Every attempt is consumed first, and a correct passcode refunds its slot, so a shared network (a class reunion) is not locked out and parallel guesses still cannot overshoot.
- **Change requests validate before the rate limit**, so a typo does not use up one of the five hourly requests. Invalid input never writes anything.
- **Admin routes use a route group**, `src/app/admin/(console)/`, so `/admin/login` sits outside the admin guard.
- **The local test admin** was added to `seed.sql` during phase 4, not phase 6, so admin flows could be verified.
- **`[auth.email] enable_signup` stays `true`.** In this CLI version, setting it to `false` disables email login entirely. The global `[auth] enable_signup = false` still blocks self-signup, as verified with a refused `/auth/v1/signup` call.
- **MapLibre v6 worker.** As the phase 4 risk anticipated, worker loading broke under bundling. `scripts/copy-maplibre-worker.mjs` (run by `predev` and `prebuild`) copies the worker into `public/maplibre/`, and `setWorkerUrl` points at it.
- **Map labels prefer `name:latin`.** The OpenFreeMap fonts have no Lao, Khmer or Han glyphs.
- **CI layout.** `ci.yml` runs on pull requests and through `workflow_call`. `deploy.yml` runs on push to `main` and calls CI before its deploy job.

Remaining for phase 6:
- Create the GitHub repository, the Supabase project and the Vercel project, then add the secrets listed in `docs/setup-and-deployment.md`.
- Confirm `ci.yml` passes on a first pull request.
- Confirm the first push to `main` runs the backup, migrations, prebuilt deploy and smoke test.
- Create the first admin.
