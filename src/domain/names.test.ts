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

describe("lookalike names share a key", () => {
  it.each([
    ["full-width", "Ｄａｎａ"],
    ["zero-width space", "Da\u200bna"],
    ["zero-width joiner", "Dana\u200d"],
    ["soft hyphen", "Da\u00adna"],
    ["byte-order mark", "\ufeffDana"],
  ])("%s", (_, name) => expect(nameKey(name)).toBe(nameKey("Dana")));

  it("keeps emoji sequences intact in the displayed name", () => {
    expect(normalizeDisplayName("Dana 👩\u200d💻")).toBe("Dana 👩\u200d💻");
  });

  it("rejects bidi overrides and names that are only invisible characters", () => {
    expect(displayNameProblem("\u202eanaD")).toMatch(/can't show/);
    expect(displayNameProblem("\u200b\u200b")).toMatch(/some letters/);
  });
});
