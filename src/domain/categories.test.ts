import { describe, expect, it } from "vitest";
import { CATEGORIES, CATEGORY_KEYS, isScore, quipFor } from "./categories";

describe("categories", () => {
  it("has the nine categories in display order", () => {
    expect(CATEGORY_KEYS).toEqual([
      "coffee",
      "wifi",
      "booths",
      "light",
      "noise",
      "seating",
      "bathrooms",
      "lunch",
      "vibe",
    ]);
  });

  it("has unique keys and a quip for every score", () => {
    expect(new Set(CATEGORY_KEYS).size).toBe(CATEGORIES.length);
    for (const c of CATEGORIES) expect(c.quips).toHaveLength(5);
  });

  it("maps a score to its quip", () => {
    expect(quipFor("coffee", 1)).toBe("Brown water. Tragic.");
    expect(quipFor("vibe", 5)).toBe("My new home base");
  });
});

describe("isScore", () => {
  it.each([1, 2, 3, 4, 5])("accepts %d", (n) => expect(isScore(n)).toBe(true));
  it.each([0, 6, 2.5, -1, "3", null, undefined, Number.NaN])("rejects %s", (v) =>
    expect(isScore(v)).toBe(false),
  );
});
