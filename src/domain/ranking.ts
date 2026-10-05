import type { CategoryKey } from "./categories";
import { roundScore, type StationScore } from "./scoring";

export type RankKey = "overall" | CategoryKey;

export interface RankedStation {
  stationId: string;
  rank: number;
  value: number;
  reviewCount: number;
}

/**
 * Stations with a score for `key`, best first. Stations showing the same (rounded) score are
 * ordered by more ratings behind that score (reviews for overall, people who rated the
 * category otherwise), then name A–Z. Stations without a score for `key` are left out.
 */
export function rankStations(
  stations: readonly { id: string; name: string }[],
  scores: ReadonlyMap<string, StationScore>,
  key: RankKey,
): RankedStation[] {
  const rows = stations.flatMap((s) => {
    const score = scores.get(s.id);
    const value = key === "overall" ? score?.overall : score?.categories[key];
    if (value == null) return [];
    const reviewCount = key === "overall" ? score!.reviewCount : score!.categoryCounts[key];
    return [{ station: s, value, reviewCount }];
  });

  rows.sort(
    (a, b) =>
      roundScore(b.value) - roundScore(a.value) ||
      b.reviewCount - a.reviewCount ||
      a.station.name.localeCompare(b.station.name, "en-US"),
  );

  return rows.map((r, i) => ({
    stationId: r.station.id,
    rank: i + 1,
    value: r.value,
    reviewCount: r.reviewCount,
  }));
}
