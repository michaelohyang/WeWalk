import { describe, expect, it } from "vitest";
import { isIsoDate, isPlausibleVisitDate, monthOf } from "./dates";

describe("dates", () => {
  it("accepts only real calendar dates", () => {
    expect(isIsoDate("2026-10-05")).toBe(true);
    expect(isIsoDate("2024-02-29")).toBe(true);
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-1-5")).toBe(false);
    expect(isIsoDate(20261005)).toBe(false);
  });

  it("allows today and tomorrow (time zones), not later or before 2020", () => {
    const now = new Date("2026-10-05T23:30:00Z");
    expect(isPlausibleVisitDate("2026-10-05", now)).toBe(true);
    expect(isPlausibleVisitDate("2026-10-06", now)).toBe(true);
    expect(isPlausibleVisitDate("2026-10-07", now)).toBe(false);
    expect(isPlausibleVisitDate("2019-12-31", now)).toBe(false);
  });

  it("takes the month of a date", () => expect(monthOf("2026-10-05")).toBe("2026-10"));
});
