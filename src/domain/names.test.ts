import { describe, expect, it } from "vitest";
import { displayNameProblem, nameKey, normalizeDisplayName } from "./names";

describe("display names", () => {
  it("normalizes whitespace so 'Dana ' and ' Dana' are the same person", () => {
    expect(normalizeDisplayName("  Dana   K ")).toBe("Dana K");
    expect(nameKey("Dana ")).toBe(nameKey("dana"));
  });

  it("treats composed and decomposed accents as one name", () => {
    expect(nameKey("José")).toBe(nameKey("José"));
  });

  it("rejects empty, too long and control characters", () => {
    expect(displayNameProblem("")).toMatch(/Pick a name/);
    expect(displayNameProblem("x".repeat(31))).toMatch(/30 characters/);
    expect(displayNameProblem("a\u0007b")).toMatch(/can't show/);
    expect(displayNameProblem("Sal from accounting")).toBeNull();
  });

  it("counts emoji as one character each", () => {
    expect(displayNameProblem("☕".repeat(30))).toBeNull();
  });
});
