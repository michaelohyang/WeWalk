import { describe, expect, it } from "vitest";
import { localToday, newId } from "./ids";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("newId", () => {
  it("makes v4 UUIDs", () => expect(newId()).toMatch(UUID_V4));

  it("still works without crypto.randomUUID (plain-http LAN address)", () => {
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      const ids = new Set(Array.from({ length: 50 }, newId));
      expect(ids.size).toBe(50);
      for (const id of ids) expect(id).toMatch(UUID_V4);
    } finally {
      Object.defineProperty(crypto, "randomUUID", { value: original, configurable: true });
    }
  });
});

describe("localToday", () => {
  it("uses the phone's calendar day, not UTC", () => {
    expect(localToday(new Date(2026, 9, 5, 23, 30))).toBe("2026-10-05");
    expect(localToday(new Date(2026, 0, 1, 0, 5))).toBe("2026-01-01");
  });
});
