import { describe, expect, it } from "vitest";
import { formatScore, personOverall, roundScore, scoreStation, tierOf } from "./scoring";

describe("personOverall", () => {
  it("averages only the categories that were rated", () => {
    expect(personOverall({ coffee: 5, wifi: 3 })).toBe(4);
    expect(personOverall({})).toBeNull();
  });
});

describe("scoreStation", () => {
  it("counts every reviewer once, however many categories they rated", () => {
    // A rated nine things (avg 5), B rated one thing (2). Each person is one vote: (5 + 2) / 2.
    const a = {
      scores: {
        coffee: 5,
        wifi: 5,
        booths: 5,
        light: 5,
        noise: 5,
        seating: 5,
        bathrooms: 5,
        lunch: 5,
        vibe: 5,
      },
    } as const;
    const b = { scores: { coffee: 2 } } as const;
    const s = scoreStation([a, b]);
    expect(s.overall).toBe(3.5);
    // The prototype averaged category averages, which would give (3.5 + 5×8) / 9 ≈ 4.83.
    expect(s.categories.coffee).toBe(3.5);
    expect(s.categories.wifi).toBe(5);
    expect(s.reviewCount).toBe(2);
  });

  it("has no score without reviews", () => {
    const s = scoreStation([]);
    expect(s.overall).toBeNull();
    expect(s.categories.vibe).toBeNull();
    expect(s.reviewCount).toBe(0);
  });
});

describe("tiers and formatting agree on the rounded value", () => {
  it.each([
    [4.3, "great"],
    [4.25, "great"],
    [4.249, "good"],
    [3.5, "good"],
    [3.45, "good"],
    [2.8, "ok"],
    [2.74, "bad"],
    [1, "bad"],
  ] as const)("%d → %s", (v, tier) => expect(tierOf(v)).toBe(tier));

  it("formats with one decimal and a dash for nothing", () => {
    expect(formatScore(4)).toBe("4.0");
    expect(formatScore(4.25)).toBe("4.3");
    expect(formatScore(null)).toBe("–");
    expect(formatScore(13 / 3)).toBe("4.3");
    expect(tierOf(13 / 3)).toBe("great");
    expect(roundScore(3.449)).toBe(3.4);
  });

  it("isn't fooled by float noise from summing", () => {
    expect(roundScore(3.4499999999999993)).toBe(3.5); // a true 3.45
    expect(tierOf(3.4499999999999993)).toBe("good");
    expect(tierOf(2.7499999999999996)).toBe("ok"); // a true 2.75
    expect(formatScore(3.4499999999999993)).toBe("3.5");
  });
});
