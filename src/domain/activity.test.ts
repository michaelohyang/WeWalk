import { describe, expect, it } from "vitest";
import { passportFor, stationOfMonth, summarizeStation } from "./activity";
import { checkin, review } from "./fixtures.test-utils";

const stations = [
  { id: "a", name: "Alpha" },
  { id: "b", name: "Bravo" },
  { id: "c", name: "Charlie" },
];

describe("summarizeStation", () => {
  it("collects score, last visit, latest hot take and tag counts", () => {
    const reviews = [
      review({
        stationId: "a",
        visitedOn: "2026-09-01",
        hotTake: "old take",
        tags: ["great rooftop"],
      }),
      review({
        stationId: "a",
        memberId: "m2",
        visitedOn: "2026-09-20",
        hotTake: "new take",
        tags: ["great rooftop", "quiet floor"],
      }),
      review({ stationId: "b", visitedOn: "2026-10-01", hotTake: "elsewhere" }),
    ];
    const checkins = [checkin({ stationId: "a", visitedOn: "2026-10-02" })];
    const s = summarizeStation("a", reviews, checkins);
    expect(s.visited).toBe(true);
    expect(s.lastVisit).toBe("2026-10-02");
    expect(s.hotTake).toEqual({ text: "new take", memberId: "m2" });
    expect(s.tags).toEqual([
      { tag: "great rooftop", count: 2 },
      { tag: "quiet floor", count: 1 },
    ]);
    expect(s.score.reviewCount).toBe(2);
  });

  it("counts a check-in alone as visited, with no score", () => {
    const s = summarizeStation("c", [], [checkin({ stationId: "c" })]);
    expect(s.visited).toBe(true);
    expect(s.score.overall).toBeNull();
    expect(s.hotTake).toBeNull();
  });

  it("ignores blank hot takes", () => {
    const s = summarizeStation("a", [review({ stationId: "a", hotTake: "   " })], []);
    expect(s.hotTake).toBeNull();
  });
});

describe("stationOfMonth", () => {
  const reviews = [
    review({ stationId: "a", visitedOn: "2026-09-10", scores: { vibe: 5 } }),
    review({ stationId: "b", visitedOn: "2026-09-12", scores: { vibe: 3 } }),
  ];

  it("picks the best station visited this month", () => {
    const checkins = [checkin({ stationId: "b", visitedOn: "2026-10-03" })];
    expect(stationOfMonth(stations, reviews, checkins, "2026-10")).toEqual({
      stationId: "b",
      fresh: true,
    });
  });

  it("falls back to the all-time best when nobody went anywhere", () => {
    expect(stationOfMonth(stations, reviews, [], "2026-10")).toEqual({
      stationId: "a",
      fresh: false,
    });
  });

  it("ignores this month's visits to unscored stations", () => {
    const checkins = [checkin({ stationId: "c", visitedOn: "2026-10-03" })];
    expect(stationOfMonth(stations, reviews, checkins, "2026-10")).toEqual({
      stationId: "a",
      fresh: false,
    });
  });

  it("is empty with no scores at all", () => {
    expect(stationOfMonth(stations, [], [], "2026-10")).toBeNull();
  });
});

describe("passportFor", () => {
  it("stamps each station once at the member's first visit, and counts crew coverage", () => {
    const visits = [
      review({ stationId: "a", visitedOn: "2026-09-10" }),
      checkin({ stationId: "a", visitedOn: "2026-08-01" }),
      checkin({ stationId: "b", memberId: "m2", visitedOn: "2026-07-01" }),
      checkin({ stationId: "gone", visitedOn: "2026-01-01" }),
    ];
    const p = passportFor("m1", stations, visits);
    expect(p.stamps).toEqual([{ stationId: "a", firstVisit: "2026-08-01" }]);
    expect(p.crewVisited).toBe(2);
    expect(p.total).toBe(3);
  });
});
