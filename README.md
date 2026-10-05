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
cp .env.example .env.local   # fill in later phases; Phase 0 needs nothing
pnpm dev                     # http://localhost:3000
```

## Scripts

| Command           | What it does                                                         |
| ----------------- | -------------------------------------------------------------------- |
| `pnpm dev`        | Dev server                                                           |
| `pnpm build`      | Production build                                                     |
| `pnpm start`      | Serve the production build                                           |
| `pnpm check`      | Format check, lint, typecheck and unit tests. Run before pushing     |
| `pnpm lint`       | ESLint, including the layer rules                                    |
| `pnpm typecheck`  | TypeScript, no emit                                                  |
| `pnpm test`       | Unit tests (Vitest): `src/**/*.test.{ts,tsx}`, next to the code      |
| `pnpm test:watch` | Unit tests in watch mode                                             |
| `pnpm e2e`        | Browser tests (Playwright) at 390×844, light and dark, on `pnpm dev` |
| `pnpm format`     | Format everything with Prettier                                      |

`CI=1 pnpm e2e` tests the production build instead, so run `pnpm build` first.
CI (`.github/workflows/ci.yml`) runs format, lint, typecheck, unit tests, build and e2e on every
push.

`vite` is a direct dev dependency only because Vitest requires it as a peer.

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
