# WeWalk v1: product and engineering plan

Status: **draft, waiting on owner decisions** (section 9). No production code until it's approved.

The prototype in `src/app.html` is now the spec for design and flow. This plan covers turning
it into a real web app that a group of friends can share from one link.

---

## 1. Product goals

- One link, shared by about 5–15 friends, covering about 25 NYC WeWork buildings.
- Rating a building from a lobby, one-handed, on a weak signal, takes **under 20 seconds**.
- When you're deciding where to work tomorrow, the answer ("best Wi-Fi near Flatiron?") is two
  taps away.
- Keep the Beli-style design (white canvas, teal, 0–10 score circles) and the casual copy.

**Not goals for v1:** public sign-ups, email or passwords, social features (comments, likes),
native apps, real street maps.

## 2. Product review findings (from the product engineer review)

Prototype problems the rebuild has to fix, most important first:

1. **Identity only exists on one device.** A second phone can't edit your reviews, and names
   aren't unique ("Dana" and "dana " count as two people).
2. **One person can post unlimited reviews for the same station**, which skews the averages.
3. **Nothing survives a bad signal.** A failed post loses the draft.
4. **The rate form is about 2,000px tall** and you type your name in three places.
5. **The 1–5 input is shown /10**, so one review can only display 2, 4, 6, 8 or 10.
6. **No URLs.** You can't link to a building, and the back button leaves the app.
7. **After posting you land on the map**, not on the station with your review.
8. Anyone can delete stations, with no undo.
9. The passport is shared by the whole crew instead of being personal.
10. Photos are stored as base64 in the database. Map pins are crowded at 390px.

## 3. v1 scope

| | Item |
|---|---|
| **MUST** | M1 Shared backend behind a crew invite code. Stations seeded on the server |
| | M2 Identity: pick a display name once, names unique ignoring case, a personal "device link" to sign in on another phone |
| | M3 Lobby-proof rate flow: one review per person per station (posting again edits it), scores first with text folded under "Add more", draft autosave, offline outbox |
| | M4 Real URLs: `/`, `/s/[id]`, `/rate/[id]`, `/ranks`, `/passport`, `/crew` |
| | M5 One-tap check-in with an optional note |
| | M6 Port Explore (list and map), Station, Ranks, Passport and Crew as designed |
| **SHOULD (v1.1)** | Photos on object storage (with delete). A dot for activity since your last visit. Bigger map tap targets |
| **LATER** | Station management in the app. Using location to pick the station. Notifications. Data export |

## 4. Tech stack

**Choice:** Next.js (App Router), TypeScript, Postgres (Neon), Drizzle ORM, Zod, plain CSS
Modules with our design tokens, hosted on Vercel.

Why this stack, keeping it pragmatic:

- **One repo, one deploy, one language.** The UI and the API live in the same Next.js app. There's
  no separate backend service to run for 15 users.
- **Postgres fits the rules we need.** "One review per person per station" and "unique names
  ignoring case" become database constraints instead of app code that has to remember them.
  Neon's free tier is enough.
- **Drizzle** keeps queries typed and close to SQL, with migrations as plain SQL files. It has no
  runtime cost to speak of.
- **Zod** schemas validate requests at the API boundary, and the same types are used on the client.
- **Plain CSS Modules and custom properties.** The prototype's tokens move over as they are, with
  no Tailwind conversion. It also helps stay under the 150KB JavaScript+CSS budget.
- **Vercel and Neon** both have free tiers, preview deploys for each pull request, and a working
  link in minutes.

Options I considered and turned down:

- **Supabase.** It would mean less backend code, but its row-level security assumes a real
  sign-in system, and we have none.
- **SvelteKit.** It ships smaller bundles, but React is the safer choice for whoever maintains
  this later.
- **Firebase.** Rules like "one review per person per station" are awkward to express there, and
  you get tied to one vendor.
- **Separate Express API plus a single-page React app.** That's two deploys and more code for no
  benefit at this size.

Tools: pnpm, ESLint, Prettier, Vitest (unit and API tests), PGlite (an in-memory Postgres for
tests, no Docker), Playwright (end-to-end tests at 390px), and GitHub Actions for CI.

