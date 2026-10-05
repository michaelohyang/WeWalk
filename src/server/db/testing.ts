import { sql } from "drizzle-orm";
import type { Db } from "./client";
import { openLocalDb } from "./local";

/** A fresh in-memory Postgres with migrations applied and stations seeded. For tests only. */
export function createTestDb(): Promise<Db> {
  return openLocalDb();
}

/** Empties everything except stations, between tests. */
export async function resetTestDb(db: Db): Promise<void> {
  await db.execute(
    sql`truncate reviews, checkins, links, devices, members restart identity cascade`,
  );
}
