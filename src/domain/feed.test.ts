import { describe, expect, it } from "vitest";
import { crewFeed } from "./feed";
import { checkin, review } from "./fixtures.test-utils";

describe("crewFeed", () => {
  it("mixes reviews and check-ins, newest first, up to the limit", () => {
    const feed = crewFeed(
      [
        review({ stationSlug: "a", updatedAt: "2026-10-06T15:00:00.000Z" }),
        review({ stationSlug: "b", updatedAt: "2026-10-04T15:00:00.000Z" }),
      ],
      [
        checkin({ stationSlug: "c", checkedInAt: "2026-10-05T15:00:00.000Z" }),
        checkin({ stationSlug: "d", checkedInAt: "2026-10-07T15:00:00.000Z" }),
      ],
      3,
    );
    expect(
      feed.map((f) => [f.kind, f.kind === "review" ? f.review.stationSlug : f.checkin.stationSlug]),
    ).toEqual([
      ["checkin", "d"],
      ["review", "a"],
      ["checkin", "c"],
    ]);
  });
});
