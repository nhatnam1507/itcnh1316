---
title: Classmate directory map planned
date: 2026-10-19
summary: Brainstormed and planned a passcode-gated Next.js + Supabase classmate directory; no code yet.
---

# Classmate directory map planned

## What happened

- Turned the request for a cyberpunk classmate-directory map app into a brainstorm contract: `plans/reports/brainstorm-261019-1135-classmate-directory-map.md`.
- Wrote a six-phase plan, `plans/261019-1150-classmate-directory-map/`, which passes `ak plan validate` with 88 tasks.
- The workspace has no app code and is not a git repository yet.

## Decisions

- **No keys in the browser.** All Supabase access goes through Next.js server code. Supabase row-level security (RLS) is a second layer. The secret key is used only after the passcode check.
- **Class passcode gate.** The dashboard is visible to anyone who has the shared passcode. The session is a signed cookie the browser can't read. Pages are marked noindex, and unlock attempts are rate-limited.
- **Only the admin logs in.** Classmates submit change requests without an account. Approval is a single `security definer` database function that locks the request row and stores the old values for audit.
- **Maps.** MapLibre with the keyless OpenFreeMap dark style. Nominatim geocodes addresses on the server, and the admin corrects pins by hand because Vietnamese addresses often geocode poorly.
- **Validation answers.**
  - Phone numbers: Vietnamese mobiles only, normalized to `+84…`.
  - The admin can delete a record after confirming.
  - Local development uses Docker Desktop's WSL integration.
  - The deploy job takes an encrypted database dump before every `db push`.

## Evidence

- Next.js 16.4.2 replaces `middleware.ts` with `proxy.ts`, which runs on the Node runtime. Next's docs say to check authorization inside each server function, not rely on the proxy alone.
- Supabase's `sb_secret_` keys bypass RLS. The legacy anon and service_role keys are being deprecated by the end of 2026.

## Next steps

- Enable Docker Desktop's WSL integration.
- Create the GitHub repository and the Supabase and Vercel projects.
- Run `/ak:cook` on the plan.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
