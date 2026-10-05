import { CATEGORY_KEYS, type CategoryKey, type Score } from "./categories";

/** One person's taps for one building. Missing categories were skipped. */
export type Scores = Partial<Record<CategoryKey, Score>>;

export interface StationScore {
  /** Average of each reviewer's own overall, so every reviewer counts once. */
  overall: number | null;
  /** Average of the reviewers who rated that category. */
  categories: Record<CategoryKey, number | null>;
  reviewCount: number;
}

export type Tier = "great" | "good" | "ok" | "bad";

const mean = (xs: readonly number[]): number | null =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

/** Scores are shown with one decimal; tiers and ties use the same rounding so they agree. */
export function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}

/** A reviewer's overall: the average of the categories they rated. */
export function personOverall(scores: Scores): number | null {
  return mean(CATEGORY_KEYS.flatMap((k) => (scores[k] === undefined ? [] : [scores[k]])));
}

export function scoreStation(reviews: readonly { scores: Scores }[]): StationScore {
  const categories = Object.fromEntries(
    CATEGORY_KEYS.map((k) => [
      k,
      mean(reviews.flatMap((r) => (r.scores[k] === undefined ? [] : [r.scores[k]]))),
    ]),
  ) as Record<CategoryKey, number | null>;

  const overalls = reviews.map((r) => personOverall(r.scores)).filter((v) => v !== null);
  return { overall: mean(overalls), categories, reviewCount: reviews.length };
}

/** Score color tier, on the displayed (rounded) value: ≥4.3 great · ≥3.5 good · ≥2.8 ok. */
export function tierOf(value: number | null): Tier | null {
  if (value === null) return null;
  const v = roundScore(value);
  if (v >= 4.3) return "great";
  if (v >= 3.5) return "good";
  if (v >= 2.8) return "ok";
  return "bad";
}

export function formatScore(value: number | null): string {
  return value === null ? "–" : roundScore(value).toFixed(1);
}
