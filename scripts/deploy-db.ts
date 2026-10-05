/*
 * `pnpm db:deploy`: run before `next build` on Vercel production deploys (see vercel.json).
 *
 * 1. Applies pending migrations over the direct connection (DIRECT_URL, port 5432).
 * 2. Upserts the station list (idempotent).
 * 3. Fails the deploy if any table in `public` lacks row-level security. Supabase exposes
 *    `public` through its REST API; with RLS on and no policies, nothing leaks that way. Our
 *    server connects as the owner role and isn't affected.
 *
 * Preview deploys skip all of this, so a branch can never migrate the production database.
 */
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { scriptConnectionOptions } from "../src/server/db/connection";
import * as schema from "../src/server/db/schema";
import { seedStations } from "../src/server/db/seed/seed";

if (process.env.VERCEL && process.env.VERCEL_ENV !== "production") {
  console.log(`db:deploy: skipped (VERCEL_ENV=${process.env.VERCEL_ENV}).`);
  process.exit(0);
}

async function main() {
  const url = process.env.DIRECT_URL;
  if (!url) throw new Error("db:deploy needs DIRECT_URL (Supabase direct connection, port 5432).");

  const client = postgres(url, { ...scriptConnectionOptions(url), onnotice: () => {} });
  try {
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "src/server/db/migrations" });
    console.log("db:deploy: migrations applied.");
    console.log(`db:deploy: seeded ${await seedStations(db)} stations.`);

    const open = await db.execute<{ tablename: string }>(
      sql`select tablename from pg_tables where schemaname = 'public' and not rowsecurity`,
    );
    if (open.length) {
      throw new Error(
        `Row-level security is off for: ${open.map((t) => t.tablename).join(", ")}. ` +
          "Enable it in a migration before deploying.",
      );
    }
    console.log("db:deploy: row-level security is on for every public table.");
  } finally {
    await client.end();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
