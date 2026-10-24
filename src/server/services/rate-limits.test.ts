import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../db/client";
import { rateLimits } from "../db/schema";
import { createTestDb, resetTestDb } from "../db/testing";
import { AppError } from "../errors";
import { countRequest } from "../repos/rate-limits";
import { limit, LIMITS, limitsOff, spend } from "./rate-limits";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});
beforeEach(() => resetTestDb(db));
afterEach(() => vi.restoreAllMocks());

const MINUTE = 60 * 1000;
/** Lines up with a 10-minute window boundary, so the arithmetic below is easy to follow. */
const START = new Date("2026-10-05T15:00:00Z");
const at = (ms: number) => new Date(START.getTime() + ms);

/** The error a call throws, or "ok". */
const outcome = (p: Promise<void>) =>
  p.then(
    () => "ok",
    (e: unknown) => (e instanceof AppError ? e : `unexpected: ${String(e)}`),
  );

describe("limit", () => {
  it("allows `max` requests in a window, then 429s with the seconds left", async () => {
    for (let i = 0; i < 3; i++) await limit(db, "k", 3, 10 * MINUTE, at(i * 1000));
    const error = await outcome(limit(db, "k", 3, 10 * MINUTE, at(4 * MINUTE)));
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("rate_limited");
    expect((error as AppError).details).toEqual({ retryAfter: 6 * 60 });
  });

  it("starts counting again when the window rolls over", async () => {
    for (let i = 0; i < 3; i++) await limit(db, "k", 3, 10 * MINUTE, at(9 * MINUTE));
    expect(await outcome(limit(db, "k", 3, 10 * MINUTE, at(9 * MINUTE)))).toBeInstanceOf(AppError);
    expect(await outcome(limit(db, "k", 3, 10 * MINUTE, at(10 * MINUTE)))).toBe("ok");
  });

  it("counts each key separately", async () => {
    await limit(db, "a", 1, 10 * MINUTE, START);
    expect(await outcome(limit(db, "b", 1, 10 * MINUTE, START))).toBe("ok");
    expect(await outcome(limit(db, "a", 1, 10 * MINUTE, START))).toBeInstanceOf(AppError);
  });

  it("deletes windows older than two days now and then", async () => {
    await limit(db, "old", 5, 10 * MINUTE, at(-3 * 24 * 60 * MINUTE));
    await limit(db, "recent", 5, 10 * MINUTE, at(-MINUTE));
    vi.spyOn(Math, "random").mockReturnValue(0); // this call cleans up
    await limit(db, "now", 5, 10 * MINUTE, START);
    const keys = (await db.select({ key: rateLimits.key }).from(rateLimits)).map((r) => r.key);
    expect(keys.sort()).toEqual(["now", "recent"]);
  });
});

describe("countRequest", () => {
  it("never loses a count when requests arrive together", async () => {
    const counts = await Promise.all(
      Array.from({ length: 25 }, () => countRequest(db, "k", START)),
    );
    expect(counts.sort((a, b) => a - b)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  });
});

describe("spend", () => {
  it("applies the named limit and stores only a hash of the subject", async () => {
    const ip = "203.0.113.7";
    for (let i = 0; i < LIMITS.signup.max; i++) await spend(db, "signup", ip, START);
    const error = await outcome(spend(db, "signup", ip, START));
    expect((error as AppError).message).toBe(LIMITS.signup.message);
    expect(await outcome(spend(db, "login", ip, START))).toBe("ok");
    const keys = (await db.select({ key: rateLimits.key }).from(rateLimits)).map((r) => r.key);
    expect(keys).toHaveLength(2);
    expect(keys.join()).not.toContain(ip);
  });
});

describe("limitsOff", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is on only with RATE_LIMITS=off, and never on Vercel", () => {
    expect(limitsOff()).toBe(false);
    vi.stubEnv("RATE_LIMITS", "off");
    expect(limitsOff()).toBe(true);
    vi.stubEnv("VERCEL", "1");
    expect(limitsOff()).toBe(false);
  });
});
