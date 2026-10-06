import { describe, expect, it } from "vitest";
import { review } from "./fixtures.test-utils";
import { mostDivisive, tasteMatch } from "./taste";

describe("tasteMatch", () => {
  it("is 100 when you score alike and lower as scores drift apart", () => {
    const same = tasteMatch(
      [review({ stationSlug: "a", scores: { coffee: 4, wifi: 2 } })],
      [review({ stationSlug: "a", memberId: "m2", scores: { coffee: 4, wifi: 2 } })],
    );
    expect(same).toMatchObject({ shared: 1, agreement: 100, furthest: null });

    const apart = tasteMatch(
      [
        review({ stationSlug: "a", scores: { coffee: 5, booths: 5 } }),
        review({ stationSlug: "b", scores: { coffee: 4, booths: 1 } }),
      ],
      [
        review({ stationSlug: "a", memberId: "m2", scores: { coffee: 5, booths: 1 } }),
        review({ stationSlug: "b", memberId: "m2", scores: { coffee: 4, booths: 4 } }),
        review({ stationSlug: "c", memberId: "m2", scores: { coffee: 1 } }),
      ],
    );
    // Gaps: coffee 0, 0; booths 4, 3 → mean 7/4 = 1.75 → 100 × (1 − 1.75/4) = 56.25.
    expect(apart).toEqual({
      shared: 2,
      agreement: 56,
      closest: "coffee",
      furthest: { key: "booths", gap: 3.5 },
    });
  });

  it("has nothing to say without a building and category in common", () => {
    expect(
      tasteMatch(
        [review({ stationSlug: "a", scores: { coffee: 5 } })],
        [review({ stationSlug: "a", memberId: "m2", scores: { wifi: 5 } })],
      ),
    ).toEqual({ shared: 1, agreement: null, closest: null, furthest: null });
    expect(tasteMatch([], [])).toMatchObject({ shared: 0, agreement: null });
  });
});

describe("mostDivisive", () => {
  it("ranks buildings by the gap between the highest and lowest overall", () => {
    const list = mostDivisive([
      review({ stationSlug: "a", memberId: "m1", scores: { vibe: 5 } }),
      review({ stationSlug: "a", memberId: "m2", scores: { vibe: 1 } }),
      review({ stationSlug: "b", memberId: "m1", scores: { vibe: 4 } }),
      review({ stationSlug: "b", memberId: "m2", scores: { vibe: 2 } }),
      review({ stationSlug: "c", memberId: "m1", scores: { vibe: 3 } }),
      review({ stationSlug: "c", memberId: "m2", scores: { vibe: 3 } }),
      review({ stationSlug: "d", memberId: "m1", scores: { vibe: 5 } }),
    ]);
    expect(list.map((d) => [d.stationSlug, d.spread])).toEqual([
      ["a", 4],
      ["b", 2],
    ]);
    expect(list[0]).toMatchObject({
      high: { memberId: "m1", score: 5 },
      low: { memberId: "m2", score: 1 },
    });
  });
});
