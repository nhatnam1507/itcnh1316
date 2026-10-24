---
title: "Phase 2: Database Schema and RLS"
status: todo
priority: P1
effort: 6h
dependencies: [1]
---

# Phase 2: Database Schema and RLS

## Overview

Create Supabase migrations for:
- The `people`, `change_requests`, `admins`, and `rate_limit_events` tables.
- Row-level security (RLS) that blocks direct reads and writes from the `anon` and non-admin roles.
- Database functions for atomic approval and rejection, and for rate limiting.

pgTAP tests prove the database's security behavior.

## Key Insights

- Supabase's secret key (`sb_secret_…`) maps to `service_role`, which bypasses RLS. The server uses it only after checking the passcode (see phase 3).
  - RLS therefore protects against direct API calls made with the publishable key or a leaked user JWT.
  - It does not protect against a leaked secret key. A leaked secret key must be rotated immediately.
- Admin writes go through the admin's own session, using the `authenticated` role. RLS policies keyed on `public.is_admin()` then enforce the admin check in the database, not only in the app.
- Approval must be one transaction: update the record, store the old values, and mark the request. A `security definer` function does this and checks `is_admin()` itself.
- This is a greenfield database with no data, so the first migration needs no backup. Later migrations against production need a backup first (see phase 6).

## Requirements

- [x] `people`:
  - `id uuid pk default gen_random_uuid()`
  - `full_name text not null` (1–120 characters)
  - `date_of_birth date not null` (not in the future)
  - `mobile_phone text not null`, stored normalized as `+84…` with `check (mobile_phone ~ '^\+84(3|5|7|8|9)[0-9]{8}$')` <!-- Updated: Validation Session 1 - Vietnam mobile only -->
  - `address text not null` (5–300 characters)
  - `latitude double precision`, `longitude double precision` (both null or both set, within valid ranges)
  - `location_source text check (location_source in ('geocoded','manual'))`
  - `created_at`, `updated_at` (set by a trigger)
- [x] `change_requests`:
  - `id`, `person_id fk → people on delete cascade`
  - `proposed_full_name`, `proposed_date_of_birth`, `proposed_mobile_phone`, `proposed_address`: each nullable, with a CHECK that at least one is set
  - `requester_note text` (at most 500 characters)
  - `status change_request_status default 'pending'` (an enum: `pending`, `approved`, `rejected`)
  - `previous_values jsonb`, `reviewed_by uuid → auth.users`, `reviewed_at`, `reviewer_note`
  - `submitted_at default now()`, `requester_fingerprint text` (an HMAC of the IP, never the raw IP)
- [x] `admins(user_id uuid pk → auth.users on delete cascade)`.
- [x] `rate_limit_events(bucket text, fingerprint text, created_at timestamptz)`, with an index on `(bucket, fingerprint, created_at)`.
- [x] `public.is_admin()`: `security definer`, `stable`, with `search_path` set to empty. It returns whether `auth.uid()` is in `admins`.
- [x] RLS:
  - Enabled on all four tables.
  - The `authenticated` role gets policies only where `is_admin()` is true: SELECT, INSERT, UPDATE, and DELETE on `people`, and SELECT and UPDATE on `change_requests`. An admin may SELECT only their own `admins` row.
  - No policies for `anon`. Revoke all table privileges from `anon`.
- [x] `approve_change_request(p_request_id uuid, p_latitude double precision, p_longitude double precision, p_location_source text, p_reviewer_note text)`:
  1. Requires `is_admin()`.
  2. Locks the request row with `FOR UPDATE` and requires `status = 'pending'`.
  3. Stores the current values of the changed fields in `previous_values`.
  4. Applies the non-null proposed fields to `people`. When the address changes, it also sets the coordinates and `location_source`.
  5. Sets the status, reviewer, and timestamp.
  6. Returns the updated person.
- [x] `reject_change_request(p_request_id uuid, p_reviewer_note text)` requires an admin and a pending request, and changes only the request.
- [x] `consume_rate_limit(p_bucket text, p_fingerprint text, p_window interval, p_max int) returns boolean`. It deletes rows older than 1 day, counts the rows in the window, and inserts a row if allowed. Execute permission goes to `service_role` only.
- [x] Revoke function execute permission from `public` and `anon`. Grant the approve and reject functions to `authenticated`, which still checks `is_admin()` inside.
- [x] `supabase/seed.sql` adds a few clearly fictional people for the local and CI database only. It never runs against production.

## Related Code Files

Create:
- `supabase/config.toml` (from `npx supabase init`)
- `supabase/migrations/<timestamp>_create_directory_schema.sql`
- `supabase/migrations/<timestamp>_add_change_request_functions.sql`
- `supabase/migrations/<timestamp>_add_rate_limit.sql`
- `supabase/seed.sql`
- `supabase/tests/rls-policies.test.sql`
- `supabase/tests/change-request-functions.test.sql`
- `supabase/tests/rate-limit.test.sql`

## Implementation Steps

1. Run `npx supabase init`.
2. Write the schema migration: tables, enum, triggers, RLS, `is_admin()`, policies, and revokes.
3. Write the approve and reject function migration with `security definer set search_path = ''` and schema-qualified names.
4. Write the rate-limit migration.
5. Write pgTAP tests (`supabase test db`). Each one sets `role` and `request.jwt.claims` to act as:
   - **anon:** every select, insert, update, and delete on the four tables fails or returns 0 rows.
   - **an authenticated non-admin:** same as anon, and calling approve or reject raises an exception.
   - **an admin:** the CRUD operations on `people` succeed.
     - Approval updates only the proposed fields and fills `previous_values`.
     - A second approval of the same request fails.
     - Rejection leaves `people` unchanged.
   - **service_role:** `consume_rate_limit` allows N calls and refuses call N+1 within the window.
6. Run `npx supabase db lint` with no errors.

## Todo

- [x] Run `supabase init` and write the three migrations.
- [x] Write the seed data (local only).
- [x] Write the pgTAP tests for RLS, the functions, and the rate limit.
- [x] Run `supabase db lint` and `supabase test db` with both passing locally or in CI.

## Success Criteria

- `npx supabase db reset && npx supabase test db` passes locally, using Docker Desktop's WSL integration, and in CI.
- `npx supabase db lint` reports no errors.

## Risk Assessment

- **Docker must be on before this phase.** Enable Docker Desktop's WSL integration (a phase 1 prerequisite) before running `supabase start`.
- **Two admins could approve the same request at once.** `FOR UPDATE` together with the `status = 'pending'` check prevents a double approval.

## Security Considerations

- `security definer` functions pin `search_path` to empty to prevent search-path hijacking.
- The raw IP is never stored. Only an HMAC fingerprint is kept, and old rows are deleted.
- Rollback: before production data exists, run `supabase db reset`. After that, use a new forward migration; never edit an applied one.
