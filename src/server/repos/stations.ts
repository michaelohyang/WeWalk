import "server-only";
import { eq, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { stations } from "../db/schema";

/**
 * A station as the app sees it. `id` is the slug (dock-72): what URLs, API payloads and the seed
 * file use. The database's integer key stays inside the repos (see `stationKey`).
 */
export interface StationRow {
  id: string;
  name: string;
  address: string;
  neighborhood: string;
  area: string;
  lat: number;
  lng: number;
  hidden: boolean;
  createdAt: Date;
}

const columns = {
  id: stations.slug,
  name: stations.name,
  address: stations.address,
  neighborhood: stations.neighborhood,
  area: stations.area,
  lat: stations.lat,
  lng: stations.lng,
  hidden: stations.hidden,
  createdAt: stations.createdAt,
};

export async function listVisibleStations(db: Db): Promise<StationRow[]> {
  return db.select(columns).from(stations).where(eq(stations.hidden, false)).orderBy(stations.name);
}

export async function findStation(db: Db, slug: string): Promise<StationRow | undefined> {
  const [row] = await db.select(columns).from(stations).where(eq(stations.slug, slug));
  return row;
}

/** The integer key for a slug, as a SQL expression to use in inserts and filters. */
export const stationKey = (slug: string) =>
  sql<number>`(select ${stations.id} from ${stations} where ${stations.slug} = ${slug})`;
