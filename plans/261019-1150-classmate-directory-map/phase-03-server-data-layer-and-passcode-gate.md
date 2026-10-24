---
title: "Phase 3: Server Data Layer and Passcode Gate"
status: todo
priority: P1
effort: 7h
dependencies: [2]
---

# Phase 3: Server Data Layer and Passcode Gate

## Overview

Build every server-side piece that the UI phases rely on:
- Supabase clients, used only on the server.
- The class passcode unlock flow and its signed session cookie.
- `proxy.ts` gating.
- Rate limiting.
- Input validation.
- The geocoding adapter.
- Query and mutation functions for people and change requests.

## Key Insights

- Next.js documents that server functions must check authorization themselves, not rely on the proxy alone. Every data function calls `requireClassAccess()`, and every admin function calls `requireAdmin()`.
- The admin logs in through `@supabase/ssr`'s `createServerClient`, configured with the publishable key held on the server. Its cookies are forced to `httpOnly`, `secure`, and `sameSite: 'lax'`, which works because no browser Supabase client exists.
- The proxy refreshes the admin's Supabase session on `/admin/*` so tokens don't expire mid-session.
- Nominatim policy: at most 1 request per second, an identifying User-Agent with a contact address, and no bulk geocoding. Calls happen only when an admin saves or previews an address.

## Requirements

- [x] `src/lib/supabase/secret-client.ts`:
  - `server-only`.
  - Builds the client with `SUPABASE_URL` and `SUPABASE_SECRET_KEY`, with `auth.persistSession: false`.
  - Used only after `requireClassAccess()`.
- [x] `src/lib/supabase/session-client.ts`:
  - `server-only`.
  - `createServerClient` with the publishable key and Next's `cookies()`. Cookie options are overridden to `httpOnly`.
- [x] `src/lib/passcode/passcode-hash.ts`:
  - Verifies passwords against a hash in the format `scrypt$N$r$p$saltB64$hashB64`, using `crypto.scrypt` and `timingSafeEqual`.
  - `scripts/hash-passcode.mjs` generates that hash from a passcode typed at a prompt, so it doesn't land in shell history.
- [x] `src/lib/passcode/class-session.ts`:
  - Signs and verifies the `class_session` cookie as base64url(`{exp}`) plus an HMAC-SHA256 signature made with `SESSION_SECRET` via Web Crypto, so the proxy can use it too.
  - Cookie flags: `httpOnly`, `secure` in production, `sameSite=lax`, `path=/`. It expires after `PASSCODE_SESSION_DAYS`.
  - Exports `requireClassAccess()`, which throws or redirects when the cookie is missing or invalid.
- [x] `src/app/unlock/page.tsx` and `src/app/unlock/actions.ts`:
  - The unlock form checks the rate limit first: 5 failures per 15 minutes per fingerprint.
  - It then verifies the passcode, sets the cookie, and redirects to `/`.
  - A failure shows a generic error message.
- [x] `src/proxy.ts`:
  - Matcher: everything except `_next/static`, `_next/image`, `favicon.ico`, and `robots.txt`.
  - `/unlock` is always allowed.
  - A missing or invalid `class_session` redirects to `/unlock`. Non-GET and server-function requests get 401 instead.
  - On `/admin/*`, it also refreshes the Supabase session.
- [x] `src/lib/auth/require-admin.ts`:
  - Gets the user with `getUser()` from the session client and checks `is_admin()` through a select on `admins`.
  - A non-admin is redirected to `/admin/login`.
- [x] `src/lib/rate-limit.ts`:
  - The fingerprint is the HMAC of `x-forwarded-for`'s first IP with `RATE_LIMIT_SALT`.
  - It calls the `consume_rate_limit` RPC with the secret client.
  - Buckets: `unlock` (5 per 15 minutes), `change-request` (5 per hour), `admin-login` (10 per 15 minutes).
- [x] `src/lib/validation/person-schema.ts`:
  - zod schemas for creating a person, updating a person, and a change request (a partial update where at least one field is required).
  - Accepts only Vietnamese mobile numbers: `0` or `+84` followed by a prefix of 3, 5, 7, 8, or 9 and 8 more digits. Spaces, dots, and dashes are ignored.
  - Normalizes phone numbers to `+84…` to match the database CHECK.
  - Trims strings and rejects a date of birth in the future. <!-- Updated: Validation Session 1 - Vietnam mobile only -->
