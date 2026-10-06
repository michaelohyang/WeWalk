import { describe, expect, it } from "vitest";
import { stationOfMonth } from "./activity";
import { CATEGORY_KEYS, type Score } from "./categories";
import { rankStations } from "./ranking";
import type { CheckinRecord, ReviewRecord } from "./records";
import { roundScore, scoreStation, type Scores } from "./scoring";

/*
 * Parity with prototype/app.html (the approved design). The plan deliberately changed one rule:
 * a station's overall is now the average of each reviewer's overall, not of the category
 * averages. The two agree when every reviewer rates every category, so on such data the
 * rankings and Station of the Month must match the prototype exactly.
 */

// ---- prototype logic, ported verbatim (app.html: stats() l.425, stationOfMonth() l.443, ranks l.693)
type ProtoReview = { stationSlug: string; scores: Scores; visitedOn: string };
function protoStats(
  id: string,
  reviews: ProtoReview[],
  visits: { stationSlug: string; date: string }[],
) {
  const rs = reviews.filter((r) => r.stationSlug === id);
  const cat: Record<string, number | null> = {};
  for (const k of CATEGORY_KEYS) {
    const xs = rs.map((r) => r.scores[k]).filter((n): n is Score => typeof n === "number");
    cat[k] = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  }
  const have = Object.values(cat).filter((v): v is number => v != null);
  const overall = have.length ? have.reduce((a, b) => a + b, 0) / have.length : null;
  const dates = [
    ...rs.map((r) => r.visitedOn),
    ...visits.filter((v) => v.stationSlug === id).map((v) => v.date),
  ];
  return { reviews: rs, cat, overall, dates };
}
function protoRanks(ids: string[], reviews: ProtoReview[], key: string) {
  return ids
    .map((id) => {
      const x = protoStats(id, reviews, []);
      return { id, x, v: key === "overall" ? x.overall : x.cat[key]! };
    })
    .filter((r) => r.v != null)
    .sort((a, b) => b.v! - a.v! || b.x.reviews.length - a.x.reviews.length)
    .map((r) => r.id);
}
function protoStationOfMonth(
  ids: string[],
  reviews: ProtoReview[],
  visits: { stationSlug: string; date: string }[],
  ym: string,
) {
  const scored = ids
    .map((id) => ({ id, st: protoStats(id, reviews, visits) }))
    .filter((x) => x.st.overall != null);
  if (!scored.length) return null;
  const thisMonth = scored.filter((x) => x.st.dates.some((d) => d.startsWith(ym)));
  const pool = thisMonth.length ? thisMonth : scored;
  pool.sort((a, b) => b.st.overall! - a.st.overall! || b.st.reviews.length - a.st.reviews.length);
  return { stationSlug: pool[0]!.id, fresh: thisMonth.length > 0 };
}
// ---- end prototype logic

/** Small deterministic PRNG so failures reproduce. */
function rng(seed: number) {
  return () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
}

function world(seed: number) {
  const rand = rng(seed);
  const stations = Array.from({ length: 8 }, (_, i) => ({ slug: `s${i}`, name: `Station ${i}` }));
  const reviews: ReviewRecord[] = [];
  const checkins: CheckinRecord[] = [];
  for (const s of stations) {
    const n = Math.floor(rand() * 4); // 0–3 reviewers, each rating all nine categories
    for (let m = 0; m < n; m++) {
      const scores = Object.fromEntries(
        CATEGORY_KEYS.map((k) => [k, (1 + Math.floor(rand() * 5)) as Score]),
      );
      const month = rand() < 0.3 ? "2026-10" : "2026-09";
      reviews.push({
        id: `${s.slug}-${m}`,
        stationSlug: s.slug,
        memberId: `m${m}`,
        visitedOn: `${month}-0${1 + m}`,
        scores,
        hotTake: "",
        body: "",
        tags: [],
        updatedAt: "2026-10-01T00:00:00Z",
      });
    }
    if (rand() < 0.2)
      checkins.push({
        id: `c-${s.slug}`,
        stationSlug: s.slug,
        memberId: "m9",
        visitedOn: "2026-10-02",
        note: "",
      });
  }
  return { stations, reviews, checkins };
}

/**
 * Parity only holds where every station shows a different score: we rank stations showing the
 * same score by review count, then name, while the prototype compared the hidden digits.
 */
function hasDisplayedTies(ids: string[], values: (id: string) => number | null) {
  const shown = ids.flatMap((id) => (values(id) == null ? [] : [roundScore(values(id)!)]));
  return new Set(shown).size !== shown.length;
}

describe("parity with the prototype (every reviewer rates every category)", () => {
  const seeds = Array.from({ length: 400 }, (_, i) => i + 1);

  it.each(["overall", "coffee", "vibe"] as const)("rankings by %s match", (key) => {
    let compared = 0;
    for (const seed of seeds) {
      const { stations, reviews } = world(seed);
      const ids = stations.map((s) => s.slug);
      const scores = new Map(
        ids.map((id) => [id, scoreStation(reviews.filter((r) => r.stationSlug === id))]),
      );
      const value = (id: string) =>
        key === "overall" ? scores.get(id)!.overall : scores.get(id)!.categories[key];
      if (hasDisplayedTies(ids, value)) continue;
      const ours = rankStations(stations, scores, key).map((r) => r.stationSlug);
      expect(ours, `seed ${seed}`).toEqual(protoRanks(ids, reviews, key));
      compared++;
    }
    expect(compared).toBeGreaterThan(50);
  });

  it("Station of the Month matches", () => {
    let n = 0;
    for (const seed of seeds) {
      const { stations, reviews, checkins } = world(seed);
      const ids = stations.map((s) => s.slug);
      const scores = new Map(
        ids.map((id) => [id, scoreStation(reviews.filter((r) => r.stationSlug === id))]),
      );
      if (hasDisplayedTies(ids, (id) => scores.get(id)!.overall)) continue;
      const visits = checkins.map((c) => ({ stationSlug: c.stationSlug, date: c.visitedOn }));
      expect(stationOfMonth(stations, reviews, checkins, "2026-10"), `seed ${seed}`).toEqual(
        protoStationOfMonth(ids, reviews, visits, "2026-10"),
      );
      n++;
    }
    expect(n).toBeGreaterThan(50);
  });
});
