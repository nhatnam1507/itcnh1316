# Brainstorm: Classmate Directory Map

Status: accepted contract, ready for planning. Date: 2026-10-19.

## Outcome

A Next.js + Supabase web app, deployed to Vercel through GitHub Actions, that serves as a phone directory for a class. It has a cyberpunk "surveillance console" look.

- **Dashboard:** a map with one pin per classmate, placed by address. Hovering (or tapping on touch screens) a pin shows that classmate's name, date of birth, mobile phone and address in the left panel. The right panel lists all classmates.
- **Admin:** an admin logs in to create and edit classmate records and to review change requests.
- **Change requests:** any visitor who has the class passcode can submit a change request for a record without logging in. The admin approves it, which applies the change, or rejects it.

## Decisions (confirmed with the user)

| Topic | Decision |
|---|---|
| Who can view | Everyone who knows the shared class passcode sees all fields. |
| User accounts | None for classmates. Only the admin logs in, using Supabase Auth with email and password. |
| Protecting the data | A single class passcode is checked on the server. Pages are also marked so search engines don't index them. |
| Geocoding | Free Nominatim, called from the server when the admin saves an address. The admin can click the map to correct the pin before saving. |
| Hosting | Vercel, deployed by GitHub Actions. |
| Keys | Strict rule: no Supabase key of any kind (secret or publishable), and no map key, reaches the browser. |

## Constraints

- **All data goes through the Next.js server.** Pages, form actions and API routes are the only code that talks to Supabase.
  - Every module that uses Supabase imports `server-only`, so a browser import fails the build.
  - Environment variables never use the `NEXT_PUBLIC_` prefix, which is what Next.js uses to expose a variable to the browser.
- **Supabase row-level security (RLS) is on for every table.** With no anonymous policies, the database rejects direct access from anyone who isn't the server. The secret key is used only in server code, and only after the passcode check.
- **Approval is one atomic database step.** A database function checks that the caller is an admin, then updates the record, sets the request status and stores the old values, all in one transaction.
- **Passcode handling:**
  - The passcode is stored only as a hash in an environment variable.
  - After a correct passcode, the server sets a signed session cookie that the browser's scripts can't read.
  - Middleware sends any request without that cookie to the unlock page.
  - The unlock page and the change-request form are rate-limited.
- **Maps:** MapLibre GL with OpenFreeMap map data, which needs no API key, and a custom dark neon style.
  - Nominatim calls run only on the server and stay under its limit of about one request per second, sending an identifying User-Agent header as its usage policy requires.
  - Coordinates are stored in the database, so loading the dashboard never calls a geocoder.
- **Theme:** dark neon, monospace text, scanlines and glitch effects. Motion respects the "reduce motion" system setting, and text keeps readable contrast. The left and right panels become drawers on mobile.
- **Data model:** full name, date of birth, mobile phone, address, latitude and longitude. Input is validated on the server, and Vietnamese phone numbers are checked by format.

## Non-goals

- Classmate accounts or logins, and self-registration.
- Real-time pin updates.
- Vercel preview deployments that read production data.
- Analytics, extra profile fields, a mobile app, and paid geocoding.

## Acceptance criteria

1. **No keys in the browser.** A CI step searches the browser bundle (`.next/static`) and finds no Supabase URL, key or JWT, and no map or geocoding key. The browser's network log shows no requests to `*.supabase.co`.
2. **The passcode gate works.**
   - Without the passcode cookie, every page and data route redirects or returns 401, and no classmate data appears in the HTML.
   - Pages send a `noindex` robots header.
   - Repeated wrong passcodes are rate-limited.
3. **Visitors can't change records directly.** A visitor with the passcode can create only a `pending` change request, never edit a record. Calling the database directly with any client key is rejected by RLS.
4. **Approval and rejection.** Approving applies the change and records the old values, the reviewer and the time, all together. Rejecting changes nothing on the record. A changed address triggers a new geocode, and the admin can correct the pin.
5. **Dashboard.** Every classmate with coordinates has a pin. Hovering a pin fills the left panel, and the right panel lists all classmates. On touch screens, tapping a pin does the same.
6. **CI/CD.**
   - On a pull request, GitHub Actions runs lint, type checks, tests, a build and the bundle key scan.
   - On `main`, it also applies Supabase migrations and then deploys to Vercel production.
   - Secrets live only in GitHub and Vercel encrypted settings.

## Trade-offs

**A. All data through the Next.js server (chosen).**
- Assumes no live updates are needed from Supabase to the browser.
- Breaks first if live updates become a requirement. The server would then have to push them itself.

**B. The usual Supabase setup, with a publishable key and RLS in the browser (rejected).**
- Assumes the publishable key may be public.
- Breaks your rule as written. Any mistake in an RLS rule also exposes the tables directly to the browser.

**Passcode gate versus a fully public site.**
- The passcode assumes classmates won't leak it.
- If it leaks, the fix is to change the passcode and the cookie-signing secret.

**Free Nominatim with manual pin correction versus Google geocoding.**
- Nominatim assumes the class list stays small and the admin is willing to fix pins by hand.
- It breaks first if the list grows past what an admin can correct by hand.

## Better approaches

None. The recommended direction is the one you asked for.
- Routing all data through the server is how to meet the no-keys rule in full.
- You accepted the passcode gate and manual pin correction as additions to cover the risks they address.

## Risks

- **Anyone with the passcode can request changes to any classmate's record.** The admin must check before approving.
- **Nominatim usage policy.** A busier production deployment would need a self-hosted geocoder or a paid provider behind the same server-side interface.

## Open items for planning

- The project folder is not a git repository yet. A GitHub repository, a Supabase project and a Vercel project need to be created, with their secrets added to GitHub and Vercel settings.
- Seeding the first admin account: create it once with the Supabase CLI or dashboard, then add a row to the `admins` table.
