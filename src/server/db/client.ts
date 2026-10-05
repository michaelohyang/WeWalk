import "server-only";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { poolOptions } from "./connection";
import * as schema from "./schema";

/** Any Drizzle Postgres database with our schema: node-postgres in the app, PGlite locally. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

// Kept on globalThis so dev-server hot reloads reuse one connection pool / local database.
const cache = globalThis as unknown as { __wewalkDb?: Promise<Db> };

/**
 * The app's database, from DATABASE_URL:
 * - Supabase's transaction pooler URL (port 6543) in production.
 * - `pglite:memory` or `pglite:<dir>` for local dev and e2e: an embedded Postgres, migrated and
 *   seeded on first use.
 */
export function getDb(): Promise<Db> {
  cache.__wewalkDb ??= open(process.env.DATABASE_URL).catch((e: unknown) => {
    cache.__wewalkDb = undefined; // let the next request retry
    throw e;
  });
  return cache.__wewalkDb;
}

async function open(url: string | undefined): Promise<Db> {
  if (!url) throw new Error("DATABASE_URL is not set");
  if (url.startsWith("pglite:")) {
    if (process.env.VERCEL) throw new Error("pglite: is for local development only");
    const dir = url.slice("pglite:".length);
    const { openLocalDb } = await import("./local");
    return openLocalDb(dir === "memory" ? undefined : dir);
  }
  const pool = new Pool(poolOptions(url));
  // Vercel freezes a function between requests; connections left open can die while it's frozen
  // and then hang the next request. This keeps the instance alive just long enough to close idle
  // connections first. (A no-op outside Vercel.)
  attachDatabasePool(pool);
  pool.on("error", (e) => console.error("database pool:", e.message)); // a dropped idle client
  return drizzle(pool, { schema });
}

/** Tests swap in their own database. */
export function setDb(next: Db | undefined): void {
  cache.__wewalkDb = next && Promise.resolve(next);
}
