# Setup and Deployment

How to run the classmate directory locally, where every setting lives, and how to operate production: deploys, the first admin, secret rotation, backups, and incident response.

## Local development

Requirements: Node 24 or newer (`.nvmrc` pins 24 for CI and Vercel), npm, and Docker. On WSL, enable Docker Desktop's WSL integration so `docker info` works inside the distro.

```bash
npm install
npx supabase start          # local Postgres, Auth and REST on 127.0.0.1:54321
npx supabase db reset       # apply migrations and load supabase/seed.sql
```

Create `.env.local` (git-ignored) from `.env.example`:

```bash
npx supabase status -o env  # prints API_URL, PUBLISHABLE_KEY and SECRET_KEY for the local stack
```

| `.env.local` variable | Local value |
|---|---|
| `SUPABASE_URL` | `API_URL` from `supabase status` |
| `SUPABASE_PUBLISHABLE_KEY` | `PUBLISHABLE_KEY` from `supabase status` |
| `SUPABASE_SECRET_KEY` | `SECRET_KEY` from `supabase status` |
| `CLASS_PASSCODE_HASH` | `printf 'local-class-passcode' \| node scripts/hash-passcode.mjs` |
| `SESSION_SECRET` | `openssl rand -base64 48` |
| `RATE_LIMIT_SALT` | `openssl rand -hex 24` |
| `NOMINATIM_CONTACT_EMAIL` | your email (sent to Nominatim in the User-Agent) |

Then run `npm run dev` and open <http://localhost:3000>. The e2e tests assume the passcode `local-class-passcode`; override it with `E2E_PASSCODE`.

The seed creates six fictional classmates and two local-only Supabase Auth accounts:

| Account | Password | Purpose |
|---|---|---|
| `admin@classnet.test` | `local-admin-password` | Admin. Sign in at `/admin/login` to use the console. |
| `viewer@classnet.test` | `local-viewer-password` | Test-only. Used by `e2e/admin-access.spec.ts` to prove that a valid Supabase account without an `admins` row is refused at `/admin/login`. |

Classmates have no accounts and no login. They open the directory with the class passcode at `/unlock`. The only login is the admin login. The `viewer@` account is not a classmate login or a user role. It only stands in for a Supabase account that exists but is not an admin, such as a user created in the dashboard without the `admins` insert.

`supabase db push` never applies `seed.sql`, so these accounts never exist in production.

### Checks

| Command | What it runs |
|---|---|
| `npm run lint` | ESLint, including the rule that rejects any `process.env.NEXT_PUBLIC_*` reference |
| `npm run typecheck` | `next typegen` and `tsc --noEmit` |
| `npm test` | Vitest unit tests |
| `npm run db:test` | pgTAP tests in `supabase/tests/` (needs the local stack) |
| `npm run build` | production build (needs no env vars) |
| `npm run scan:bundle` | fails if a Supabase URL or key, a JWT, or a configured secret value appears in the browser bundle |
| `npm run test:e2e` | Playwright against `next start` (or a server already on port 3000) with the seeded local stack |

`predev` and `prebuild` copy MapLibre's worker into `public/maplibre/` (git-ignored); see `scripts/copy-maplibre-worker.mjs`.

## Configuration reference

The app reads only server-side variables, validated in `src/lib/env.ts`. None use the `NEXT_PUBLIC_` prefix, so none reach the browser.

| Variable | Required | Where it lives in production |
|---|---|---|
| `SUPABASE_URL` | yes | Vercel project settings (Production) |
| `SUPABASE_PUBLISHABLE_KEY` | yes, server-side only | Vercel |
| `SUPABASE_SECRET_KEY` | yes (`sb_secret_…`, bypasses RLS) | Vercel |
| `CLASS_PASSCODE_HASH` | yes, `scrypt:N:r:p:salt:hash` | Vercel |
| `SESSION_SECRET` | yes, at least 32 bytes | Vercel |
| `PASSCODE_SESSION_DAYS` | no, default `30` | Vercel |
| `RATE_LIMIT_SALT` | yes, at least 16 characters | Vercel |
| `NOMINATIM_CONTACT_EMAIL` | yes | Vercel |
| `GEOCODE_COUNTRY_CODES` | no, default `vn` | Vercel |

GitHub repository secrets, in the `production` environment, used only by `.github/workflows/deploy.yml`:

| Secret | Purpose |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI access (account token) |
| `SUPABASE_DB_PASSWORD` | production database password, for `link`, `db dump` and `db push` |
| `SUPABASE_PROJECT_ID` | project ref |
| `BACKUP_PASSPHRASE` | encrypts the pre-migration backup |
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | Vercel CLI deploys |

