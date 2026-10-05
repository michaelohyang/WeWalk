import "server-only";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/** Any Drizzle Postgres database with our schema: postgres-js in the app, PGlite in tests. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let db: Db | undefined;

/**
 * The app's database. Uses DATABASE_URL, which must be Supabase's transaction pooler URL
 * (port 6543); the pooler doesn't support prepared statements.
 */
export function getDb(): Db {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    db = drizzle(postgres(url, { prepare: false }), { schema });
  }
  return db;
}

/** Tests swap in an in-memory database. */
export function setDb(next: Db | undefined): void {
  db = next;
}
