# Architecture

A passcode-gated class phone directory: a Next.js 16 app on Vercel, backed by Supabase Postgres. All Supabase access happens on the server; the browser talks only to the app and to the OpenFreeMap tile host.

## Request flow

```text
Browser ──► Vercel (Next.js)
              │
              ├─ src/proxy.ts        every route except static assets and robots.txt
              │    no valid class_session cookie → 307 to /unlock (pages) or 401 (actions, non-GET)
              │    /admin/* → refresh the admin's Supabase session cookies
              │
              ├─ Server Components and Server Actions
              │    requireClassAccess() and, for admin code, requireAdmin() run again
              │    inside every data function; the proxy is not the only gate
              │
              └─► Supabase (Postgres + Auth)        server-to-server only
                    viewer reads, rate limits, change-request inserts → secret key (service_role)
                    admin reads and writes, approvals → admin session (authenticated role + RLS)

Browser ──► tiles.openfreemap.org      map style, tiles, glyphs and sprites (no key)
Server  ──► nominatim.openstreetmap.org geocoding, admin actions only, ≤ 1 request/second
```

## Security boundary

- **No keys in the browser.** Every module that touches Supabase or secrets imports `server-only`. No env var uses the `NEXT_PUBLIC_` prefix; ESLint rejects any reference to one. `scripts/check-client-bundle.mjs` fails CI if a Supabase URL or key, a JWT, or a configured secret value appears in `.next/static` or `.vercel/output/static`. A Playwright test asserts the browser contacts no host except the app and `tiles.openfreemap.org`.
- **Class passcode.** The passcode is stored only as an scrypt hash (`CLASS_PASSCODE_HASH`). Unlocking sets an `httpOnly`, `sameSite=lax` cookie holding `{exp}` plus an HMAC-SHA256 signature (`src/lib/passcode/session-token.ts`). The signing key covers both `SESSION_SECRET` and the passcode hash, so rotating either one logs every viewer out.
- **Rate limits** (`src/lib/rate-limit.ts`, `consume_rate_limit()` in SQL), keyed by an HMAC of the client IP (the raw IP is never stored):

  | Bucket | Limit |
  |---|---|
  | `unlock` | 5 failed attempts per 15 minutes. A correct passcode refunds its attempt. |
  | `change-request` | 5 per hour |
  | `admin-login` | 10 attempts per 15 minutes |

- **Admins** sign in with Supabase Auth (email and password; self-signup disabled). Their auth cookies are forced `httpOnly`, since no browser Supabase client exists. Admin writes use the admin's own session, so RLS checks `public.is_admin()` in the database as well as in `requireAdmin()`.
- **Search engines.** Every response carries `X-Robots-Tag: noindex, nofollow`, and `robots.txt` disallows everything. `next.config.ts` also sets `Referrer-Policy`, `X-Content-Type-Options` and `frame-ancestors 'none'`.

## Data model

Migrations live in `supabase/migrations/`; pgTAP tests in `supabase/tests/` prove the access rules.

| Table | Purpose | Access |
|---|---|---|
| `people` | name, date of birth, Vietnamese mobile (`+84…`), address, optional pin (`latitude`, `longitude`, `location_source` = `geocoded` or `manual`) | admins: full CRUD through RLS; viewers: read through the server's secret key |
| `change_requests` | proposed values (at least one), requester note, `status` (`pending`, `approved`, `rejected`), `previous_values`, reviewer and time, requester fingerprint | admins: read and update; visitors: insert only, through the server |
| `admins` | Supabase Auth user IDs allowed to administer | an admin reads only their own row; rows are added by hand |
| `rate_limit_events` | bucket, fingerprint, time; rows older than a day are purged | server only |

`anon` has no table privileges and no policies. An authenticated non-admin passes no policy, so they read nothing and write nothing. Deleting a person cascades to their change requests.

## Change-request lifecycle

1. A visitor with the passcode submits `/people/[id]/request-change`. The server validates the input, checks the rate limit and inserts a row. The status comes from the database default, `pending`, so a visitor can never edit `people` directly.
2. The admin reviews `/admin/requests`, which shows current and proposed values side by side. When the address changes, the proposed address is geocoded for a pin preview that the admin can drag or replace.
3. `approve_change_request()` is one transaction, a `security definer` function with an empty `search_path`:
   1. Check `is_admin()` for the calling session.
   2. Lock the request with `FOR UPDATE` and require `status = 'pending'`, so a second approval fails.
   3. Copy the current values of the changed fields into `previous_values`.
   4. Apply the non-null proposed fields. When the address changes, also apply the new pin; without one, the person shows "no pin".
   5. Record `approved`, the reviewer and the time.
4. `reject_change_request()` makes the same admin and pending checks and changes only the request.

## Map

`src/components/map/map-style.ts` fetches the OpenFreeMap dark style and recolors it by layer type and source layer, so upstream layer changes cannot break loading. It also prefers Latin place names, because the style's fonts lack Lao, Khmer and Han glyphs. The palette gives the map a HUD look. The tiles have no land polygons, so land is the style's background. From orbit it is a bright cyan silhouette; it darkens toward graphite as the camera comes down. Glowing coastline layers are inserted above the water, and roads and labels are hidden until zooms 6 and 4.5. During the orbital descent the canvas stays hidden until the first tiles draw, so the globe never flashes as a solid disc.

The dashboard draws pins as a GeoJSON circle layer with a glow layer and a sonar-ping ring layer. The active pin gets a callout (an HTML marker built with `textContent`). The active pin uses feature state and pulses. The dashboard map uses the globe projection (`withOrbitalView`), opens tilted, and extrudes the tiles' `building` layer in 3D from zoom 13. The first console load in a browser session descends from orbit; `data-ready` is set only once that flight ends. A decorative HUD (radar sweep, corner brackets) sits over the map with `pointer-events: none`.

The console's HUD instruments (class radar, signal-fix and next-birthday gauges, birthdays per month) use only real data. `src/features/people/telemetry.ts` computes them on the server, so the server and the browser agree on "today". The unlock screen comes before the passcode, so its instruments carry no class data.

The unlock screen shows a three.js globe (`src/components/fx/holo-globe/`), loaded as a separate chunk after first paint. Its dotted continents come from `land-points.json`, generated once from Natural Earth's public-domain land polygons by `scripts/generate-globe-land-points.mjs`, so the browser fetches nothing extra. Without WebGL the page shows no globe.

The pings, pulse, sweep, descent, globe animation and the other effects in `src/components/fx/` stop when the system asks for reduced motion. Animated text keeps the real text in a visually hidden copy, so accessible names and tests are unchanged. Coordinates are stored in the database, so loading the dashboard never calls a geocoder.

MapLibre GL v6 loads its worker from a file next to its own module, and that file does not survive bundling. `scripts/copy-maplibre-worker.mjs` copies the worker into `public/maplibre/` before each dev run and build, and `src/components/map/maplibre-setup.ts` points MapLibre at it.
