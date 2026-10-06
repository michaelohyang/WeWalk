import { monthOf, type IsoDate } from "./dates";
import { rankStations } from "./ranking";
import type { CheckinRecord, ReviewRecord, Visit } from "./records";
import { scoreStation, type StationScore } from "./scoring";
import type { Tag } from "./tags";

type StationRef = { slug: string; name: string };

export interface StationSummary {
  score: StationScore;
  visited: boolean;
  lastVisit: IsoDate | null;
  /** Most recent hot take: latest visit first, then latest edit. */
  hotTake: { text: string; memberId: string } | null;
  /** Most-picked tags first. */
  tags: { tag: Tag; count: number }[];
}

export function summarizeStation(
  stationSlug: string,
  reviews: readonly ReviewRecord[],
  checkins: readonly CheckinRecord[],
): StationSummary {
  const rs = reviews.filter((r) => r.stationSlug === stationSlug);
  const visits: Visit[] = [...rs, ...checkins.filter((c) => c.stationSlug === stationSlug)];
  const lastVisit = visits.reduce<IsoDate | null>(
    (max, v) => (max === null || v.visitedOn > max ? v.visitedOn : max),
    null,
  );

  const hot = rs
    .filter((r) => r.hotTake.trim() !== "")
    .sort(
      (a, b) => b.visitedOn.localeCompare(a.visitedOn) || b.updatedAt.localeCompare(a.updatedAt),
    )[0];

  const counts = new Map<Tag, number>();
  for (const r of rs) for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  const tags = [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

  return {
    score: scoreStation(rs),
    visited: visits.length > 0,
    lastVisit,
    hotTake: hot ? { text: hot.hotTake, memberId: hot.memberId } : null,
    tags,
  };
}

/**
 * Station of the Month: the best-scored station with a visit (review or check-in) in `month`.
 * If nobody went anywhere that month, the all-time best, with `fresh: false`.
 */
export function stationOfMonth(
  stations: readonly StationRef[],
  reviews: readonly ReviewRecord[],
  checkins: readonly CheckinRecord[],
  month: string,
): { stationSlug: string; fresh: boolean } | null {
  const scores = new Map(
    stations.map((s) => [s.slug, scoreStation(reviews.filter((r) => r.stationSlug === s.slug))]),
  );
  const activeIds = new Set(
    [...reviews, ...checkins]
      .filter((v) => monthOf(v.visitedOn) === month)
      .map((v) => v.stationSlug),
  );

  const fresh = rankStations(
    stations.filter((s) => activeIds.has(s.slug)),
    scores,
    "overall",
  )[0];
  if (fresh) return { stationSlug: fresh.stationSlug, fresh: true };

  const allTime = rankStations(stations, scores, "overall")[0];
  return allTime ? { stationSlug: allTime.stationSlug, fresh: false } : null;
}

export interface Passport {
  /** One stamp per station this member has visited, earliest first. */
  stamps: { stationSlug: string; firstVisit: IsoDate }[];
  /** Stations anyone in the crew has visited. */
  crewVisited: number;
  total: number;
}

/** A member's personal passport, over the stations currently on the map. */
export function passportFor(
  memberId: string,
  stations: readonly { slug: string }[],
  visits: readonly Visit[],
): Passport {
  const onMap = new Set(stations.map((s) => s.slug));
  const first = new Map<string, IsoDate>();
  const crew = new Set<string>();

  for (const v of visits) {
    if (!onMap.has(v.stationSlug)) continue;
    crew.add(v.stationSlug);
    if (v.memberId !== memberId) continue;
    const seen = first.get(v.stationSlug);
    if (seen === undefined || v.visitedOn < seen) first.set(v.stationSlug, v.visitedOn);
  }

  const stamps = [...first]
    .map(([stationSlug, firstVisit]) => ({ stationSlug, firstVisit }))
    .sort(
      (a, b) =>
        a.firstVisit.localeCompare(b.firstVisit) || a.stationSlug.localeCompare(b.stationSlug),
    );

  return { stamps, crewVisited: crew.size, total: onMap.size };
}
