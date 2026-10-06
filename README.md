# WeWalk

[![CI](https://github.com/michaelohyang/WeWalk/actions/workflows/ci.yml/badge.svg)](https://github.com/michaelohyang/WeWalk/actions/workflows/ci.yml)

**NYC WeWorks, rated by people who care too much.**

WeWalk is a small, private web app for a group of friends who work out of WeWork buildings in
New York City. Check in when you arrive, rate the coffee, Wi-Fi and phone booths, see who else
is out today, and find out which of the city's 29 buildings the crew actually likes.

> WeWalk is an independent personal project. It is not affiliated with, endorsed by or
> sponsored by WeWork.

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Scripts](#scripts)
- [How it works](#how-it-works)
- [Project structure](#project-structure)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security and privacy](#security-and-privacy)
- [Contributing](#contributing)
- [License](#license)

## Features

### Home

- **Here today:** who in the crew has checked in where today, and since when. One tap on
  **Join** checks you in at the same building.
- **Area tiles:** Uptown, Midtown, Flatiron, Downtown and Brooklyn at a glance, each with its
  building count, how many you've visited and its best-rated building. A tile opens that area's
  buildings as a list.
- **Crew feed:** the latest reviews and check-ins, newest first, with photos, scores, hot takes
  and reactions.
- **Search and filters:** find a building by name, address or neighborhood, or by "Best for"
  tags such as _quiet floor_ or _good for calls_.

### Rating and checking in

- **Reviews:** score a building on up to nine categories (coffee, Wi-Fi, phone booths, natural
  light, noise, seating, bathrooms, lunch nearby, overall vibe), add a hot take, a longer review,
  tags and a photo. Edit or delete it at any time.
- **Check-ins:** record a visit in one tap, with an optional note.
- **Works offline:** reviews, check-ins and reactions made without signal are kept on the
  device and sent automatically when you're back online. Unfinished reviews are saved as drafts.

### With the crew

- **Reactions:** 🔥 💯 😂 🙅 on a friend's review.
- **Taste match:** how closely your scores line up with each friend's, the category you agree on
  most and the one you're "at war over".
- **Ranks:** buildings ranked overall or by any category, filterable by area, with a Station of
  the Month and the buildings that divide the crew most.

### Progress

- **Passport:** a stamp for every building you've visited, and the ones still to go.
- **Badges:** milestones, "All of" each area, Trailblazer (first in the crew to review a
  building) and Busy week, each with progress.
- **Weekly streak:** weeks in a row with at least one visit.

### Accounts

- Username and password sign-in, one shared crew, and an owner who can issue one-time recovery
  links for forgotten passwords.
- Light and dark mode, designed for phones and usable on any screen.

## Tech stack

| Area      | Choice                                                                                       |
| --------- | -------------------------------------------------------------------------------------------- |
| Framework | [Next.js](https://nextjs.org) 16 (App Router, React Server Components), React 19             |
| Language  | TypeScript (strict)                                                                          |
| Database  | PostgreSQL on [Supabase](https://supabase.com), accessed only from the server                |
| Data      | [Drizzle ORM](https://orm.drizzle.team) and migrations, [Zod](https://zod.dev) validation    |
| Storage   | [Vercel Blob](https://vercel.com/docs/vercel-blob) for review photos                         |
| Styling   | CSS Modules with design tokens                                                               |
| Testing   | [Vitest](https://vitest.dev), [Playwright](https://playwright.dev), axe accessibility checks |
| Quality   | ESLint (with architecture rules), Prettier, [knip](https://knip.dev)                         |
| Hosting   | [Vercel](https://vercel.com)                                                                 |

## Getting started

### Prerequisites

- Node.js 22.12 or later
- pnpm 10 (run `corepack enable` to use the version pinned in `package.json`)

No Supabase or Vercel account is needed to run WeWalk locally.

### Run it locally

```sh
pnpm install
cp .env.example .env.local
```

Point `DATABASE_URL` in `.env.local` at a local embedded database:

```sh
DATABASE_URL=pglite:.data/dev   # embedded Postgres, kept between restarts
# or
DATABASE_URL=pglite:memory      # embedded Postgres, wiped on restart
```

It is created, migrated and seeded with the 29 buildings on first use. Then start the app:

```sh
pnpm dev
```

Open <http://localhost:3000/signup> and create an account. The first account becomes the crew's
owner. Locally, photos are kept in memory, so they disappear when the server restarts.

## Configuration

| Variable        | Used by                | Value                                                                                      |
| --------------- | ---------------------- | ------------------------------------------------------------------------------------------ |
| `DATABASE_URL`  | The app at runtime     | Postgres connection string (Supabase transaction pooler, port 6543), or `pglite:…` locally |
| `DIRECT_URL`    | Migrations and seeding | Postgres connection string (Supabase session pooler, port 5432)                            |
| `BLOB_STORE_ID` | Review photos          | Added by Vercel when a Blob store is connected to the project; leave empty for local use   |

Never commit real connection strings or tokens. `.env.local` is ignored by git.

## Scripts

| Command            | Description                                                              |
| ------------------ | ------------------------------------------------------------------------ |
| `pnpm dev`         | Start the development server                                             |
| `pnpm build`       | Create a production build                                                |
| `pnpm start`       | Serve the production build                                               |
| `pnpm check`       | Format check, lint, typecheck, unused-code check and unit tests          |
| `pnpm test`        | Unit and API tests (Vitest)                                              |
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

## How it works

- **Reads are server-rendered.** Pages are React Server Components that load "view models"
  (exactly what each screen shows) on the server. The crew's shared data is cached between
  writes and invalidated by every write, so navigating between screens rarely touches the
  database.
- **Writes are idempotent.** Every review, check-in and reaction is a `PUT` or `DELETE` keyed by
  an ID the client generates, so a request can be retried safely. Writes go through an offline
  outbox in the browser that retries them when the connection returns.
- **Business rules are plain TypeScript.** Scoring, ranking, badges, streaks, taste match and
  the feed live in `src/domain`, with no I/O or framework code, and are unit tested on their own.
- **Photos are shrunk on the device** (about 1600 px, JPEG) before upload, then stored in Vercel
  Blob. Reviews only accept photos uploaded through the app.

## Project structure

```
src/
  app/       Routes, pages and API route handlers (kept thin)
  domain/    Business rules in plain TypeScript: scoring, ranking, badges, the feed, validation
  server/    Database, authentication, repositories, services and view models (server-only)
  client/    Browser-only code: the offline outbox, drafts, photo resizing
  ui/        Shared React components and design tokens
tests/
  api/       API route tests against an in-memory database
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
  checks, in light and dark mode: `pnpm e2e`. With `CI=1` they run against the production
  build, so run `pnpm build` first.

GitHub Actions runs formatting, linting, type checking, the unused-code check, unit tests, a
production build and the browser tests on every push.

## Deployment

WeWalk runs on Vercel with a Supabase Postgres database and a Vercel Blob store. Each production
deploy applies database migrations, seeds the building list and verifies row-level security
before building the app. See [`docs/DEPLOY.md`](docs/DEPLOY.md) for the step-by-step guide.

## Security and privacy

- **Passwords** are stored only as salted scrypt hashes; nobody can read them from the
  database. Accounts lock for 15 minutes after five wrong passwords in a row.
- **Sessions** use random 256-bit tokens in `HttpOnly`, `SameSite=Lax` cookies. Only their
  SHA-256 hashes are stored.
- **The database is server-only.** Every table has row-level security enabled with no policies,
  so Supabase's public API can't read anything; the app connects as the database owner from the
  server.
- **Writes** must come from the app's own pages (same-origin check), and all input is validated
  with Zod and by database constraints.
- **The site is private:** every page asks you to sign in, and search engines are told not to
  index it.

## Contributing

WeWalk is a personal project, but issues and pull requests are welcome. Before opening a pull
request:

1. Run `pnpm check` (formatting, lint, types, unused code, unit tests).
2. Add or update tests for the behavior you change.
3. Keep business rules in `src/domain` and database access in `src/server`.

## License

This repository does not include a license yet, so all rights are reserved by the author.
