import { describe, expect, it } from "vitest";
import { AREAS, areaIn, areasIn, CITIES, cityOf, isCity } from "./areas";

describe("cities and areas", () => {
  it("gives every area exactly one known city, with keys unique across cities", () => {
    const keys = AREAS.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const a of AREAS) expect(CITIES.map((c) => c.key)).toContain(cityOf(a.key));
  });

  it("lists a city's areas in order", () => {
    expect(areasIn("nyc").map((a) => a.key)).toEqual([
      "uptown",
      "midtown",
      "flatiron",
      "downtown",
      "brooklyn",
    ]);
    expect(areasIn("boston").map((a) => a.label)).toContain("Back Bay");
    expect(areasIn("atlanta").map((a) => a.label)).toContain("Buckhead");
  });

  it("only accepts an area from the URL if it's in the selected city", () => {
    expect(areaIn("nyc", "midtown")).toBe("midtown");
    expect(areaIn("boston", "midtown")).toBeNull();
    expect(areaIn("boston", "back-bay")).toBe("back-bay");
    expect(areaIn("nyc", "nowhere")).toBeNull();
  });

  it("knows its cities", () => {
    expect(isCity("boston")).toBe(true);
    expect(isCity("atlanta")).toBe(true);
    expect(isCity("paris")).toBe(false);
    expect(isCity(undefined)).toBe(false);
  });
});
