import { sql } from "drizzle-orm";
import { crews, FIRST_CREW_ID } from "./schema";
import type { Db } from "./client";
import { openLocalDb } from "./local";
import { seedStations } from "./seed/seed";

/** A fresh in-memory Postgres with migrations applied and stations seeded. For tests only. */
export function createTestDb(): Promise<Db> {
  return openLocalDb();
}

/**
 * Empties everything between tests and puts the seed stations back as they were (tests add,
 * edit and hide stations; re-seeding alone would keep those changes).
 */
export async function resetTestDb(db: Db): Promise<void> {
  await db.execute(
    sql`truncate reviews, checkins, links, devices, members, crews, stations, rate_limits restart identity cascade`,
  );
  await seedStations(db);
  // The migration's first crew, which sign-ups without an invite join.
  await db.insert(crews).values({ id: FIRST_CREW_ID, name: "NYC crew", inviteCode: "first-crew" });
}
