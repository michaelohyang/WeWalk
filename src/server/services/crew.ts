import "server-only";
import type { ReactionRecord } from "@/domain/reactions";
import type { CheckinRecord, ReviewRecord } from "@/domain/records";
import type { Db } from "../db/client";
import { listCheckins } from "../repos/checkins";
import { listMembers } from "../repos/members";
import { listReactions } from "../repos/reactions";
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
  /** Reactions to those reviews. */
  reactions: ReactionRecord[];
}

/**
 * Everything the read screens need, in one round of queries. At ~30 stations and a few hundred
 * reviews this is small; aggregates are computed by domain/ functions, not SQL.
 */
export async function loadCrew(db: Db): Promise<CrewData> {
  const [stationRows, members, allReviews, checkins, reactions] = await Promise.all([
    listVisibleStations(db),
    listMembers(db),
    listReviews(db),
    listCheckins(db),
    listReactions(db),
  ]);
  const onMap = new Set(stationRows.map((s) => s.slug));
  const reviews = allReviews.filter((r) => onMap.has(r.stationSlug));
  const shown = new Set(reviews.map((r) => r.id));
  return {
    stations: stationRows.map(({ createdAt, ...s }) => (void createdAt, s)),
    members,
    reviews,
    checkins: checkins.filter((c) => onMap.has(c.stationSlug)),
    reactions: reactions.filter((r) => shown.has(r.reviewId)),
  };
}
