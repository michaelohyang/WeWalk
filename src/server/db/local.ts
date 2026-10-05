import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import type { Db } from "./client";
import * as schema from "./schema";
import { seedStations } from "./seed/seed";

// Resolved from the project root (where tests, `next dev` and `next start` run), not via
// import.meta.url, which the bundler would try to treat as an asset.
const migrationsFolder = path.join(process.cwd(), "src/server/db/migrations");

/**
 * An embedded Postgres (PGlite) with migrations applied and stations seeded. Used by tests and
 * by local dev / e2e via `DATABASE_URL=pglite:memory` or `pglite:<dir>`. Never in production.
 */
export async function openLocalDb(dataDir?: string): Promise<Db> {
  const db = drizzle(new PGlite(dataDir), { schema });
  await migrate(db, { migrationsFolder });
  await seedStations(db);
  return db;
}
