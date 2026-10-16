# Veille MAX

Veille MAX tracks MAX JEUNE seat availability on a traveller's preferred routes. Every morning it reads the SNCF open-data snapshot, ranks the trains of each leg of every weekend trip in the next 30 days, and sends a push notification when a better train comes out. It is a mobile-first web app, meant to be installed on an iPhone home screen. The UI is in French.

> Veille MAX is not affiliated with SNCF Voyageurs or SNCF Connect. Availability comes from the SNCF open data (`tgvmax` dataset, ODbL licence).

**Status:** walking skeleton, sign-in, the trip template and the daily snapshot ingestion. The app shell, email-code sign-in, the default configuration in Réglages (« Votre week-end type »), the morning ingestion of the SNCF snapshot, the local Supabase stack and the CI pipeline are in place; features land ticket by ticket (see [the v1 spec](.scratch/veille-max-v1/spec.md) and [its tickets](.scratch/veille-max-v1/issues/)).

## Stack

- [Nuxt 4](https://nuxt.com) (Vue 3, TypeScript in strict mode) with its Nitro server, deployed to Vercel.
- [Tailwind CSS 4](https://tailwindcss.com), with the « Billets » design tokens in [`app/assets/css/main.css`](app/assets/css/main.css): Plus Jakarta Sans, warm stone neutrals, orange as the single accent. Light and dark themes follow the system preference.
- [Supabase](https://supabase.com): Postgres, Auth, Vault, `pg_cron`. Schema changes are versioned migrations in [`supabase/migrations`](supabase/migrations).
- [Vitest](https://vitest.dev) for unit and integration tests, [Playwright](https://playwright.dev) for end-to-end tests.

## Getting started

Prerequisites: Node.js 24 (`nvm use` reads [`.nvmrc`](.nvmrc)) and Docker, which runs the local Supabase stack.

```bash
npm ci                  # installs dependencies (the Supabase CLI included)
npm run supabase:start  # starts local Supabase and applies the migrations
npm run supabase:env    # writes .env from the running local stack
npm run dev             # http://localhost:3000
```

The local stack uses the 563xx port range so it can run next to other local Supabase projects: API on `56321`, Postgres on `56322`, Studio on `56323`, the mail catcher on `56324`. Stop it with `npm run supabase:stop`.

Sign in as the seeded traveller `voyageur@veille-max.test`: the code arrives in the mail catcher, http://127.0.0.1:56324. The seed loads when the stack starts on a fresh database, or with `npm run db:reset`. After changing `supabase/config.toml`, restart the stack (`npm run supabase:stop && npm run supabase:start`).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Starts the app in development mode. |
| `npm run build` / `npm run preview` | Builds the app for production and serves the build. |
| `npm run lint` / `npm run lint:fix` | ESLint, including code style (no Prettier). |
| `npm run typecheck` | `vue-tsc` over the app, the server, the shared code and the tests. |
| `npm test` | Vitest, once: the unit tests and the integration tests, which need the local stack. |
| `npm run test:unit` / `npm run test:integration` | One Vitest project only. `npm run test:watch` keeps the unit tests running. |
| `npm run test:e2e` | Playwright against a production build connected to the local stack. |
| `npm run supabase:start` / `supabase:stop` | Starts or stops the local Supabase stack. |
| `npm run supabase:env` | Writes `.env` from the running local stack. |
| `npm run db:reset` | Recreates the local database from the migrations and `supabase/seed.sql`. |
| `npm run db:types` | Regenerates [`shared/types/database.types.ts`](shared/types/database.types.ts) from the local database. |
| `npm run stations:refresh` | Writes a migration that refreshes the station reference (see Database). |
| `npm run pwa:icons` | Regenerates the app icons in `public/` from the favicon ([`pwa-assets.config.ts`](pwa-assets.config.ts)). |

## Tests

The testing approach is described in the spec's "Testing Decisions":

- **Unit tests** (`test/unit`, Vitest) exercise pure code through its public entry point, such as the trip template rules in [`shared/domain`](shared/domain).
- **Integration tests** (`test/integration`, Vitest) run against the local Supabase stack, through the Data API with the publishable key, as the app does. Each test invites throwaway travellers with the secret key, signs them in without sending an email, and deletes them afterwards. They cover what the database guarantees, row-level security first.
- **End-to-end tests** (`test/e2e`, Playwright) drive a production build of the app, connected to the local Supabase stack, on a mobile viewport. A setup project ([`auth.setup.ts`](test/e2e/auth.setup.ts)) first signs the seeded traveller in through the sign-in screen, with the code read from the mail catcher. Every test then starts signed in as that traveller, unless it sets its own `storageState`.

```bash
npm test                         # unit and integration tests; needs the local stack and .env (see Getting started)
npx playwright install chromium  # once
npm run test:e2e                 # needs the local stack and .env
E2E_PORT=3101 npm run test:e2e   # on another port, e.g. while another worktree's tests hold 3100
```

## Database

- Create a migration with `npx supabase migration new <name>`, write it, then `npm run db:reset` to apply it locally and `npm run db:types` to refresh the generated types.
- Functions are private by default: a migration grants `execute` explicitly to the roles that may call a function (see the initial migration).
- Every traveller-owned row carries a `user_id` protected by row-level security; availability data is global ([ADR 0002](docs/adr/0002-multi-user-schema-shared-availability.md)).
- **Trip template:** `template_legs` (one row per traveller and leg) and `template_routes` (its ranked routes). A traveller who never saved a leg gets the default from [`shared/domain/trip-template.ts`](shared/domain/trip-template.ts): Friday outbound, Sunday return, no routes. The app saves a leg with its routes in one call to `save_template_leg`, which runs under the caller's RLS.
- **Push devices:** `push_subscriptions` holds each device on which a traveller turned notifications on: its Web Push endpoint and keys, and a label (« iPhone »). A traveller can have several. The app registers a device through `register_push_device`, which gives the subscription to the signed-in traveller even when another traveller had it on that browser before.
- **Availability history** (global, read by every signed-in traveller, written by the server role only): `snapshots` (one row per ingested SNCF snapshot, keyed by its processed timestamp), `train_observations` (every train seen on a tracked route, with its first and last snapshot) and `openings` (runs of consecutive snapshots in which a train had an open seat). `record_snapshot` writes one snapshot in a single transaction; `tracked_routes` lists the routes to collect.

### Station reference

`public.stations` maps the 5-character SNCF codes of the `tgvmax` dataset to full station names. Signed-in travellers can read it; only migrations write it. The names come from [trainline-eu/stations](https://github.com/trainline-eu/stations) (ODbL, `sncf_id` column). The 10 codes that the dataset only names at city level (« PARIS (intramuros) », Lyon, Lille) have hand-written names in the script. A code that trainline does not know keeps the dataset's name.

To refresh it, for example when a new station appears in the dataset:

```bash
npm run stations:refresh  # writes supabase/migrations/<timestamp>_refresh_stations.sql
npx supabase migration up --local
```

The script reads the dataset's current codes and trainline's latest `stations.csv`. It prints the codes that had to fall back to the dataset's name. Review the generated migration, then commit it: merging it to `main` applies it to the hosted project. The migration only upserts, so a station that left the dataset is kept for the routes that still use it.

## Snapshot ingestion and the tick

Every 15 minutes, a `pg_cron` job (migration [`tick_schedule`](supabase/migrations/20261016161001_tick_schedule.sql)) posts to `POST /api/cron/tick` through `pg_net`, with the shared secret in the `x-tick-secret` header ([ADR 0003](docs/adr/0003-pg-cron-tick-drives-nitro-jobs.md)). The job reads the endpoint's URL and the secret from Vault (`tick_url`, `tick_secret`); without them it calls nothing. The endpoint answers 401 to a call without the secret, and to every call while `NUXT_TICK_SECRET` is unset.

On each call, the server reads the `data_processed` timestamp of the SNCF `tgvmax` dataset. When it differs from the last ingested snapshot, it exports the trains of the tracked routes (every traveller's template routes) from today to D+30 in Paris, through the filtered export endpoint. It merges duplicate rows (open if any copy says `OUI`), records the snapshot and its train observations, and opens, extends or closes the openings. The code is in [`server/snapshots`](server/snapshots) behind a `SnapshotSource` port, and in [`server/tick`](server/tick). The endpoint returns a summary:

```json
{ "ingested": true, "snapshotId": 12, "counts": { "trains": 630, "openTrains": 50, "openingsOpened": 4, "openingsKept": 46, "openingsClosed": 3 } }
```

When the snapshot was already ingested, it returns `"ingested": false` and `"counts": null`. Home shows « Dernier instantané : <jour, heure> » once a snapshot is in.

To run a tick by hand against the local stack, set `NUXT_TICK_SECRET` in `.env`, start the app, then:

```bash
curl -X POST -H "x-tick-secret: $NUXT_TICK_SECRET" http://localhost:3000/api/cron/tick
```

`GET /api/health` returns `{ "status": "ok", "database": "ok" }` when the server reaches Postgres through Supabase, and a 503 otherwise.

## Installable app and notifications

- The app is a PWA ([`@vite-pwa/nuxt`](https://vite-pwa-org.netlify.app/frameworks/nuxt)): `/manifest.webmanifest` (standalone display, scope `/`, icons) and a service worker of our own, [`service-worker/sw.ts`](service-worker/sw.ts). It shows a notification for every push and, when one is tapped, opens the URL the push carries if it lies inside the scope, the home screen otherwise. It never answers page loads ([ADR 0004](docs/adr/0004-service-worker-without-fetch-handling.md)).
- iOS only sends notifications to an app added to the home screen. In Safari, Réglages says so instead of offering the switch.
- Réglages → Notifications: « Notifications sur cet iPhone » turns notifications on for the device in use. The permission prompt and the subscription happen within the tap, as iOS requires. The card lists the traveller's devices, marks « Cet appareil », and « Envoyer une notification de test » sends a notification to every device (`POST /api/push/test`).
- The server sends pushes behind a `PushGateway` port ([`server/push`](server/push)): Web Push with the VAPID keys in production, a recording fake in the integration tests. A subscription the push service reports gone (404 or 410) is deleted.
- Real delivery and home-screen installation cannot be automated: run the [manual iPhone checklist](docs/manual-iphone-checklist.md) after changing them.

## Sign-in

- Travellers sign in with a 6-digit code sent by email (Supabase email OTP) and typed in the app. There are no magic links: from Mail, a link would open in Safari, whose storage is separate from the installed app. The email template is [`supabase/templates/sign-in-code.html`](supabase/templates/sign-in-code.html).
- Sign-ups are closed (`enable_signup = false` in [`supabase/config.toml`](supabase/config.toml)), and the app asks for a code with `shouldCreateUser: false`. Requesting a code never creates a user. An unknown address gets a neutral refusal.
- **To invite a traveller**, use the Supabase dashboard: Authentication → Users → Add user → Create new user, with « Auto Confirm User » ticked (the password is never used). « Send invitation » also works, but the traveller must open the invitation link once before asking for a code. Until then, Supabase refuses the address like an unknown one.
- Every page except `/login` requires a signed-in traveller. A signed-out visit goes to `/login`, then back to the page it asked for.
- The session lasts: the auth cookies are kept 400 days, the longest browsers allow, and Supabase refresh tokens do not expire. « Se déconnecter » in Réglages signs out this device only.

## Environment variables

| Name | Where | Purpose |
| --- | --- | --- |
| `NUXT_PUBLIC_SUPABASE_URL` | App (`.env`, Vercel) | Supabase project URL. |
| `NUXT_PUBLIC_SUPABASE_KEY` | App (`.env`, Vercel) | Supabase publishable key (`sb_publishable_…`), exposed to the browser. |
| `NUXT_SUPABASE_SECRET_KEY` | App (`.env`, Vercel) | Supabase secret key (`sb_secret_…`), server only. |
| `NUXT_TICK_SECRET` | App (`.env`, Vercel) | Shared secret of the tick endpoint, server only. Same value as the `tick_secret` Vault secret. |
| `NUXT_PUBLIC_VAPID_PUBLIC_KEY` | App (`.env`, Vercel) | Web Push VAPID public key, exposed to the browser. |
| `NUXT_VAPID_PRIVATE_KEY` | App (`.env`, Vercel) | Web Push VAPID private key, server only. |
| `NUXT_VAPID_SUBJECT` | App (`.env`, Vercel) | Contact for the push services, e.g. `mailto:you@example.com`. |
| `SUPABASE_ACCESS_TOKEN` | GitHub Actions secret | Personal access token used by the Supabase CLI to apply migrations. |
| `SUPABASE_DB_PASSWORD` | GitHub Actions secret | Password of the hosted Postgres database. |
| `SUPABASE_PROJECT_ID` | GitHub Actions variable | Reference of the hosted Supabase project. The migrations job is skipped while it is unset. |

[`.env.example`](.env.example) lists the app variables.

## CI/CD

- **Every pull request** ([`ci.yml`](.github/workflows/ci.yml)) runs lint, typecheck and the Vitest unit tests (`npm run test:unit`). A parallel job starts a local Supabase stack with the CLI and runs the integration tests and Playwright against it.
- **Every merge to `main`** applies the migrations to the hosted Supabase project ([`migrations.yml`](.github/workflows/migrations.yml)), and Vercel deploys the app through its Git integration.

## Deploy

One-time setup:

1. **Supabase:** create the hosted project. Note its reference and database password, and create a personal access token. Then mirror the local Auth settings of `supabase/config.toml` in the dashboard, since migrations do not carry them:
   - Authentication → Sign In / Providers: turn « Allow new users to sign up » off and keep the Email provider on, with a 6-digit email OTP.
   - Authentication → Emails → Templates → « Magic Link »: subject « Votre code Veille MAX », body copied from [`supabase/templates/sign-in-code.html`](supabase/templates/sign-in-code.html).
   - Authentication → URL Configuration: the Site URL is the production URL.
   - Authentication → Emails → SMTP Settings: Supabase's built-in email service only delivers to the organisation's team members, a few emails per hour. Set up a custom SMTP server before inviting anyone else.
2. **GitHub:** add the `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` secrets and the `SUPABASE_PROJECT_ID` variable. The next push to `main` applies the migrations; you can also run the "Database migrations" workflow by hand.
3. **Vercel:** import the GitHub repository. Vercel detects Nuxt and builds with the `vercel` Nitro preset on its own, on Node.js 24 (from `engines` in `package.json`). Add the three app variables to the Production and Preview environments.
4. Check `https://<your-domain>/api/health`.
5. **Tick:** generate a secret (`openssl rand -hex 32`). Add it to Vercel as `NUXT_TICK_SECRET` (Production) and redeploy. Then, in the Supabase SQL editor:

   ```sql
   select vault.create_secret('https://<your-domain>/api/cron/tick', 'tick_url');
   select vault.create_secret('<the same secret>', 'tick_secret');
   ```

   Check `select * from cron.job` (the `tick` job is active) and, after the next quarter hour, `select status_code, content from net._http_response order by id desc limit 1` (a 200 with the tick summary).
6. **Notifications:** generate a VAPID key pair once (`npx web-push generate-vapid-keys`) and add it to Vercel (Production) as `NUXT_PUBLIC_VAPID_PUBLIC_KEY` and `NUXT_VAPID_PRIVATE_KEY`, with `NUXT_VAPID_SUBJECT`. Redeploy, then run the [manual iPhone checklist](docs/manual-iphone-checklist.md). Changing the key pair later stops every subscription: each device must turn notifications on again.

## Project layout

```text
app/                 Nuxt app: pages, layouts, components, styles
server/              Nitro server: routes, snapshot ingestion, the tick, push delivery
service-worker/      The app's service worker: notifications
shared/domain/       Domain rules, pure TypeScript (the trip template; the domain core will join it)
shared/utils/        Code shared by the app and the server (Paris time, trip template and snapshot storage)
scripts/             Developer scripts (local .env, station reference refresh)
supabase/            Supabase CLI config, migrations, seed and email templates
test/unit/           Vitest unit tests
test/integration/    Vitest tests against the local Supabase stack
test/e2e/            Playwright tests
docs/                ADRs and research notes
.scratch/            Spec and tickets (local issue tracker)
CONTEXT.md           Domain glossary
```

## Further reading

- [`CONTEXT.md`](CONTEXT.md): the domain glossary (Trip, Leg, Route, Candidate, Improvement…).
- [`docs/adr/`](docs/adr/): architecture decisions.
- [`docs/research/tgvmax-data-source.md`](docs/research/tgvmax-data-source.md): facts about the SNCF dataset, links and iOS constraints.
- The UI prototype that set the visual direction lives on the `prototype/ui-variants` branch. View it without leaving `main` with `git worktree add ../veille-max-prototype prototype/ui-variants`.