Optional GitHub variable `PRODUCTION_URL` (for example `https://classnet.example.com`) is the URL the smoke test checks. Set it when Vercel Deployment Protection guards per-deployment URLs.

## First-time production setup

1. **Supabase.** Create a project. Under Authentication → Providers, keep Email enabled and turn off "Allow new users to sign up". `supabase/config.toml` sets this for the local stack only.
2. **Vercel.** Create a project linked to the repository. Add the runtime variables above to Production. `vercel.json` turns off Git deploys, so only GitHub Actions deploys and no preview deployment ever reads production data.
3. **GitHub.** Create an environment named `production` holding the secrets above.
4. **Passcode.** Generate the hash and store it as `CLASS_PASSCODE_HASH` in Vercel:

   ```bash
   node scripts/hash-passcode.mjs   # prompts twice; the passcode never lands in shell history
   ```

5. **Deploy.** Push to `main`. See [Deploy pipeline](#deploy-pipeline).
6. **First admin.** In the Supabase dashboard, open Authentication → Users → Add user, then create a user with an email and a strong password (at least 12 characters). Then run in the SQL editor:

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'admin@example.com';
   ```

   Remove an admin with `delete from public.admins where user_id = …`.

## CI pipeline

`.github/workflows/ci.yml` runs on every pull request and is called by the deploy workflow:

1. `npm ci`, lint, typecheck, unit tests.
2. `supabase start`, `supabase db lint`, and pgTAP tests.
3. Build against the local stack with throwaway CI-only secrets.
4. Bundle key scan, then Playwright e2e tests. On failure the Playwright report is uploaded for 7 days.

## Deploy pipeline

`.github/workflows/deploy.yml` runs on every push to `main`. It reruns CI, then one deploy at a time (`production-deploy` concurrency group):

1. **Backup.** It runs `supabase db dump` for the schema and for the data, tars both, and encrypts the archive with AES-256 using `BACKUP_PASSPHRASE`. Only the `.gpg` file is uploaded, as artifact `db-backup-<sha>`, kept for 7 days. If the backup fails, nothing is migrated.
2. **Migrate.** `supabase db push --linked --yes`.
3. **Build.** `vercel pull` and `vercel build --prod`, then the bundle scan on the prebuilt output, including the literal production secret values.
4. **Deploy.** `vercel deploy --prebuilt --prod`.
5. **Smoke test.** `/` must answer `307` to `/unlock` with `X-Robots-Tag: noindex, nofollow`.

Migrations are forward-only. Never edit an applied migration; add a new one.

## Operations

### Rotate the class passcode

Generate a new hash with `node scripts/hash-passcode.mjs`, then replace `CLASS_PASSCODE_HASH` in Vercel and redeploy (rerun the latest Deploy workflow). The session cookie's signing key covers the passcode hash, so every existing viewer session stops working at once. Share the new passcode with the class.

### Rotate the session secret

Replace `SESSION_SECRET` in Vercel with `openssl rand -base64 48` and redeploy. Every viewer must enter the passcode again. Admin logins are unaffected.

### Restore a backup

1. Download the `db-backup-<sha>` artifact from the Deploy run (Actions → run → Artifacts), and unzip it.
2. Decrypt and unpack it:

   ```bash
   gpg --decrypt db-backup-<sha>.tar.gz.gpg > backup.tar.gz   # prompts for BACKUP_PASSPHRASE
   tar xzf backup.tar.gz                                     # schema.sql and data.sql
   ```

3. Restore it into the project. For a full restore into an empty database, apply the schema first and then the data:

   ```bash
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f schema.sql
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f data.sql
   ```

   `DATABASE_URL` is the connection string from Supabase → Project Settings → Database. To roll back only the data after a bad migration, push a forward-fix migration first, then load `data.sql` into the emptied tables.
4. Delete the decrypted files. They contain classmates' personal data.

### A secret key leaks

`SUPABASE_SECRET_KEY` bypasses row-level security, so treat a leak as a full data exposure:

1. In Supabase → Project Settings → API Keys, create a new secret key and revoke the leaked one.
2. Put the new key in Vercel as `SUPABASE_SECRET_KEY` and redeploy.
3. Rotate `SESSION_SECRET` and the class passcode if the leak may have included them.
4. Review recent `change_requests` and `people` changes for tampering.

A leaked `SUPABASE_PUBLISHABLE_KEY` alone exposes nothing, because RLS gives the `anon` role no access, but rotate it the same way.
