import "server-only";
import { eq, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { stations } from "../db/schema";

/**
 * A station as the app sees it, named by its slug (dock-72): what URLs, API payloads and the
 * seed file use. The database's integer key stays inside the repos (see `stationKey`).
 */
export interface StationRow {
  slug: string;
  name: string;
  /** "450 Lex"; null means use the name. */
  short: string | null;
  address: string;
  neighborhood: string;
  area: string;
  lat: number;
  lng: number;
  hidden: boolean;
  createdAt: Date;
}

const columns = {
  slug: stations.slug,
  name: stations.name,
  short: stations.short,
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

/** Every station, hidden ones included (the owner's station admin). About 40 rows. */
export async function listAllStations(db: Db): Promise<StationRow[]> {
  return db.select(columns).from(stations).orderBy(stations.name);
}

export type StationFields = Omit<StationRow, "slug" | "createdAt">;

export async function insertStation(
  db: Db,
  slug: string,
  fields: StationFields,
): Promise<StationRow> {
  const [row] = await db
    .insert(stations)
    .values({ slug, ...fields })
    .returning(columns);
  return row!;
}

/** Updates everything but the slug, which never changes. Undefined if there's no such station. */
export async function updateStation(
  db: Db,
  slug: string,
  fields: StationFields,
): Promise<StationRow | undefined> {
  const [row] = await db
    .update(stations)
    .set(fields)
    .where(eq(stations.slug, slug))
    .returning(columns);
  return row;
}

export async function findStation(db: Db, slug: string): Promise<StationRow | undefined> {
  const [row] = await db.select(columns).from(stations).where(eq(stations.slug, slug));
  return row;
}

/** The integer key for a slug, as a SQL expression to use in inserts and filters. */
export const stationKey = (slug: string) =>
  sql<number>`(select ${stations.id} from ${stations} where ${stations.slug} = ${slug})`;
