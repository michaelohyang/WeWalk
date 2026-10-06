# WeWalk v1: product and engineering plan

Status: **approved.** All owner decisions are made (section 9). Phase 0 is in progress. No production code until it's approved.

The prototype in `src/app.html` is now the spec for design and flow. This plan covers turning
it into a real web app that a group of friends can share from one link.

---

## 1. Product goals

- One link, shared by about 5–15 friends, covering 29 NYC WeWork buildings.
- Rating a building from a lobby, one-handed, on a weak signal, takes **under 20 seconds**.
- When you're deciding where to work tomorrow, the answer ("best Wi-Fi near Flatiron?") is two
  taps away.
- Keep the Beli-style design (white canvas, teal, colored score circles) and the casual copy.

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
| | M2 Identity: join from an invite link, pick a display name once (unique ignoring case), add another phone with a one-time pairing link, sign out a lost phone |
| | M3 Lobby-proof rate flow: one review per person per station (posting again edits it), scores first with text folded under "Add more", draft autosave, offline outbox |
| | M4 Real URLs: `/`, `/stations/[slug]`, `/rate/[slug]`, `/ranks`, `/passport`, `/crew` |
| | M5 One-tap check-in with an optional note |
| | M6 Port Explore (list and map), Station, Ranks, Passport and Crew as designed |
| **SHOULD (v1.1)** | Photos on object storage (with delete). A dot for activity since your last visit. Bigger map tap targets |
| **LATER** | Station management in the app. Using location to pick the station. Notifications. Data export |

## 4. Tech stack

**Choice:** Next.js (App Router), TypeScript, Postgres on **Supabase**, Drizzle ORM, Zod, plain
CSS Modules with our design tokens, hosted on Vercel.

**How we use Supabase:** only as the hosted Postgres database and, from v1.1, Storage for photos.
Only our Next.js server connects to it, through the repo layer with a server-side connection
string. The browser never talks to Supabase directly. We don't use Supabase Auth, its
auto-generated API or row-level-security policies. This keeps all the rules in TypeScript, where
they're tested, and swapping Postgres hosts later only means changing a connection string.

Why this stack, keeping it pragmatic:

- **One repo, one deploy, one language.** The UI and the API live in the same Next.js app. There's
  no separate backend service to run for 15 users.
- **Supabase gives us Postgres plus file storage in one dashboard.** Photos (v1.1) don't need a
  second vendor, and live updates are available later if we want them.
- **Postgres fits the rules we need.** "One review per person per station" and "unique names
  ignoring case" become database constraints instead of app code that has to remember them.
  Supabase's free tier is enough for this size (see Risks for the idle pause).
- **Drizzle** keeps queries typed and close to SQL, with migrations as plain SQL files. It has no
  runtime cost to speak of.
- **Zod** schemas validate requests at the API boundary, and the same types are used on the client.
- **Plain CSS Modules and custom properties.** The prototype's tokens move over as they are, with
  no Tailwind conversion. It also helps keep our own code small (see the size budget, §9).
- **Vercel and Supabase** both have free tiers. Vercel gives a preview deploy for each pull request
  and a working link in minutes.

Options I considered and turned down:

- **Supabase as the whole backend (the browser talks to the database, protected by row-level
  security).** Our identity model (one person across phones with no email) isn't a Supabase Auth
  pattern, so we'd still need our own server code. The access rules would also live in SQL
  policies that are hard to test, and one loose policy exposes the database.
