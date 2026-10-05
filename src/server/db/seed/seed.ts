import { sql } from "drizzle-orm";
import type { Db } from "../client";
import { stations } from "../schema";
import { STATIONS } from "@/domain/stations";

/** Upserts every station from the seed file. Stations missing from the file are left alone. */
export async function seedStations(db: Db): Promise<number> {
  const rows = STATIONS.map((s) => ({ ...s, hidden: s.hidden ?? false }));
  await db
    .insert(stations)
    .values(rows)
    .onConflictDoUpdate({
      target: stations.id,
      set: {
        name: sql`excluded.name`,
        address: sql`excluded.address`,
        neighborhood: sql`excluded.neighborhood`,
        area: sql`excluded.area`,
        lat: sql`excluded.lat`,
        lng: sql`excluded.lng`,
        hidden: sql`excluded.hidden`,
      },
    });
  return rows.length;
}
