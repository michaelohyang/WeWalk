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
   | `DIRECT_URL` | the session pooler string (port 5432) |

   For review photos, also create a Blob store: **Storage → Create → Blob**, then connect it to
   this project. That adds `BLOB_READ_WRITE_TOKEN` for you. Without it the app works, but photo
   uploads say "Photos aren't set up yet."

3. **Deploy.** The build log should show:
   ```
   db:deploy: migrations applied.
   db:deploy: seeded 29 stations.
   db:deploy: row-level security is on for every public table.
   ```
   Preview deployments print `db:deploy: skipped` and have no database; that's expected.
4. Optional: **Settings → Domains** to add your own domain. Redeploy after adding it so link
   previews use it.

## 3. Check it, then sign up first

1. From your machine: `pnpm smoke https://<your-app>.vercel.app`. It only reads; expect
   `All 8 checks passed.`
2. **Sign up first.** Open `https://<your-app>/signup` and pick a username and password. The
   first person to sign up becomes the owner (the only one who can make recovery links).
3. Send `https://<your-app>/signup` to your friends (Crew → "Invite friends" has a share button).

## Later

- **New stations:** edit `src/domain/stations.ts` and deploy; the seed upserts them. To retire
  one, set `hidden: true` (its reviews are kept, frozen).
- **Schema changes:** edit `src/server/db/schema.ts`, run `pnpm db:generate`, commit the new
  migration; the next production deploy applies it.
- **Someone forgot their password:** the owner opens Crew → "Forgot password help" and sends
  them a one-time link. It logs them in once and they pick a new password.
- **Passwords** are stored as salted scrypt hashes (`members.password_hash`); nobody, including
  whoever can read the database, can see them. Five wrong passwords in a row lock the account for
  15 minutes.