## 5. Architecture

```
src/
  app/                      # routes only: thin, no business logic
    (app)/page.tsx          # Explore
    (app)/s/[id]/page.tsx   # Station
    (app)/rate/[id]/page.tsx
    (app)/ranks|passport|crew/page.tsx
    join/page.tsx           # invite code + pick a name
    link/[token]/route.ts   # device link → sets session cookie
    api/…/route.ts          # JSON endpoints (writes)
  domain/                   # pure TS, no I/O: categories, scoring, ranking, stationOfMonth, passport
  server/
    db/schema.ts, db/client.ts, db/migrations/
    auth/session.ts         # invite code, device tokens, cookie
    repos/                  # stations, members, reviews, checkins (SQL lives here only)
    services/               # use cases: postReview, checkIn, joinCrew (validation + repos + domain)
  ui/                       # components: ScoreCircle, StationRow, Chip, Sheet, TabBar, MapSvg, tokens.css
  client/                   # draft autosave, outbox (retry queue)
seed/stations.ts
tests/ (e2e)                # unit tests sit next to the code they test
```

**Dependency rule:** `app → services → repos/domain`. `domain` imports nothing from the other
layers. `ui` never imports `server`. CI enforces this with ESLint `no-restricted-imports`.

**Reads.** Server Components load station and review rows and compute aggregates in `domain/`.
With about 25 stations and a few hundred reviews, that's microseconds. The scoring logic stays
pure and unit-tested instead of buried in SQL.

**Writes.** JSON `PUT` with **client-generated UUIDs**, so a retry can never create a duplicate.
The offline outbox simply replays the same request. After a write, `router.refresh()` reloads the
data. No realtime in v1: friends see new posts when they refresh or navigate, which meets the
"within 5 seconds" criterion.

**Auth (no passwords).**
- `CREW_CODE` env var. `/join` checks it, then asks for a display name.
- A random 32-byte device token is created, its SHA-256 hash is stored in the database, and the
  token itself goes in an httpOnly cookie.
- Crew page: "Use on another phone" shows your personal link `/link/<token>`.
- Every API route requires a session. Without one, you're sent to `/join`.

### Data model

```
stations  id (slug PK) · name · address · hood · map_x · map_y · label_side · active · created_at
members   id uuid PK · name · name_key (lower/trimmed, UNIQUE) · created_at
devices   id uuid PK · member_id FK · token_hash UNIQUE · created_at · last_seen_at
reviews   id uuid PK (client-generated) · station_id FK · member_id FK · visited_on date
          · coffee … vibe  smallint NULL CHECK 1..5 (9 columns) · hot_take · body · tags text[]
          · created_at · updated_at · UNIQUE(station_id, member_id)
          · CHECK at least one score not null
checkins  id uuid PK · station_id FK · member_id FK · visited_on date · note
          · UNIQUE(station_id, member_id, visited_on)
```

Each category is its own column rather than one JSON field, so sorting rankings by category is
plain SQL and the database rejects bad values.

### API (writes; reads go through Server Components)

| Method | Path | Notes |
|---|---|---|
| POST | `/api/join` | `{code, name}` → sets cookie. 409 if the name is taken |
| PUT | `/api/reviews/:id` | create or update your review. 409 if you already reviewed this station under a different id (the client then switches to edit) |
| DELETE | `/api/reviews/:id` | only your own |
| PUT | `/api/checkins/:id` | idempotent. 409 on a second check-in at the same station on the same day |
| GET | `/api/me/link` | your device link |

## 6. Phases

Each phase ends at a **QA gate**: a QA engineer agent checks the phase against its acceptance
criteria and reports. Fixes land before the next phase starts. The product engineer reviews at
the end of phases 2 and 3.

**Why backend first:** the prototype has already proven the UI and the flow. What's still
untested is identity, idempotent writes, the uniqueness rules and the scoring rules. Settling
that contract first turns the frontend into a mostly mechanical port against real data, with
nothing to rewire later.

### Phase 0: Foundation (small)
- Scaffold Next.js and TypeScript. ESLint with the layer rules, Prettier, Vitest, Playwright,
  GitHub Actions (lint, typecheck, test).
