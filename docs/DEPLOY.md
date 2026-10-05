# Deploying WeWalk

Supabase holds the database; Vercel runs the app. About 20 minutes the first time. Everything
the repo can do on its own already happens on deploy: migrations, the station seed, and a check
that every table has row-level security on.

## 1. Supabase (database)

1. Create a project at [supabase.com](https://supabase.com). Pick a region near Vercel's `iad1`
   (US East), e.g. **East US (North Virginia)**. Save the database password somewhere safe.
2. Open **Connect** (top of the project page) and copy two connection strings, filling in the
   password:
   - **Transaction pooler** (port **6543**) → this is `DATABASE_URL`.
   - **Direct connection** (port **5432**) → this is `DIRECT_URL`. If your network has no
     IPv6, use the **Session pooler** string (also port 5432) instead.
3. Nothing else to set up. Don't create tables by hand; the deploy does it.

## 2. Vercel (app)

1. **Add New → Project**, import `michaelohyang/WeWalk`. Framework: Next.js (detected).
   `vercel.json` already sets the install and build commands; leave them.
2. **Environment Variables** (Production only — previews never touch the database):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the transaction pooler string (port 6543) |
   | `DIRECT_URL` | the direct (or session pooler) string (port 5432) |
   | `CREW_CODE` | a long random code: `openssl rand -hex 16` |

3. **Deploy.** The build log should show:
   ```
   db:deploy: migrations applied.
   db:deploy: seeded 29 stations.
   db:deploy: row-level security is on for every public table.
   ```
   Preview deployments print `db:deploy: skipped` and have no database; that's expected.
4. Optional: **Settings → Domains** to add your own domain. Redeploy after adding it so link
   previews use it.

## 3. Check it, then join first

1. From your machine: `pnpm smoke https://<your-app>.vercel.app`. It only reads; expect
   `All 8 checks passed.`
2. **Join first.** Open `https://<your-app>/j/<CREW_CODE>` on your phone and pick your name.
   The first person to join becomes the owner (the only one who can make recovery links).
3. Share that same link in the group chat. The preview card should show up.

## Later

- **New stations:** edit `src/domain/stations.ts` and deploy; the seed upserts them. To retire
  one, set `hidden: true` (its reviews are kept, frozen).
- **Schema changes:** edit `src/server/db/schema.ts`, run `pnpm db:generate`, commit the new
  migration; the next production deploy applies it.
- **Stop new joins:** change `CREW_CODE` and redeploy. Everyone already in stays signed in.
- **Someone lost their phone:** the owner opens Crew → "Lost phone help" and sends them a
  one-time recovery link.
