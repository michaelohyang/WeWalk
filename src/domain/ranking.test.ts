import { describe, expect, it } from "vitest";
import { rankStations } from "./ranking";
import { scoreStation } from "./scoring";

const stations = [
  { id: "a", name: "Alpha" },
  { id: "b", name: "Bravo" },
  { id: "c", name: "Charlie" },
  { id: "d", name: "Delta" },
];

describe("rankStations", () => {
  it("ranks best first, breaks ties by review count then name, skips unscored", () => {
    const scores = new Map([
      ["a", scoreStation([{ scores: { vibe: 4 } }])],
      ["b", scoreStation([{ scores: { vibe: 4 } }, { scores: { vibe: 4 } }])],
      ["c", scoreStation([{ scores: { vibe: 5 } }])],
      ["d", scoreStation([])],
    ]);
    expect(rankStations(stations, scores, "overall").map((r) => [r.stationId, r.rank])).toEqual([
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
    expect(rankStations(stations, scores, "coffee").map((r) => r.stationId)).toEqual(["b", "a"]);
  });

  it("breaks a full tie alphabetically", () => {
    const one = scoreStation([{ scores: { vibe: 3 } }]);
    const scores = new Map([
      ["d", one],
      ["a", one],
    ]);
    expect(rankStations(stations, scores, "overall").map((r) => r.stationId)).toEqual(["a", "d"]);
  });
});
