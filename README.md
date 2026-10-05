# WeWalk

NYC WeWorks, rated by people who care too much. A small web app for a crew of friends to rate
the WeWork buildings they work from: coffee, Wi-Fi, phone booths and six other things that matter.

- **Plan and decisions:** [`docs/PLAN.md`](docs/PLAN.md)
- **Design reference:** [`prototype/app.html`](prototype/app.html), the single-file prototype the app is
  ported from. Open it in a browser; it saves to `localStorage`.

Unofficial. Not affiliated with WeWork.

## Stack

Next.js (App Router) · TypeScript · Postgres on Supabase (server-side only) · Drizzle ORM · Zod ·
CSS Modules + design tokens · Vitest · Playwright · Vercel.

## Getting started

Requires Node 22.12+ and pnpm 10 (`corepack enable`).

```sh
pnpm install
cp .env.example .env.local   # then fill in the values (see below)
pnpm dev                     # http://localhost:3000
```

You don't need Supabase to work locally. Set `DATABASE_URL=pglite:.data/dev` (a local embedded
Postgres, migrated and seeded on first use) or `pglite:memory` (wiped on restart), plus any
`CREW_CODE` of 16+ characters, then open `/` and join via `POST /api/join` (the join screen comes
in Phase 3). Unit tests and e2e use [PGlite](https://pglite.dev) in memory too.

### Database (Supabase)

1. Create a Supabase project. Under **Connect**, copy the **transaction pooler** URL (port 6543)
   into `DATABASE_URL` and the **direct** URL (port 5432) into `DIRECT_URL`.
2. `pnpm db:migrate` creates the tables (with row-level security on).
3. `pnpm db:seed` loads the stations from `src/domain/stations.ts`. Re-run it after
   editing that file. It upserts, and never deletes.
4. Set `CREW_CODE` (`openssl rand -hex 16`). Your crew's invite link is `/j/<CREW_CODE>`. The first
   person to join becomes the owner.

## Scripts

| Command            | What it does                                                         |
| ------------------ | -------------------------------------------------------------------- |
| `pnpm dev`         | Dev server                                                           |
| `pnpm build`       | Production build                                                     |
| `pnpm start`       | Serve the production build                                           |
| `pnpm check`       | Format check, lint, typecheck and unit tests. Run before pushing     |
| `pnpm lint`        | ESLint, including the layer rules                                    |
| `pnpm typecheck`   | TypeScript, no emit                                                  |
| `pnpm test`        | Unit tests (Vitest): `src/**/*.test.{ts,tsx}`, next to the code      |
| `pnpm test:watch`  | Unit tests in watch mode                                             |
| `pnpm e2e`         | Browser tests (Playwright) at 390×844, light and dark, on `pnpm dev` |
| `pnpm format`      | Format everything with Prettier                                      |
| `pnpm db:generate` | Write a new SQL migration after changing `src/server/db/schema.ts`   |
| `pnpm db:migrate`  | Apply migrations to `DIRECT_URL`                                     |
| `pnpm db:seed`     | Upsert the station list into `DIRECT_URL`                            |
| `pnpm db:deploy`   | Migrate, seed and check RLS on `DIRECT_URL` (runs on prod deploys)   |
| `pnpm smoke <url>` | Read-only checks against a deployed app                              |

`CI=1 pnpm e2e` tests the production build instead, so run `pnpm build` first.
CI (`.github/workflows/ci.yml`) runs format, lint, typecheck, unit tests, build and e2e on every
push.

`vite` is a direct dev dependency only because Vitest requires it as a peer.

## Deploying

See [`docs/DEPLOY.md`](docs/DEPLOY.md): Supabase for the database, Vercel for the app.

## Code layout

```
src/
  app/      routes only (thin)
  domain/   pure TypeScript business rules: no I/O, no framework imports
  server/   database, auth, repos, services (server-only)
  ui/       components and design tokens (tokens.css)
  client/   browser-only helpers (draft autosave, offline outbox)
tests/e2e/  Playwright tests
```

Layer rules are enforced by ESLint (`eslint.config.mjs`): `domain` imports nothing from other
layers or frameworks, `ui` and `client` never import `server`, `server` never imports UI or
routes, and routes never touch repos or the database directly.
