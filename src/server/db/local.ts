import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import type { Db } from "./client";
import * as schema from "./schema";
import { seedStations } from "./seed/seed";

const migrationsFolder = fileURLToPath(new URL("./migrations", import.meta.url));

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
