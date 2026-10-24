---
title: "Phase 1: Project Foundation"
status: todo
priority: P1
effort: 5h
dependencies: []
---

# Phase 1: Project Foundation

## Overview

Scaffold the Next.js 16 TypeScript app at the repository root and set up git, the quality tools, and validated server-only configuration. Also add the base cyberpunk theme tokens and global response headers that keep pages out of search indexes.

Context: [plan](./plan.md) and [brainstorm contract](../reports/brainstorm-261019-1135-classmate-directory-map.md).

## Key Insights

- The workspace is not yet a git repository and has no app code. `.agentkit/` and `.claude/` already exist, so the app is scaffolded beside them; they are not part of it.
- Next.js 16 uses `src/proxy.ts`, not `middleware.ts`, and it runs on the Node runtime.
- Any env var with the `NEXT_PUBLIC_` prefix is inlined into the browser bundle. This project defines none. A lint rule and the CI scan in phase 6 enforce that.
- `next build` must succeed without secrets, so env vars are validated lazily when first used, not when modules load.

## Requirements

- [x] Prerequisite: Docker Desktop's WSL integration is enabled, and `docker info` works in this distro. Local Supabase needs it from phase 2 onward. <!-- Updated: Validation Session 1 - local dev via Docker Desktop WSL -->
- [x] Next.js 16 App Router, TypeScript strict mode, `src/` layout, npm.
- [x] ESLint with a restricted-syntax rule that fails on any `process.env.NEXT_PUBLIC_*` reference.
- [x] Vitest for unit tests and Playwright for end-to-end tests. The Playwright specs are written in phase 6.
- [x] `src/lib/env.ts` validates server env vars with zod and imports `server-only`.
- [x] `.env.example` lists every variable name with no values. `.gitignore` covers `.env*` except `.env.example`.
- [x] Theme tokens in `src/app/globals.css`:
  - Near-black background with neon cyan and green accents, a magenta alert color, and monospace type.
  - Scanline overlay and glitch utility classes.
  - All motion disabled under `prefers-reduced-motion: reduce`.
- [x] `next.config.ts` sends these headers on every route: `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: same-origin`, `X-Content-Type-Options: nosniff`, and `Content-Security-Policy: frame-ancestors 'none'`.
- [x] `src/app/robots.ts` disallows all crawlers.

## Related Code Files

Create, relative to `/home/namnn/src/itcnh1316`:
- `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.ts`, `playwright.config.ts`
- `.gitignore`, `.env.example`, `.nvmrc` (pins Node 24 LTS for CI and Vercel)
- `src/lib/env.ts`
- `src/app/layout.tsx`, `src/app/globals.css`, `src/app/robots.ts`
- `src/lib/env.test.ts`

## Implementation Steps

1. Run `git init -b main`.
2. Scaffold with `npx create-next-app@16.4.2 . --ts --app --src-dir --eslint --no-tailwind --import-alias "@/*" --use-npm`.
   - Keep the existing `.agentkit/` and `.claude/` folders untouched.
   - Use plain CSS custom properties for the theme, so Tailwind isn't needed.
3. Add dependencies:
   - Runtime: `server-only`, `zod`, `@supabase/supabase-js`, `@supabase/ssr`, `maplibre-gl`.
   - Dev: `vitest`, `@playwright/test`, `supabase` (the CLI, run with `npx supabase`).
4. Write `src/lib/env.ts`. It exports `getServerEnv()`, which parses the variables below once and memoizes the result:
   - Supabase: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (server-side only), `SUPABASE_SECRET_KEY`.
   - Passcode and session: `CLASS_PASSCODE_HASH`, `SESSION_SECRET` (at least 32 bytes), `PASSCODE_SESSION_DAYS` (default 30).
   - Other: `RATE_LIMIT_SALT`, `NOMINATIM_CONTACT_EMAIL`, `GEOCODE_COUNTRY_CODES` (default `vn`).
5. Add the ESLint `no-restricted-syntax` rule that matches a `MemberExpression` whose object is `process.env` and whose property starts with `NEXT_PUBLIC_`.
6. Add the security headers in `next.config.ts` (`headers()` for the source `/:path*`) and create `robots.ts`.
7. Write the theme tokens and the root layout shell, using a monospace font loaded with `next/font/google`, such as JetBrains Mono.
8. Add package scripts: `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `test:e2e`, `db:test` (`supabase test db`), and `scan:bundle`.

## Todo

- [x] Initialize the git repo and scaffold Next.js 16.
- [x] Install dependencies and add package scripts.
- [x] Write the env schema, `.env.example`, and `.gitignore`.
- [x] Add the `NEXT_PUBLIC_` lint guard.
- [x] Add the security and noindex headers and `robots.ts`.
- [x] Add theme tokens and the layout shell.
- [x] Write the env schema unit test.

## Success Criteria

- `npm run lint && npm run typecheck && npm test && npm run build` passes with no `.env` file present.
- `curl -sI http://localhost:3000/` shows `X-Robots-Tag: noindex, nofollow`.
- Adding `process.env.NEXT_PUBLIC_X` anywhere makes `npm run lint` fail.

## Risk Assessment

- **`create-next-app` may refuse a non-empty directory.** Scaffold in a scratch folder and move the files in, leaving `.agentkit/` and `.claude/` untouched.
- **The Google font fetch can fail in offline CI.** `next/font` downloads fonts at build time; GitHub runners have network access.

## Security Considerations

- No secrets live in the repo. `.env.example` holds names only.
- `server-only` makes the build fail if `env.ts` is imported from a client component.
