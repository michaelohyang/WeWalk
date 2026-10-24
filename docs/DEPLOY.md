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

   For review photos, also create a Blob store: **Storage → Create → Blob** (Public), then
   connect it to this project for Production and Preview. That adds `BLOB_STORE_ID`, and
   deployments sign in to the store on their own (no token to copy). Redeploy afterwards. Without
   it the app works, but photo uploads say "Photos aren't set up yet."

3. **Deploy.** The build log should show:
   ```
   db:deploy: migrations applied.
   db:deploy: added 41 new stations.
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

- **Stations:** the owner adds, edits and hides buildings at Crew → "Manage buildings"
  (`/admin/stations`); no deploy needed. To retire one, hide it (its reviews are kept, frozen).
  The seed only adds slugs from `src/domain/stations.ts` that the database doesn't have yet;
  it never overwrites an edit or un-hides a station.
- **Schema changes:** edit `src/server/db/schema.ts`, run `pnpm db:generate`, commit the new
  migration; the next production deploy applies it.
- **Someone forgot their password:** the owner opens Crew → "Forgot password help" and sends
  them a one-time link. It logs them in once and they pick a new password.
- **Passwords** are stored as salted scrypt hashes (`members.password_hash`); nobody, including
  whoever can read the database, can see them. Five wrong passwords in a row lock the account for
  15 minutes.

## Rolling back past the multi-city release

Boston and Atlanta (12 stations) arrived with migration `0005_more_cities`. Code from before it
would show their pins in New York's screens and count them toward Completionist. Before
redeploying older code, hide them (reviews and check-ins are kept):

```sql
update stations set hidden = true where area not in ('uptown', 'midtown', 'flatiron', 'downtown', 'brooklyn');
```