- Move the prototype to `prototype/app.html` as the visual reference.
- Port `tokens.css` (light and dark).
- **QA gate:** CI is green on a clean clone. `pnpm dev` boots. The layer rule fails on a planted
  bad import.

### Phase 1: Backend
- Drizzle schema, migrations and station seed.
- `domain/`: port `stats`, `stationOfMonth`, ranking and passport from the prototype, plus unit
  tests on fixtures copied from it.
- Auth (invite code, members, device tokens, cookie).
- Services and the API routes above, with Zod validation.
- **QA gate:** API integration tests on PGlite cover:
  - every MUST acceptance criterion on the server side (M1, M2, M3 idempotency and edit
    behavior, M5 same-day rule)
  - a 401 when there's no session
  - malformed input
  - the rankings and Station of the Month match the prototype on the same data.

### Phase 2: Frontend, read paths
- The `ui/` components, routing (M4), and the Explore list and map, Station, Ranks, Passport and
  Crew screens (read-only) wired to real data.
- **QA gate:** Playwright at 390×844 in light and dark:
  - deep links work, and back restores filters and scroll position
  - no horizontal scroll
  - no accessibility violations from axe
  - bundle under 150KB gzipped, first render under 3 seconds on Slow 3G
  - screenshots side by side with the prototype.
- **Product review:** walk journeys B and D.

### Phase 3: Frontend, write paths
- `/join` onboarding and the device link.
- Rate flow (M3): prefilled station, scores first, "Add more" collapsed, sticky Post button, draft
  autosave, outbox, edit mode when you've already reviewed. After posting, land on the station
  page with your review on top, plus the pin glow and stamp animation.
- One-tap check-in (M5). Edit and delete your own reviews.
- **QA gate:**
  - a scores-only review posts in 20 seconds or less
  - in airplane mode, Post shows "Saved, will post when you're back online"; on reconnect it posts
    exactly once
  - a reload restores the draft
  - duplicate review and same-day check-in rules work end to end
  - every tap target is at least 44px.
- **Product review:** walk journeys A and C on a throttled phone profile.

### Phase 4: Ship
- Create the Neon database and Vercel project. Set `CREW_CODE` and `DATABASE_URL`. Run migrations
  in the deploy step.
- Add the Open Graph preview card for shared links. Do a smoke test on prod. Invite the crew.
- **QA gate:** production smoke test of journeys A–D on a real phone.

After launch, v1.1 covers photos (Vercel Blob), the "new since your last visit" dot and bigger map
tap targets.

## 7. Engineering principles

- Business rules go in `domain/` as pure functions with tests. Routes and components stay thin.
- The database enforces data rules (UNIQUE, CHECK, foreign keys). App code doesn't re-check them.
- One way to do each thing: Server Components for reads, idempotent `PUT` for writes.
- No new dependency without a reason written in the PR. No state library, no UI kit.
- Every phase merges through a PR with CI green and the QA report attached.

## 8. Risks

| Risk | Mitigation |
|---|---|
| The invite code leaks | Rotate the env var. Existing device sessions keep working |
| Vercel and Neon cold starts make the first load feel slow | Neon pooled connection. Static shell. Measured at the Phase 2 gate |
| The station list is out of date | Seed file plus an `active` flag. The owner fixes it in one PR |
| The repo can't be pushed from this environment | The Claude GitHub App needs access to `michaelohyang/WeWalk` before Phase 0 |

## 9. Decisions needed from the owner

| # | Decision | Recommended default |
|---|---|---|
| 1 | Stack and hosting | Next.js + Neon + Vercel (free tiers) |
| 2 | Scoring display | Tap 1–5 per category, category scores shown /5, overall station score shown as the /10 circle |
| 3 | Passport | Personal ("your stamps"), with crew coverage as a secondary stat |
| 4 | Identity | Invite code + display name + personal device link, no email |
| 5 | Station management | Only the owner, through the seed file. No add or remove in the app for v1 |
| 6 | Building list | Send the real list. Otherwise we launch with the 25 in the prototype |
