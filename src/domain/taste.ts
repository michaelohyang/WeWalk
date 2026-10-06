import { CATEGORY_KEYS, type CategoryKey } from "./categories";
import type { ReviewRecord } from "./records";
import { personOverall } from "./scoring";

/*
 * How the crew's opinions line up: two people's taste, and the buildings that split the crew.
 * Scores run 1–5, so the biggest possible gap on one category is 4.
 */

const MAX_GAP = 4;
/** A category average gap this big counts as "at war". */
const WAR_GAP = 1.5;

export interface TasteMatch {
  /** Buildings you've both reviewed. */
  shared: number;
  /** 0–100: how close your scores are where you both rated something; null if nothing to compare. */
  agreement: number | null;
  /** The category you agree on most. */
  closest: CategoryKey | null;
  /** The category you disagree on most, if the gap is big enough to call it a fight. */
  furthest: { key: CategoryKey; gap: number } | null;
}

/** Compare two people's reviews, building by building and category by category. */
export function tasteMatch(
  mine: readonly ReviewRecord[],
  theirs: readonly ReviewRecord[],
): TasteMatch {
  const theirsBySlug = new Map(theirs.map((r) => [r.stationSlug, r]));
  const gaps = new Map<CategoryKey, number[]>();
  let shared = 0;
  for (const a of mine) {
    const b = theirsBySlug.get(a.stationSlug);
    if (!b) continue;
    shared++;
    for (const k of CATEGORY_KEYS) {
      const x = a.scores[k];
      const y = b.scores[k];
      if (x === undefined || y === undefined) continue;
      gaps.set(k, [...(gaps.get(k) ?? []), Math.abs(x - y)]);
    }
  }
  const all = [...gaps.values()].flat();
  if (!all.length) return { shared, agreement: null, closest: null, furthest: null };

  const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  // Category order breaks ties, so the result doesn't depend on the order reviews arrive in.
  const byCategory = CATEGORY_KEYS.filter((k) => gaps.has(k)).map((k) => ({
    key: k,
    gap: avg(gaps.get(k)!),
  }));
  const closest = byCategory.reduce((best, c) => (c.gap < best.gap ? c : best));
  const furthest = byCategory.reduce((worst, c) => (c.gap > worst.gap ? c : worst));
  return {
    shared,
    agreement: Math.round(100 * (1 - avg(all) / MAX_GAP)),
    closest: closest.key,
    furthest:
      furthest.gap >= WAR_GAP
        ? { key: furthest.key, gap: Math.round(furthest.gap * 10) / 10 }
        : null,
  };
}

export interface Divisive {
  stationSlug: string;
  /** Highest minus lowest personal overall. */
  spread: number;
  high: { memberId: string; score: number };
  low: { memberId: string; score: number };
}

/**
 * The buildings that split the crew most: the widest gap between two people's overall scores,
 * among buildings with at least two reviews and a gap of at least `minSpread`.
 */
export function mostDivisive(
  reviews: readonly ReviewRecord[],
  { minSpread = 1, limit = 3 }: { minSpread?: number; limit?: number } = {},
): Divisive[] {
  const byStation = new Map<string, { memberId: string; score: number }[]>();
  for (const r of reviews) {
    const score = personOverall(r.scores);
    if (score === null) continue;
    byStation.set(r.stationSlug, [
      ...(byStation.get(r.stationSlug) ?? []),
      { memberId: r.memberId, score },
    ]);
  }
  const out: Divisive[] = [];
  for (const [stationSlug, people] of byStation) {
    if (people.length < 2) continue;
    // Ties go to the earlier review, so the result is stable.
    const high = people.reduce((a, b) => (b.score > a.score ? b : a));
    const low = people.reduce((a, b) => (b.score < a.score ? b : a));
    const spread = Math.round((high.score - low.score) * 10) / 10;
    if (spread >= minSpread) out.push({ stationSlug, spread, high, low });
  }
  return out
    .sort((a, b) => b.spread - a.spread || a.stationSlug.localeCompare(b.stationSlug))
    .slice(0, limit);
}
