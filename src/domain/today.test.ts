import { describe, expect, it } from "vitest";
import { cityDate } from "./dates";
import { checkin } from "./fixtures.test-utils";
import { hereToday } from "./today";

describe("cityDate", () => {
  it("is New York's date, not UTC's", () => {
    // 11pm in New York on Oct 5 is already Oct 6 in UTC.
    expect(cityDate(new Date("2026-10-06T03:00:00Z"))).toBe("2026-10-05");
    expect(cityDate(new Date("2026-10-06T15:00:00Z"))).toBe("2026-10-06");
  });
});

describe("hereToday", () => {
  const today = "2026-10-06";

  it("lists today's check-ins, latest first, ignoring other days", () => {
    const list = hereToday(
      [
        checkin({
          memberId: "a",
          stationSlug: "dock-72",
          visitedOn: today,
          checkedInAt: "2026-10-06T13:40:00Z",
        }),
        checkin({
          memberId: "b",
          stationSlug: "33-irving",
          visitedOn: today,
          checkedInAt: "2026-10-06T14:05:00Z",
        }),
        checkin({ memberId: "c", stationSlug: "dock-72", visitedOn: "2026-10-05" }),
      ],
      today,
    );
    expect(list).toEqual([
      { memberId: "b", stationSlug: "33-irving", since: "2026-10-06T14:05:00Z" },
      { memberId: "a", stationSlug: "dock-72", since: "2026-10-06T13:40:00Z" },
    ]);
  });

  it("shows someone who moved at the building they went to last", () => {
    const list = hereToday(
      [
        checkin({
          memberId: "a",
          stationSlug: "dock-72",
          visitedOn: today,
          checkedInAt: "2026-10-06T13:00:00Z",
        }),
        checkin({
          memberId: "a",
          stationSlug: "33-irving",
          visitedOn: today,
          checkedInAt: "2026-10-06T17:00:00Z",
        }),
      ],
      today,
    );
    expect(list.map((h) => h.stationSlug)).toEqual(["33-irving"]);
  });
});
