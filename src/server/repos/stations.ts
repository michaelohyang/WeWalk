import "server-only";
import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { stations } from "../db/schema";

export type StationRow = typeof stations.$inferSelect;

export async function listVisibleStations(db: Db): Promise<StationRow[]> {
  return db.select().from(stations).where(eq(stations.hidden, false)).orderBy(stations.name);
}

export async function findStation(db: Db, id: string): Promise<StationRow | undefined> {
  const [row] = await db.select().from(stations).where(eq(stations.id, id));
  return row;
}
