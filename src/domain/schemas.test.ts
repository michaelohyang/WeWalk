import { describe, expect, it } from "vitest";
import { checkinInputSchema, joinInputSchema, reviewInputSchema } from "./schemas";

const base = { stationId: "18-w-18th-st", visitedOn: "2026-10-01", scores: { coffee: 4 } };

describe("reviewInputSchema", () => {
  it("fills defaults and de-duplicates tags", () => {
    const r = reviewInputSchema.parse({ ...base, tags: ["quiet floor", "quiet floor"] });
    expect(r).toEqual({ ...base, hotTake: "", body: "", tags: ["quiet floor"] });
  });

  it.each([
    ["no scores", { ...base, scores: {} }],
    ["score out of range", { ...base, scores: { coffee: 6 } }],
    ["fractional score", { ...base, scores: { coffee: 3.5 } }],
    ["unknown category", { ...base, scores: { beer: 5 } }],
    ["unknown tag", { ...base, tags: ["free beer"] }],
    ["bad date", { ...base, visitedOn: "2026-02-30" }],
    ["bad station id", { ...base, stationId: "../etc" }],
    ["hot take too long", { ...base, hotTake: "x".repeat(121) }],
    ["unknown field", { ...base, memberId: "someone-else" }],
  ])("rejects %s", (_, input) => expect(reviewInputSchema.safeParse(input).success).toBe(false));

  it("trims text", () => {
    expect(reviewInputSchema.parse({ ...base, hotTake: "  spicy  " }).hotTake).toBe("spicy");
  });
});

describe("checkinInputSchema", () => {
  it("defaults the note", () => {
    expect(checkinInputSchema.parse({ stationId: "a", visitedOn: "2026-10-01" }).note).toBe("");
  });
});

describe("joinInputSchema", () => {
  it("normalizes the name", () => {
    expect(joinInputSchema.parse({ code: "c", name: "  Dana  K " }).name).toBe("Dana K");
  });
  it("rejects a blank name", () => {
    expect(joinInputSchema.safeParse({ code: "c", name: "   " }).success).toBe(false);
  });
});
