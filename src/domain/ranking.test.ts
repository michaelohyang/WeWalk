import { describe, expect, it } from "vitest";
import { rankStations } from "./ranking";
import { scoreStation } from "./scoring";

const stations = [
  { slug: "a", name: "Alpha" },
  { slug: "b", name: "Bravo" },
  { slug: "c", name: "Charlie" },
  { slug: "d", name: "Delta" },
];

describe("rankStations", () => {
  it("ranks best first, breaks ties by review count then name, skips unscored", () => {
    const scores = new Map([
      ["a", scoreStation([{ scores: { vibe: 4 } }])],
      ["b", scoreStation([{ scores: { vibe: 4 } }, { scores: { vibe: 4 } }])],
      ["c", scoreStation([{ scores: { vibe: 5 } }])],
      ["d", scoreStation([])],
    ]);
    expect(rankStations(stations, scores, "overall").map((r) => [r.stationSlug, r.rank])).toEqual([
      ["c", 1],
      ["b", 2],
      ["a", 3],
    ]);
  });

  it("ranks by a single category and leaves out stations nobody rated for it", () => {
    const scores = new Map([
      ["a", scoreStation([{ scores: { coffee: 2, vibe: 5 } }])],
      ["b", scoreStation([{ scores: { coffee: 5 } }])],
      ["c", scoreStation([{ scores: { vibe: 5 } }])],
    ]);
    expect(rankStations(stations, scores, "coffee").map((r) => r.stationSlug)).toEqual(["b", "a"]);
  });

  it("breaks a full tie alphabetically", () => {
    const one = scoreStation([{ scores: { vibe: 3 } }]);
    const scores = new Map([
      ["d", one],
      ["a", one],
    ]);
    expect(rankStations(stations, scores, "overall").map((r) => r.stationSlug)).toEqual(["a", "d"]);
  });
});

describe("ties use the displayed score, not float noise", () => {
  it("orders stations that show the same score by review count, then name", () => {
    // Both are truly 3.0833…, but summing in a different order gives different floats.
    const a = scoreStation([
      { scores: { coffee: 3, wifi: 3, booths: 3, light: 3, noise: 3, seating: 3 } },
      { scores: { coffee: 3, wifi: 4 } },
      { scores: { coffee: 2, wifi: 3, booths: 3, light: 3 } },
    ]);
    const b = scoreStation([
      { scores: { coffee: 2, wifi: 3, booths: 3, light: 3 } },
      { scores: { coffee: 3, wifi: 4 } },
      { scores: { coffee: 3, wifi: 3, booths: 3, light: 3, noise: 3, seating: 3 } },
    ]);
    const scores = new Map([
      ["b", b],
      ["a", a],
    ]);
    expect(rankStations(stations, scores, "overall").map((r) => r.stationSlug)).toEqual(["a", "b"]);
  });

  it("puts more reviews first among equal displayed scores, even if the hidden digits differ", () => {
    const scores = new Map([
      // 4.333… shows as 4.3, one review
      ["a", scoreStation([{ scores: { coffee: 4, wifi: 5, booths: 4 } }])],
      // (4 + 4.5) / 2 = 4.25 also shows as 4.3, two reviews
      ["b", scoreStation([{ scores: { vibe: 4 } }, { scores: { coffee: 4, wifi: 5 } }])],
    ]);
    expect(rankStations(stations, scores, "overall").map((r) => r.stationSlug)).toEqual(["b", "a"]);
  });
});

describe("category ties", () => {
  it("count the people who rated that category, not all reviews", () => {
    const scores = new Map([
      // Three reviews, but only one rated coffee (4)
      [
        "a",
        scoreStation([{ scores: { coffee: 4 } }, { scores: { vibe: 5 } }, { scores: { vibe: 5 } }]),
      ],
      // Two reviews, both rated coffee (4)
      ["b", scoreStation([{ scores: { coffee: 4 } }, { scores: { coffee: 4 } }])],
    ]);
    const ranked = rankStations(stations, scores, "coffee");
    expect(ranked.map((r) => r.stationSlug)).toEqual(["b", "a"]);
    expect(ranked.map((r) => r.reviewCount)).toEqual([2, 1]);
  });
});
