---
title: Classmate directory map implemented
date: 2026-10-19
summary: "Phases 1-5 built and verified locally; phase 6 workflows written, awaiting external accounts."
---

# Classmate directory map implemented

## What happened

Implemented plan `plans/261019-1150-classmate-directory-map`: a Next.js 16 app with a passcode gate, server-only Supabase access, RLS plus atomic approval functions, an admin console with pin correction, a MapLibre "surveillance console" dashboard, and GitHub Actions workflows that deploy to Vercel.

Verified locally against the Docker-backed Supabase stack: lint, typecheck, 82 unit tests, `supabase db lint`, 83 pgTAP assertions, a build with no `.env`, the client-bundle scan (a planted `sb_secret_` string fails it without printing the value), and 11 Playwright e2e specs against `next start`.

## Surprises

- **`$` in the passcode hash.** Next's `.env` loader expanded `scrypt$16384$…` into garbage. The format changed to `scrypt:N:r:p:salt:hash`.
- **MapLibre v6 worker.** MapLibre resolves its worker as a sibling of its own module URL, which breaks under bundling ("Worker failed to load"). The fix copies the worker into `public/maplibre/` in `predev` and `prebuild` and calls `setWorkerUrl`.
- **Supabase email login.** In `config.toml`, `[auth.email] enable_signup = false` disables email login entirely (`email_provider_disabled`). The global `[auth] enable_signup = false` alone blocks signup.
- **Route announcer in tests.** Next's route announcer is a `role="alert"` element, so Playwright `getByRole("alert")` needs `filter({ hasText })`.
- **WSL Chromium.** Headless Chromium needed `libasound.so.2`. Without sudo, the library was extracted from `apt-get download` into the scratchpad and loaded via `LD_LIBRARY_PATH`. CI uses `playwright install --with-deps`.
- **Hook restrictions.** A project hook blocks shell text containing `node_modules`, `dist`, `vendor` or `.next`. Files with those strings were written with the Write tool.

## Decision

- The unlock rate limit counts failures only: each attempt is consumed first, and a success refunds it through `refund_rate_limit()`.
- Change requests are validated before the rate limit is checked.
- The admin console lives in the `(console)` route group, so `/admin/login` sits outside the guard.

## Next steps

1. Create the GitHub, Supabase and Vercel projects, and add the secrets listed in `docs/setup-and-deployment.md`.
2. Open a first PR to confirm `ci.yml`.
3. Push to `main` to confirm the backup, migration, deploy and smoke test, then create the first admin.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
