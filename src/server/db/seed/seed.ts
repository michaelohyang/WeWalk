import type { Db } from "../client";
import { stations } from "../schema";
import { STATIONS } from "@/domain/stations";

/**
 * Adds stations from the seed file whose slugs aren't in the database yet, and returns how many
 * it added. Existing rows are never touched: the database is the source of truth, and the owner
 * edits and hides buildings at /admin/stations, so a deploy must not undo those edits (or
 * un-hide a station). Inserting only what's new also keeps the id sequence free of gaps.
 */
export async function seedStations(db: Db): Promise<number> {
  const existing = new Set(
    (await db.select({ slug: stations.slug }).from(stations)).map((r) => r.slug),
  );
  // The integer key is assigned by the database.
  const fresh = STATIONS.filter((s) => !existing.has(s.slug)).map((s) => ({
    ...s,
    hidden: s.hidden ?? false,
  }));
  if (fresh.length) await db.insert(stations).values(fresh);
  return fresh.length;
}
