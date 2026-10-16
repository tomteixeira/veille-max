# Veille MAX

Veille MAX tracks MAX JEUNE seat availability on a traveller's preferred routes. Every morning it reads the SNCF open-data snapshot, ranks the trains of each leg of every weekend trip in the next 30 days, and sends a push notification when a better train comes out. It is a mobile-first web app, meant to be installed on an iPhone home screen. The UI is in French.

> Veille MAX is not affiliated with SNCF Voyageurs or SNCF Connect. Availability comes from the SNCF open data (`tgvmax` dataset, ODbL licence).

**Status:** walking skeleton. The app shell, the local Supabase stack and the CI pipeline are in place; features land ticket by ticket (see [the v1 spec](.scratch/veille-max-v1/spec.md) and [its tickets](.scratch/veille-max-v1/issues/)).

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

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Starts the app in development mode. |
| `npm run build` / `npm run preview` | Builds the app for production and serves the build. |
| `npm run lint` / `npm run lint:fix` | ESLint, including code style (no Prettier). |
| `npm run typecheck` | `vue-tsc` over the app, the server, the shared code and the tests. |
| `npm test` | Vitest, once. `npm run test:watch` keeps it running. |
| `npm run test:e2e` | Playwright against a production build connected to the local stack. |
| `npm run supabase:start` / `supabase:stop` | Starts or stops the local Supabase stack. |
| `npm run supabase:env` | Writes `.env` from the running local stack. |
| `npm run db:reset` | Recreates the local database from the migrations and `supabase/seed.sql`. |
| `npm run db:types` | Regenerates [`shared/types/database.types.ts`](shared/types/database.types.ts) from the local database. |

## Tests

The testing approach is described in the spec's "Testing Decisions":

- **Unit tests** (`test/unit`, Vitest) exercise pure code through its public entry point. The domain core will hold most of them.
- **End-to-end tests** (`test/e2e`, Playwright) drive a production build of the app, connected to the local Supabase stack, on a mobile viewport.

```bash
npm test
npx playwright install chromium  # once
npm run test:e2e                 # needs the local stack and .env (see Getting started)
```

## Database

- Create a migration with `npx supabase migration new <name>`, write it, then `npm run db:reset` to apply it locally and `npm run db:types` to refresh the generated types.
- Functions are private by default: a migration grants `execute` explicitly to the roles that may call a function (see the initial migration).
- Every traveller-owned row carries a `user_id` protected by row-level security; availability data is global ([ADR 0002](docs/adr/0002-multi-user-schema-shared-availability.md)).

`GET /api/health` returns `{ "status": "ok", "database": "ok" }` when the server reaches Postgres through Supabase, and a 503 otherwise.

## Environment variables

| Name | Where | Purpose |
| --- | --- | --- |
| `NUXT_PUBLIC_SUPABASE_URL` | App (`.env`, Vercel) | Supabase project URL. |
| `NUXT_PUBLIC_SUPABASE_KEY` | App (`.env`, Vercel) | Supabase publishable key (`sb_publishable_…`), exposed to the browser. |
| `NUXT_SUPABASE_SECRET_KEY` | App (`.env`, Vercel) | Supabase secret key (`sb_secret_…`), server only. |
| `SUPABASE_ACCESS_TOKEN` | GitHub Actions secret | Personal access token used by the Supabase CLI to apply migrations. |
| `SUPABASE_DB_PASSWORD` | GitHub Actions secret | Password of the hosted Postgres database. |
| `SUPABASE_PROJECT_ID` | GitHub Actions variable | Reference of the hosted Supabase project. The migrations job is skipped while it is unset. |

[`.env.example`](.env.example) lists the app variables. Later tickets will add the push notification keys and the tick endpoint secret.

## CI/CD

- **Every pull request** ([`ci.yml`](.github/workflows/ci.yml)) runs lint, typecheck and Vitest, and, in a parallel job, Playwright against a local Supabase stack started with the CLI.
- **Every merge to `main`** applies the migrations to the hosted Supabase project ([`migrations.yml`](.github/workflows/migrations.yml)), and Vercel deploys the app through its Git integration.

## Deploy

One-time setup:

1. **Supabase:** create the hosted project. Note its reference and database password, and create a personal access token.
2. **GitHub:** add the `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` secrets and the `SUPABASE_PROJECT_ID` variable. The next push to `main` applies the migrations; you can also run the "Database migrations" workflow by hand.
3. **Vercel:** import the GitHub repository. Vercel detects Nuxt and builds with the `vercel` Nitro preset on its own, on Node.js 24 (from `engines` in `package.json`). Add the three app variables to the Production and Preview environments.
4. Check `https://<your-domain>/api/health`.

## Project layout

```text
app/                 Nuxt app: pages, layouts, components, styles
server/              Nitro server routes
shared/              Code shared by the app and the server (the domain core will live here)
supabase/            Supabase CLI config, migrations and seed
test/unit/           Vitest tests
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
