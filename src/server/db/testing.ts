import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import type { Db } from "./client";
import * as schema from "./schema";
import { seedStations } from "./seed/seed";

const migrationsFolder = fileURLToPath(new URL("./migrations", import.meta.url));

/** A fresh in-memory Postgres with migrations applied and stations seeded. For tests only. */
export async function createTestDb(): Promise<Db> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder });
  await seedStations(db);
  return db;
}

/** Empties everything except stations, between tests. */
export async function resetTestDb(db: Db): Promise<void> {
  await db.execute(
    sql`truncate reviews, checkins, links, devices, members restart identity cascade`,
  );
}
