import "server-only";
import { AREAS, CITIES } from "@/domain/areas";
import type { Db } from "../../db/client";
import type { Session } from "../auth";
import { listStationsForAdmin, type AdminStation } from "../stations";

/* The owner's building admin: every station, hidden ones included, by city then area. */

export interface StationAdminView {
  cities: {
    key: string;
    name: string;
    count: number;
    areas: { key: string; label: string; stations: AdminStation[] }[];
  }[];
}

export async function stationAdminView(db: Db, session: Session): Promise<StationAdminView> {
  const all = await listStationsForAdmin(db, session);
  return {
    cities: CITIES.map((c) => {
      const areas = AREAS.filter((a) => a.city === c.key)
        .map((a) => ({
          key: a.key,
          label: a.label,
          stations: all.filter((s) => s.area === a.key),
        }))
        .filter((a) => a.stations.length > 0);
      return {
        key: c.key,
        name: c.name,
        count: areas.reduce((n, a) => n + a.stations.length, 0),
        areas,
      };
    }),
  };
}
