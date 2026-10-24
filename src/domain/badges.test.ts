import { describe, expect, it } from "vitest";
import { badgesFor, weekOf, weekStreak } from "./badges";
import { checkin, review } from "./fixtures.test-utils";

const stations = [
  { slug: "a", area: "brooklyn" },
  { slug: "b", area: "brooklyn" },
  { slug: "c", area: "uptown" },
];
const byKey = (bs: ReturnType<typeof badgesFor>) => new Map(bs.map((b) => [b.key, b]));

describe("weekOf", () => {
  it("is the Monday of the week", () => {
    expect(weekOf("2026-10-05")).toBe("2026-10-05"); // a Monday
    expect(weekOf("2026-10-11")).toBe("2026-10-05"); // Sunday
    expect(weekOf("2026-10-12")).toBe("2026-10-12");
  });
});

describe("badgesFor", () => {
  it("tracks buildings, areas and progress toward the next badge", () => {
    const visits = [
      checkin({ stationSlug: "a" }),
      checkin({ stationSlug: "b", visitedOn: "2026-10-02" }),
      checkin({ stationSlug: "a", memberId: "m2" }),
    ];
    const b = byKey(badgesFor("m1", stations, visits, []));
    expect(b.get("first")).toMatchObject({ earned: true });
    expect(b.get("regular")).toMatchObject({ earned: false, progress: { have: 2, need: 5 } });
    expect(b.get("completionist")).toMatchObject({ earned: false, progress: { have: 2, need: 3 } });
    expect(b.get("area-brooklyn")).toMatchObject({ earned: true, emoji: "🌉" });
    expect(b.get("area-uptown")).toMatchObject({ earned: false, progress: { have: 0, need: 1 } });
    // Areas with no buildings get no badge.
    expect(b.has("area-midtown")).toBe(false);
  });

  it("counts Completionist per city, so adding a city takes nobody's badge away", () => {
    const cities = [...stations, { slug: "x", area: "back-bay" }, { slug: "y", area: "seaport" }];
    const everyNyc = ["a", "b", "c"].map((slug) => checkin({ stationSlug: slug }));
    const done = byKey(badgesFor("m1", cities, everyNyc, [])).get("completionist")!;
    expect(done).toMatchObject({ earned: true, progress: { have: 3, need: 3 } });
    expect(done.detail).toBe("Visit every building in a city (all 3 in New York)");

    // Partway in two cities: progress shows the city you're furthest along in.
    const some = [checkin({ stationSlug: "a" }), checkin({ stationSlug: "x" })];
    const partway = byKey(badgesFor("m1", cities, some, [])).get("completionist")!;
    expect(partway).toMatchObject({ earned: false, progress: { have: 1, need: 2 } });
    expect(partway.detail).toBe("Visit every building in a city (1 of 2 in Boston)");
    expect(byKey(badgesFor("m1", cities, some, [])).get("area-back-bay")).toMatchObject({
      earned: true,
    });
  });

  it("gives Trailblazer to whoever reviewed a building first", () => {
    const reviews = [
      review({ stationSlug: "a", memberId: "m2", visitedOn: "2026-10-03" }),
      review({ stationSlug: "a", memberId: "m1", visitedOn: "2026-10-01" }),
    ];
    expect(byKey(badgesFor("m1", stations, reviews, reviews)).get("trailblazer")!.earned).toBe(
      true,
    );
    expect(byKey(badgesFor("m2", stations, reviews, reviews)).get("trailblazer")!.earned).toBe(
      false,
    );
  });

  it("counts a busy week as five visits Monday to Sunday", () => {
    const days = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"];
    const four = days.map((visitedOn) => checkin({ stationSlug: "a", visitedOn }));
    expect(byKey(badgesFor("m1", stations, four, [])).get("busy-week")!.earned).toBe(false);
    const five = [...four, checkin({ stationSlug: "b", visitedOn: "2026-10-11" })];
    expect(byKey(badgesFor("m1", stations, five, [])).get("busy-week")!.earned).toBe(true);
    // The next Monday is a new week.
    const split = [...four, checkin({ stationSlug: "b", visitedOn: "2026-10-12" })];
    expect(byKey(badgesFor("m1", stations, split, [])).get("busy-week")!.earned).toBe(false);
  });
});

describe("weekStreak", () => {
  const on = (...dates: string[]) =>
    dates.map((visitedOn) => checkin({ stationSlug: "a", visitedOn }));

  it("counts weeks in a row back from this week", () => {
    expect(weekStreak("m1", on("2026-10-06", "2026-09-30", "2026-09-22"), "2026-10-07")).toEqual({
      weeks: 3,
      thisWeek: true,
    });
  });

  it("stays alive until a whole week passes without a visit", () => {
    // Nothing yet this week (Oct 5–11), but last week counts.
    expect(weekStreak("m1", on("2026-09-30", "2026-09-22"), "2026-10-07")).toEqual({
      weeks: 2,
      thisWeek: false,
    });
    // Last visit two weeks ago: the streak is over.
    expect(weekStreak("m1", on("2026-09-22"), "2026-10-07")).toEqual({ weeks: 0, thisWeek: false });
  });

  it("only counts your own visits", () => {
    expect(
      weekStreak(
        "m1",
        [checkin({ stationSlug: "a", memberId: "m2", visitedOn: "2026-10-06" })],
        "2026-10-07",
      ),
    ).toEqual({ weeks: 0, thisWeek: false });
  });
});
