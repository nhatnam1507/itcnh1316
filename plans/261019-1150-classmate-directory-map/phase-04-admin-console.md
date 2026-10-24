---
title: "Phase 4: Admin Console"
status: todo
priority: P1
effort: 8h
dependencies: [3]
---

# Phase 4: Admin Console

## Overview

Admin-only pages for logging in, creating and editing classmate records with pin correction, and reviewing change requests. All pages use the cyberpunk theme from phase 1.

## Key Insights

- Free geocoding often misplaces Vietnamese addresses, so pin correction is a core part of the record form: click the map to set the coordinates.
- Approving a request that changes the address needs a fresh geocode and an optional manual pin before the approval is committed. The review screen shows a preview of the proposed location.
- There is no admin self-signup. The first admin is created by hand (documented in phase 6).

## Requirements

- [x] `/admin/login`:
  - Email and password form that calls a server action, which runs `signInWithPassword` with the session client.
  - Rate-limited with the `admin-login` bucket, with a generic error message.
  - Logging out clears the Supabase session.
- [x] `/admin`: table of people with a "no pin" badge, a count of pending requests, and links to create, edit, and the request queue.
- [x] `/admin/people/new` and `/admin/people/[id]`: a shared `PersonForm` with:
  - Fields: full name, date of birth, mobile phone, address.
  - A "Locate address" button that calls a server action to geocode and returns coordinates for preview.
  - A small `PinPicker` map: clicking sets the coordinates and marks the source as `manual`, and the pin can be dragged.
  - Save validates with the shared zod schema. If no pin is set, the server geocodes the address. If that fails too, the record saves without coordinates and shows "no pin".
  - Field errors displayed next to each field.
  - A Delete button on the edit page opens a confirmation dialog in which the admin types the person's name. The dialog warns that their pending change requests will be deleted too. <!-- Updated: Validation Session 1 - delete confirmed -->
- [x] `/admin/requests`: the pending queue, oldest first. Each card shows:
  - The current and proposed values side by side, with changed fields highlighted, plus the requester's note and the submission time.
  - When the address changes: a `PinPicker` preview from geocoding the proposed address, which the admin can adjust.
  - Approve and Reject buttons with an optional reviewer note, calling the RPC functions through the services from phase 3.
- [x] A shared `src/components/map/map-style.ts` holds the neon restyle of the OpenFreeMap dark style. Phase 5 reuses it.
- [x] Every admin page and action calls `requireAdmin()`.

## Related Code Files

Create:
- `src/app/admin/login/page.tsx`, `src/app/admin/login/actions.ts`, `src/app/admin/logout/route.ts`
- `src/app/admin/layout.tsx` (calls `requireAdmin` and renders the admin nav)
- `src/app/admin/page.tsx`
- `src/app/admin/people/new/page.tsx`, `src/app/admin/people/[id]/page.tsx`, `src/app/admin/people/actions.ts`
- `src/app/admin/requests/page.tsx`, `src/app/admin/requests/actions.ts`
- `src/components/admin/person-form.tsx` (client component, using `useActionState`)
- `src/components/admin/change-request-card.tsx`
- `src/components/map/pin-picker.tsx` (client component, loaded with `next/dynamic` and `ssr: false`)
- `src/components/map/map-style.ts`

## Implementation Steps

1. Build the login and logout flow and the admin layout guard. `/admin/login` is outside the guard but still behind the passcode.
2. Write `map-style.ts`:
   - Fetch `https://tiles.openfreemap.org/styles/dark` at map load.
   - Override the paint colors of the background, water, roads, and labels with the neon palette.
   - Keep the OpenStreetMap attribution control visible.
3. Build `PinPicker`: a MapLibre map with a draggable marker that reports `{lat, lng}` through hidden form inputs.
4. Build `PersonForm` and its server actions: create, update, locate-address, and delete with confirmation.
5. Build the request queue page and `ChangeRequestCard` with approve and reject actions. After each action, revalidate `/` and `/admin` with `revalidatePath`.

## Todo

- [x] Build admin login and logout, and the layout guard.
- [x] Write the shared neon map style.
- [x] Build the PinPicker component.
- [x] Build the person create and edit form with locate and manual pin.
- [x] Build the change-request review queue with approve and reject.

## Success Criteria

- A non-admin authenticated user who opens `/admin` is redirected to `/admin/login`, and calling an admin server action directly returns an error.
- An admin creates a person with a Vietnamese address, corrects the pin by clicking the map, and the saved coordinates match the click.
- Approving a request with a changed address stores the adjusted pin. The person's old values appear in `previous_values`.
- Rejecting a request leaves the person unchanged and removes the request from the queue.
- Deleting a person after confirmation removes their pin from the dashboard and their requests from the queue.

## Risk Assessment

- **The OpenFreeMap style could change upstream.** The style overrides target layer IDs defensively by skipping missing layers, so they can't break map load.
- **MapLibre's worker in Next.js.** Load the map component client-side only. If worker bundling fails, use `maplibre-gl`'s CSP-safe build (`maplibre-gl-csp`) together with `setWorkerUrl`.

## Security Considerations

- Admin actions use the admin's session client, so RLS enforces `is_admin()` in the database as well.
- Approval and rejection rely on the database row lock and status check. The UI's state is never trusted.
