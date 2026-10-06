import { eq } from "drizzle-orm";
import type { Db } from "../client";
import { stations } from "../schema";
import { STATIONS } from "@/domain/stations";

/**
 * Brings the stations table in line with the seed file: new slugs are inserted, existing ones
 * updated in place (their integer ids never change). Stations missing from the file are left
 * alone. Inserting only what's new also keeps the id sequence free of gaps (an upsert would use
 * up an id for every row it merely updates).
 */
export async function seedStations(db: Db): Promise<number> {
  // The integer key is assigned by the database.
  const rows = STATIONS.map((s) => ({ ...s, hidden: s.hidden ?? false }));
  const existing = new Set(
    (await db.select({ slug: stations.slug }).from(stations)).map((r) => r.slug),
  );
  const fresh = rows.filter((r) => !existing.has(r.slug));
  if (fresh.length) await db.insert(stations).values(fresh);
  for (const { slug, ...fields } of rows.filter((r) => existing.has(r.slug))) {
    await db.update(stations).set(fields).where(eq(stations.slug, slug));
  }
  return rows.length;
}
