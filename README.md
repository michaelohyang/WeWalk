# WeWalk

**NYC WeWorks, rated by people who care too much.**

WeWalk is a small, private web app for a group of friends to rate and track the WeWork
buildings they work from in New York City. Check in when you arrive, score the coffee, Wi-Fi,
phone booths and the rest, and see which building the crew actually likes.

> WeWalk is an independent personal project. It is not affiliated with, endorsed by or
> sponsored by WeWork.

## Features

- **Home feed:** who's checked in where today (with a one-tap Join), the five areas as tiles
  (buildings, your progress, the best-rated one), and the crew's latest reviews and check-ins
  with photos and reactions.
- **Search and filters:** find a building by name or neighborhood, or list an area's buildings
  (Uptown, Midtown, Flatiron, Downtown, Brooklyn) or those tagged "Best for" something.
- **Ratings:** score a building on up to nine categories, add a hot take, a full review and
  tags. Edit or delete your review at any time.
- **Check-ins:** record a visit in one tap, with an optional note.
- **Ranks:** buildings ranked overall or by any category, with a Station of the Month.
- **Passport:** a stamp for every building you've been to.
- **Works offline:** ratings and check-ins made without signal are queued on the device and sent
  automatically when you're back online. Unfinished reviews are saved as drafts.
- **Accounts:** username and password sign-in. Passwords are stored only as salted scrypt
  hashes, accounts lock briefly after repeated failed logins, and the owner can issue a one-time
  recovery link for a forgotten password.
- **Light and dark mode**, designed for phones and usable on any screen size.

## Tech stack

| Area      | Choice                                                                                       |
| --------- | -------------------------------------------------------------------------------------------- |
| Framework | [Next.js](https://nextjs.org) 16 (App Router), React 19                                      |
| Language  | TypeScript (strict)                                                                          |
| Database  | PostgreSQL ([Supabase](https://supabase.com)), server-side only                              |
| Data      | [Drizzle ORM](https://orm.drizzle.team), [Zod](https://zod.dev)                              |
| Styling   | CSS Modules with design tokens                                                               |
| Testing   | [Vitest](https://vitest.dev), [Playwright](https://playwright.dev), axe accessibility checks |
| Hosting   | [Vercel](https://vercel.com)                                                                 |

## Getting started

### Prerequisites

- Node.js 22.12 or later
- pnpm 10 (run `corepack enable` to use the version pinned in `package.json`)

### Run it locally

```sh
pnpm install
cp .env.example .env.local
```

Set `DATABASE_URL` in `.env.local` to a local database. No Supabase account is needed:

```sh
DATABASE_URL=pglite:.data/dev   # embedded Postgres, kept between restarts
# or
DATABASE_URL=pglite:memory      # embedded Postgres, wiped on restart
```

The local database is created, migrated and seeded on first use. Then start the app:

```sh
pnpm dev
```

Open <http://localhost:3000/signup> and create an account. The first account becomes the owner.

## Configuration

| Variable        | Used by                | Value                                                                                                     |
| --------------- | ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`  | The app at runtime     | Postgres connection string (Supabase transaction pooler, port 6543), or `pglite:…` locally                |
| `DIRECT_URL`    | Migrations and seeding | Postgres connection string (Supabase session pooler, port 5432)                                           |
| `BLOB_STORE_ID` | Review photos          | Added by Vercel when a Blob store is connected to the project. Locally, photos are kept in memory instead |

Never commit real connection strings. `.env.local` is ignored by git.

## Scripts

| Command            | Description                                                              |
| ------------------ | ------------------------------------------------------------------------ |
| `pnpm dev`         | Start the development server                                             |
| `pnpm build`       | Create a production build                                                |
| `pnpm start`       | Serve the production build                                               |
| `pnpm check`       | Format check, lint, typecheck, unused-code check and unit tests          |
| `pnpm test`        | Unit tests (Vitest)                                                      |
| `pnpm e2e`         | Browser tests (Playwright), in light and dark mode at phone size         |
| `pnpm lint`        | ESLint, including the architecture layer rules                           |
| `pnpm typecheck`   | TypeScript type check                                                    |
| `pnpm knip`        | Find unused files, dependencies and exports                              |
| `pnpm format`      | Format all files with Prettier                                           |
| `pnpm db:generate` | Generate a SQL migration after changing `src/server/db/schema.ts`        |
| `pnpm db:migrate`  | Apply migrations to `DIRECT_URL`                                         |
| `pnpm db:seed`     | Add new buildings and update existing ones from `src/domain/stations.ts` |
| `pnpm db:deploy`   | Migrate, seed and verify row-level security (runs on production deploys) |
| `pnpm smoke <url>` | Read-only health checks against a deployed site                          |

## Project structure

```
src/
  app/       Routes and pages (kept thin)
  domain/    Business rules in plain TypeScript: scoring, ranking, the feed, validation
  server/    Database, authentication, repositories and services (server-only)
  client/    Browser-only code: the offline outbox and draft autosave
  ui/        Shared React components and design tokens
tests/
  api/       API route tests
  e2e/       Playwright browser tests
docs/        Product plan and deployment guide
```

The layers are enforced by ESLint (`eslint.config.mjs`): `domain` has no I/O or framework
imports, `ui` and `client` never import `server`, and routes reach the database only through
services.

## Testing

- **Unit and API tests** run against an in-memory [PGlite](https://pglite.dev) database:
  `pnpm test`.
- **Browser tests** cover the main flows, offline behavior and WCAG 2.1 A/AA accessibility
  checks: `pnpm e2e`. With `CI=1` they run against the production build, so run `pnpm build`
  first.

GitHub Actions runs formatting, linting, type checking, the unused-code check, unit tests, a
production build and the browser tests on every push.

## Deployment

WeWalk runs on Vercel with a Supabase Postgres database. Each production deploy applies
database migrations, seeds the building list and verifies row-level security before building
the app. See [`docs/DEPLOY.md`](docs/DEPLOY.md) for the full guide.

## Documentation

- [`docs/PLAN.md`](docs/PLAN.md): product plan, data model, API and design decisions
- [`docs/DEPLOY.md`](docs/DEPLOY.md): deployment and operations
- [`prototype/app.html`](prototype/app.html): the original single-file design prototype

## License

This repository does not include a license yet, so all rights are reserved by the author.