- **Neon.** Also good Postgres. Its free tier wakes automatically when idle, but it has no file
  storage, so photos would need another vendor.
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
    (app)/stations/[slug]/page.tsx  # Station
    (app)/rate/[id]/page.tsx
    (app)/ranks|passport|crew/page.tsx
    login/ signup/             # username + password
    recover/[token]/page.tsx  # one-time recovery link page; its button POSTs /api/recover
    api/…/route.ts          # JSON endpoints (writes)
  domain/                   # pure TS, no I/O: categories, scoring, ranking, stationOfMonth, passport,
                            # the station list, map projection
  server/
    db/schema.ts, db/client.ts, db/migrations/   # client: postgres-js → Supabase pooler
    db/seed/                # `pnpm db:seed`: upserts domain/stations.ts (the station list)
    auth/tokens.ts          # random tokens, hashing, constant-time compare
    http.ts                 # route plumbing: session cookie, JSON validation, errors → status, same-origin
    repos/                  # stations, members, reviews, checkins (SQL lives here only)
    services/               # use cases: postReview, checkIn, joinCrew (validation + repos + domain)
    storage/                # v1.1: Supabase Storage wrapper (signed upload URLs), server-only
  ui/                       # components: ScoreCircle, StationRow, Chip, Sheet, TabBar, MapSvg, tokens.css
  client/                   # draft autosave, outbox (retry queue)
tests/ (e2e)                # unit tests sit next to the code they test
```

**Dependency rule:** `app → services → repos/domain`. `domain` imports nothing from the other
layers. `ui` never imports `server`. CI enforces this with ESLint `no-restricted-imports`.

**Database connection.** Vercel functions connect through Supabase's transaction pooler (port
6543), with `prepare: false` because the pooler doesn't support prepared statements. Migrations
run with the direct connection string. Defense in depth: row-level security is **on, with no
policies**, on every table, and the Supabase keys never ship to the browser. Even if the
auto-generated API is reachable, it returns nothing.

**Reads.** Server Components load station and review rows and compute aggregates in `domain/`.
With 29 stations and a few hundred reviews, that's microseconds. The scoring logic stays
pure and unit-tested instead of buried in SQL.

**Writes.** JSON `PUT` with **client-generated UUIDs**, so a retry can never create a duplicate.
The offline outbox simply replays the same request. After a write, `router.refresh()` reloads the
data. No realtime in v1: friends see new posts when they refresh or navigate, which meets the
"within 5 seconds" criterion.

**Auth (username + password; revised after launch, replacing invite codes and pairing links).**
- **Accounts:** sign up at `/signup` with a username (the display name; unique ignoring case) and
  a password of 8+ characters. Log in anywhere at `/login`. No email.
- **Passwords** are stored only as salted scrypt hashes (`members.password_hash`,
  `scrypt$15$8$1$<salt>$<hash>`): nobody reading the database can recover them. Login failures all
  say "Wrong username or password." and an unknown name is checked against a decoy hash, so
  neither the message nor the timing reveals who has an account. Five wrong passwords in a row
  lock the account for 15 minutes.
- **Owner:** the first person to sign up becomes the owner. A partial unique index guarantees
  there's only ever one. Sign up first after deploying.
- **Sessions:** each login gets a random 32-byte device token. Its SHA-256 hash is stored in
  `devices`, and the token itself goes in an httpOnly, Secure, SameSite=Lax cookie. Crew lists
  the devices you're logged in on and signs any of them out.
- **Shared phones:** a second, readable cookie (`ww_member`, just the member id) lets the client
  keep drafts and the offline outbox per member. Queued writes carry their author in an
  `x-wewalk-member` header; the server answers 401 if it isn't the signed-in member, and the
  outbox holds the write (it never posts under someone else's name, and never drops it).
- **Forgot password:** the owner creates a one-time recovery link (`/recover/<token>`, 24 hours,
  redeemed by POST so link previews can't use it up). It logs that person in once and clears
  their password, and they set a new one in Crew. People who joined before passwords existed
  also set theirs in Crew.
- **Names:** reviews point at `member_id`, so renaming yourself updates your name everywhere.
- **Writes** must carry an `Origin` header equal to the site's own origin (browsers always send
  it), have a JSON body, and be at most 64 KB.
- **Access:** every page and API route needs a session. Signed out, any page shows the login
  form, and logging in reloads that page (so shared station links work).

**Scoring (decided: one scale, out of 5).**
- You tap 1–5 per category, and every score is shown out of 5 with one decimal.
- **A person's overall score** for a building is the average of the categories they rated.
- **A building's overall score** is the average of each person's overall score, so each friend
  counts once however many categories they rated.
- **A category score** is the average of the people who rated that category.
- **Ties in rankings:** buildings that show the same score (one decimal) are ordered by more
  reviews, then name A–Z. What you see decides, not hidden digits.
- This intentionally differs from the prototype, which averaged the category averages. That let
  someone who rated all nine categories outweigh someone who rated one. Rankings and Station of
  the Month otherwise follow the prototype's rules (`domain/activity.ts`). `domain/parity.test.ts`
  checks this against the prototype's own code.
- **Score colors:** 4.3 and up green, 3.5 and up lime, 2.8 and up amber, below that red.

**Passport (decided: personal).** You get a stamp the first time you check in at or review a
building, dated that day. A line underneath shows crew coverage ("Crew: 14 / 29"). The map stays
crew-wide: a building shows as visited if anyone in the crew has been.

### Data model

```
stations  id integer PK (identity) · slug UNIQUE (dock-72: URLs, API, seed) · name · address · neighborhood · area · lat · lng
          · hidden bool · created_at          -- hidden keeps reviews and stamps
                                              -- the map projects lat/lng (Phase 2)
