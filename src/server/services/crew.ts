import "server-only";
import type { ReactionRecord } from "@/domain/reactions";
import type { CheckinRecord, ReviewRecord } from "@/domain/records";
import type { Db } from "../db/client";
import { listCheckins, listCheckinsBy } from "../repos/checkins";
import { listCrewMembers } from "../repos/crews";
import { listReactions } from "../repos/reactions";
import { listReviews, listReviewsBy } from "../repos/reviews";
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
 * Everything one crew's read screens need, in one round of queries: its members, the reviews and
 * check-ins shared with it, and the reactions made in it. Small per crew; aggregates are computed
 * by domain/ functions, not SQL.
 */
export async function loadCrew(db: Db, crewId: string): Promise<CrewData> {
  const [stationRows, members, allReviews, checkins, reactions] = await Promise.all([
    listVisibleStations(db),
    listCrewMembers(db, crewId),
    listReviews(db, crewId),
    listCheckins(db, crewId),
    listReactions(db, crewId),
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

/** Your own reviews and check-ins in every crew: your passport, badges and streak are yours. */
export interface MyVisits {
  reviews: ReviewRecord[];
  checkins: CheckinRecord[];
}

export async function loadMyVisits(db: Db, memberId: string): Promise<MyVisits> {
  const [reviews, checkins] = await Promise.all([
    listReviewsBy(db, memberId),
    listCheckinsBy(db, memberId),
  ]);
  return { reviews, checkins };
}
