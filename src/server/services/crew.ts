import "server-only";
import type { CheckinRecord, ReviewRecord } from "@/domain/records";
import type { Db } from "../db/client";
import { listCheckins } from "../repos/checkins";
import { listMembers } from "../repos/members";
import { listReviews } from "../repos/reviews";
import { listVisibleStations, type StationRow } from "../repos/stations";

export type Station = Omit<StationRow, "createdAt">;

export interface CrewData {
  /** Stations on the map (not hidden), A–Z. */
  stations: Station[];
  members: { id: string; name: string }[];
  /** Reviews and check-ins for stations on the map. */
  reviews: ReviewRecord[];
  checkins: CheckinRecord[];
}

/**
 * Everything the read screens need, in one round of queries. At ~30 stations and a few hundred
 * reviews this is small; aggregates are computed by domain/ functions, not SQL.
 */
export async function loadCrew(db: Db): Promise<CrewData> {
  const [stationRows, members, reviews, checkins] = await Promise.all([
    listVisibleStations(db),
    listMembers(db),
    listReviews(db),
    listCheckins(db),
  ]);
  const onMap = new Set(stationRows.map((s) => s.id));
  return {
    stations: stationRows.map(({ createdAt, ...s }) => (void createdAt, s)),
    members,
    reviews: reviews.filter((r) => onMap.has(r.stationId)),
    checkins: checkins.filter((c) => onMap.has(c.stationId)),
  };
}