members   id uuid PK · name · name_key (lower/trimmed, UNIQUE) · is_owner · created_at
devices   id uuid PK · member_id FK · token_hash UNIQUE · label · created_at · last_seen_at
links     id uuid PK · member_id FK · token_hash UNIQUE · purpose (pair|recover)
          · expires_at · used_at              -- one-time pairing and recovery links
reviews   id uuid PK (client-generated) · station_id FK · member_id FK · visited_on date
          · coffee … vibe  smallint NULL CHECK 1..5 (9 columns) · hot_take · body · tags text[]
          · created_at · updated_at · UNIQUE(station_id, member_id)
          · CHECK at least one score not null · photo_url (one photo, in Vercel Blob)
checkins  id uuid PK · station_id FK · member_id FK · visited_on date · note
          · UNIQUE(station_id, member_id, visited_on)
reactions review_id FK (cascade) · member_id FK · kind (fire, hundred, laugh, disagree)
          · PK(review_id, member_id, kind)
```

"Here today" (Explore) is read from check-ins: each person's latest check-in dated today in New
York, with the time it was made.

Each category is its own column rather than one JSON field, so sorting rankings by category is
plain SQL and the database rejects bad values.

### API (writes; reads go through Server Components)

| Method | Path | Notes |
|---|---|---|
| POST | `/api/signup` | `{name, password}` → sets cookie. 409 if the name is taken |
| POST | `/api/login` | `{name, password}` → sets cookie. 401 for a wrong name or password alike |
| PUT | `/api/me/password` | `{current?, password}`: set your first password, or change it with the current one |
| POST | `/api/recover` | `{token}` → uses a one-time recovery link, sets cookie. 410 if expired or used |
| GET | `/api/me` | you, plus the phones you're signed in on |
| PUT | `/api/reviews/:id` | create or update your review. 409 if you already reviewed this station under a different id (the client then switches to edit) |
| DELETE | `/api/reviews/:id` | only your own |
| PUT | `/api/reviews/:id/reactions/:kind` | react to someone else's review (🔥 💯 😂 🙅). Idempotent; 400 on your own review |
| DELETE | `/api/reviews/:id/reactions/:kind` | take back your reaction. Idempotent |
| POST | `/api/photos` | a JPEG (≤ 2 MB, shrunk on the phone first) → `{url}` to put on a review as `photoUrl`. Stored in Vercel Blob; in memory locally. 503 when Blob isn't set up on a deployment |
| PUT | `/api/checkins/:id` | create, or add/change the note when the same id is sent again (an identical retry is a no-op). 409 with `existingId` on a second id for the same station and day |
| DELETE | `/api/me/devices/:id` | signs out one of your phones |
| PATCH | `/api/me` | renames you. 409 if the name is taken |
| POST | `/api/admin/recovery-links` | owner only: `{memberId}` → one-time recovery link (24 h) |

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
  - every table has row-level security enabled (a test checks `pg_class.relrowsecurity`).

### Phase 2: Frontend, read paths
- The schematic map is redrawn to reach Harlem (126th St) and the Upper East Side, and pins are
  re-placed for the 29 real buildings. Labels and tap targets get checked at 390px.
- The `ui/` components, routing (M4), and the Explore list and map, Station, Ranks, Passport and
  Crew screens (read-only) wired to real data.
- **QA gate:** Playwright at 390×844 in light and dark:
  - deep links work, and back restores filters and scroll position
  - no horizontal scroll
  - no accessibility violations from axe
  - first-load JS + CSS under 200 KB gzipped, of which our own code (beyond React and Next.js)
    under 40 KB; first render under 3 seconds on Slow 3G
  - screenshots side by side with the prototype.
- **Product review:** walk journeys B and D.

### Phase 3: Frontend, write paths
- Invite-link onboarding (`/join/<code>`), pairing links and the device list in Crew.
- Rate flow (M3): prefilled station, scores first, "Add more" collapsed, sticky Post button, draft
  autosave, outbox, edit mode when you've already reviewed. After posting, land on the station
  page with your review on top, plus the pin glow and stamp animation.
- One-tap check-in (M5). Edit and delete your own reviews.
- The rate screen is full-screen: the tab bar hides on `/rate` so the sticky Post button owns the
  bottom of the screen.
- **QA gate:**
  - a scores-only review posts in 20 seconds or less
  - in airplane mode, Post shows "Saved, will post when you're back online"; on reconnect it posts
    exactly once
  - a reload restores the draft
  - duplicate review and same-day check-in rules work end to end
  - every tap target is at least 44px.
- **Product review:** walk journeys A and C on a throttled phone profile.

### Phase 4: Ship
Step-by-step guide: [`docs/DEPLOY.md`](DEPLOY.md). In the repo: `pnpm db:deploy` (migrations, seed,
RLS check) runs before production builds only (`vercel.json`); `pnpm smoke <url>` is a read-only
production check; security headers (no-referrer, so invite codes in URLs never leak),
noindex everywhere, a generic Open Graph card, TLS to the database.
- Create the Supabase project and the Vercel project. Set `CREW_CODE`, `DATABASE_URL` (pooled) and
  `DIRECT_URL` (migrations). Run migrations in the deploy step. Confirm row-level security is on
  for every table.
- Add the Open Graph preview card for shared links. Do a smoke test on prod. Invite the crew.
- **QA gate:** production smoke test of journeys A–D on a real phone.

After launch, v1.1 covers photos (Supabase Storage: a private bucket, uploads through signed URLs
created by our server, images served through signed URLs), the "new since your last visit" dot and bigger map
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
| The Supabase free tier pauses a project after a stretch of no activity (about a week, last checked), and it has to be restored by hand | Either a scheduled Vercel cron that pings the database daily, or the Pro plan ($25/mo). Check Supabase's current policy at Phase 4 |
| Behind Vercel's proxy, `req.nextUrl.origin` doesn't match the public https origin, so every write gets 403 | Check a write against the production URL in the Phase 4 smoke test |
| Serverless functions run out of database connections | Always use the transaction pooler URL in the app. The direct URL is for migrations only |
| Supabase's auto-generated API exposes tables | Row-level security on with no policies. Keys stay server-side. Checked at the Phase 1 gate |
| Cold starts make the first load feel slow | Static shell. Measured at the Phase 2 gate |
| The station list is out of date | Seed file plus an `active` flag. The owner fixes it in one PR |
| The repo can't be pushed from this environment | The Claude GitHub App needs access to `michaelohyang/WeWalk` before Phase 0 |

## 9. Owner decisions (made)

| # | Decision | Outcome |
|---|---|---|
| 1 | Stack and hosting | Next.js on Vercel, Supabase for Postgres and Storage, accessed only from our server |
| 2 | Scoring | One scale: tap 1–5, every score shown out of 5 (section 5) |
| 3 | Passport | Personal, with crew coverage as a secondary stat. The map stays crew-wide |
| 4 | Identity | Username + password (scrypt-hashed), device sign-out, owner-issued recovery links. Replaced the original invite code and pairing links after launch |
| 5 | Stations | Owner only, through the seed file. Removing a station hides it and keeps its data. "Suggest a building" comes later |
| 6 | Building list | The owner's list of 29 (appendix A) |
| 7 | Size budget | First-load JS + CSS ≤ 200 KB gzipped (React and Next.js alone are ~120 KB), with our own code ≤ 40 KB. Enforced by an e2e test. Revisit if performance becomes a problem |

## Appendix A: Stations (seed data, from the owner)

`neighborhood` is shown on rows. `area` drives the filter chips: five chips instead of 16.

| # | Name | Address | Neighborhood | Area |
|---|---|---|---|---|
| 1 | 250 Broadway | 250 Broadway, New York, NY 10007 | Financial District | Downtown |
| 2 | 199 Water St | 199 Water St, New York, NY 10038 | Financial District | Downtown |
| 3 | 450 Lexington Ave | 450 Lexington Ave, New York, NY 10017 | Midtown East | Midtown |
| 4 | 368 9th Ave | 368 9th Ave, New York, NY 10001 | Midtown West | Midtown |
| 5 | 8 W 126th St | 8 W 126th St, New York, NY 10027 | Harlem | Uptown |
| 6 | 430 Park Ave | 430 Park Ave, New York, NY 10022 | Upper East Side | Uptown |
| 7 | 18 W 18th St | 18 W 18th St, New York, NY 10011 | Flatiron | Flatiron |
| 8 | 135 Madison Ave | 135 Madison Ave, New York, NY 10016 | NoMad | Flatiron |
| 9 | 500 7th Ave | 500 7th Ave, New York, NY 10018 | Midtown West | Midtown |
| 10 | 85 Broad St | 85 Broad St, New York, NY 10004 | Financial District | Downtown |
| 11 | 575 Lexington Ave | 575 Lexington Ave, New York, NY 10022 | Midtown East | Midtown |
| 12 | 148 Lafayette St | 148 Lafayette St, New York, NY 10013 | SoHo | Downtown |
| 13 | 160 Varick St | 160 Varick St, New York, NY 10013 | Greenwich Village | Downtown |
| 14 | 1450 Broadway | 1450 Broadway, New York, NY 10018 | Midtown West | Midtown |
| 15 | Dock 72 | Dock 72 Way, Brooklyn, NY 11205 | Brooklyn Navy Yard | Brooklyn |
| 16 | 450 Park Ave S | 450 Park Ave S, New York, NY 10016 | NoMad | Flatiron |
| 17 | 408 Broadway | 408 Broadway, New York, NY 10013 | SoHo | Downtown |
| 18 | 154 W 14th St | 154 W 14th St, New York, NY 10011 | Chelsea | Flatiron |
| 19 | 750 Lexington Ave | 750 Lexington Ave, New York, NY 10022 | Upper East Side | Uptown |
| 20 | 115 Broadway | 115 Broadway, New York, NY 10006 | Financial District | Downtown |
| 21 | 134 N 4th St | 134 N 4th St, Brooklyn, NY 11249 | Williamsburg | Brooklyn |
| 22 | 575 Fifth | 575 5th Ave, New York, NY 10017 | Midtown East | Midtown |
| 23 | 33 Irving Pl | 33 Irving Pl, New York, NY 10003 | Gramercy | Flatiron |
| 24 | 379 W Broadway | 379 W Broadway, New York, NY 10012 | SoHo | Downtown |
| 25 | 195 Montague St | 195 Montague St, 14th Fl, Brooklyn, NY 11201 | Brooklyn Heights | Brooklyn |
| 26 | 1460 Broadway | 1460 Broadway, New York, NY 10036 | Times Square | Midtown |
| 27 | Dumbo Heights | 77 Sands St, Brooklyn, NY 11201 | Dumbo | Brooklyn |
| 28 | 524 Broadway | 524 Broadway, New York, NY 10012 | SoHo | Downtown |
| 29 | 135 W 41st St | 135 W 41st St, New York, NY 10036 | Midtown West | Midtown |

WeWork lists Dock 72 and 195 Montague under "Dumbo". We keep their real neighborhoods.