- [x] `src/lib/geocode/nominatim.ts`:
  - `geocodeAddress(address)` calls `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=${GEOCODE_COUNTRY_CODES}&q=...`.
  - Sends the header `User-Agent: classmate-directory/1.0 (${NOMINATIM_CONTACT_EMAIL})`.
  - Times out after 5 seconds.
  - Returns `{lat, lng}` or `null`. On a miss it never throws; the admin sets the pin by hand.
- [x] `src/features/people/people-queries.ts`: `listPeopleForDirectory()` and `getPerson(id)`, using the secret client after `requireClassAccess()`, selecting only the fields shown in the UI.
- [x] `src/features/people/people-admin.ts`: create, update, and delete through the session client after `requireAdmin()`. Deleting a person also deletes their change requests (FK cascade). <!-- Updated: Validation Session 1 - delete confirmed --> Geocodes on save unless the admin set a manual pin.
- [x] `src/features/change-requests/change-request-service.ts`:
  - `submitChangeRequest()`: requires class access, checks the rate limit, validates, and inserts with the secret client. The status is always the database default, `pending`.
  - `listPendingRequests()`, `approveRequest()`, and `rejectRequest()`: require an admin, use the session client, and call the RPC functions.

## Related Code Files

Create:
- `src/lib/supabase/secret-client.ts`, `src/lib/supabase/session-client.ts`
- `src/lib/passcode/passcode-hash.ts`, `src/lib/passcode/class-session.ts`, `scripts/hash-passcode.mjs`
- `src/proxy.ts`
- `src/app/unlock/page.tsx`, `src/app/unlock/actions.ts`
- `src/lib/auth/require-admin.ts`, `src/lib/rate-limit.ts`, `src/lib/client-fingerprint.ts`
- `src/lib/validation/person-schema.ts`, `src/lib/geocode/nominatim.ts`
- `src/features/people/people-queries.ts`, `src/features/people/people-admin.ts`
- `src/features/change-requests/change-request-service.ts`
- Unit tests next to the sources: `*.test.ts` for the passcode hash, class session, person schema, Nominatim response parsing, and the proxy routing decisions (using `next/experimental/testing/server`).

## Implementation Steps

1. Write the Supabase clients and add `import 'server-only'` to every module above.
2. Write the passcode hash, the hash-generation script, and the class session, with unit tests:
   - The correct passcode passes.
   - A wrong passcode fails.
   - A tampered or expired cookie fails.
   - Changing `SESSION_SECRET` invalidates existing cookies.
3. Write the unlock page and action, and the proxy. Unit-test which paths the proxy matches and how it redirects or returns 401.
4. Write `requireAdmin` and the rate-limit helper.
5. Write the zod schemas and their tests:
   - Phone numbers: `0912 345 678` and `+84912345678` both normalize to `+84912345678`.
   - Rejected phone numbers: `+1…`, `0212…` (a landline), and wrong lengths.
   - A future date of birth and an empty change request are rejected.
6. Write the Nominatim adapter. Unit-test the parser against a saved `jsonv2` response and an empty array; the HTTP call is the boundary being tested.
7. Write the people and change-request services.

## Todo

- [x] Write the server-only Supabase clients.
- [x] Write the passcode hash, generation script, and class session, with tests.
- [x] Write the unlock flow, the proxy gate, and the proxy tests.
- [x] Write `requireAdmin` and the rate limiter.
- [x] Write the validation schemas and tests.
- [x] Write the Nominatim adapter and its parser tests.
- [x] Write the people and change-request services.

## Success Criteria

- `npm test` passes the passcode, session, schema, geocode, and proxy tests.
- With `npm run dev`:
  - `curl -s -o /dev/null -w '%{http_code}' localhost:3000/` returns a 307 redirect to `/unlock`.
  - After unlocking, `/` returns 200.
- Six wrong passcodes in a row are rate-limited on the sixth attempt.
- Grepping `src/` finds `SUPABASE_` env vars only in files that import `server-only`.

## Risk Assessment

- **`x-forwarded-for` can be spoofed outside Vercel.** On Vercel the platform overwrites it. The rate limit is a speed bump, not an authentication layer.
- **Forcing `httpOnly` on `@supabase/ssr` cookies.** Check this against the version installed when the phase runs. If `setAll` options are ignored, wrap them so `httpOnly: true` is applied explicitly.

## Security Considerations

- Passcode attempts are rate-limited, error messages are generic, and comparisons are constant-time.
- Rotating the passcode or `SESSION_SECRET` invalidates every viewer session immediately.
- The secret client never receives user-controlled table or column names; it only runs fixed queries.
