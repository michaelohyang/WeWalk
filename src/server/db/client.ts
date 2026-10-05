import "server-only";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/** Any Drizzle Postgres database with our schema: postgres-js in the app, PGlite locally. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

// Kept on globalThis so dev-server hot reloads reuse one connection pool / local database.
const cache = globalThis as unknown as { __wewalkDb?: Promise<Db> };

/**
 * The app's database, from DATABASE_URL:
 * - Supabase's transaction pooler URL (port 6543) in production. The pooler doesn't support
 *   prepared statements.
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
  return drizzle(postgres(url, { prepare: false }), { schema });
}

/** Tests swap in their own database. */
export function setDb(next: Db | undefined): void {
  cache.__wewalkDb = next && Promise.resolve(next);
}
