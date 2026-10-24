import "server-only";
import { createHash } from "node:crypto";
import type { Db } from "../db/client";
import { AppError } from "../errors";
import * as repo from "../repos/rate-limits";

/*
 * Abuse limits: how many requests one IP address or member may make in a fixed window. The
 * counters live in Postgres (rate_limits) because serverless functions share no memory. Every
 * request counts, successful or not, so guessing and flooding cost the same.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const TRY_LATER = "Too many tries. Wait a few minutes and try again.";

/** Every limit, in one place. `per` says what the subject passed to `spend` is. */
export const LIMITS = {
  /** On top of the per-account lockout after five wrong passwords (services/auth.ts). */
  login: { per: "ip", max: 20, windowMs: 15 * MINUTE, message: TRY_LATER },
  signup: { per: "ip", max: 5, windowMs: HOUR, message: TRY_LATER },
  /** Redeeming a recovery link, and the owner making one. */
  recovery: { per: "ip", max: 10, windowMs: 15 * MINUTE, message: TRY_LATER },
  photoBurst: {
    per: "member",
    max: 10,
    windowMs: 10 * MINUTE,
    message: "That's a lot of photos at once. Wait a few minutes and try again.",
  },
  /** The daily photo quota. Days are UTC days (fixed windows). */
  photoQuota: {
    per: "member",
    max: 30,
    windowMs: DAY,
    message: "That's all the photos for today. Try again tomorrow.",
  },
  /** Reviews and check-ins, new or edited. */
  posts: {
    per: "member",
    max: 30,
    windowMs: HOUR,
    message: "You're posting a lot. Wait a few minutes and try again.",
  },
  reactions: {
    per: "member",
    max: 120,
    windowMs: HOUR,
    message: "That's a lot of reactions. Wait a few minutes and try again.",
  },
  /** Joining crews by invite code (keeps codes from being guessed). */
  join: { per: "member", max: 20, windowMs: HOUR, message: TRY_LATER },
} as const;
type LimitName = keyof typeof LIMITS;

/** Windows older than this are deleted. Longer than the longest window, so none is cut short. */
const KEEP_MS = 2 * DAY;
/** The share of requests that also delete old windows: often enough to keep the table small. */
const CLEANUP_CHANCE = 0.02;

/**
 * Counts one request against `key` and throws `rate_limited` (429) once there have been more
 * than `max` in the current fixed window of `windowMs`. `details.retryAfter` is the seconds
 * until that window ends (sent as Retry-After).
 */
export async function limit(
  db: Db,
  key: string,
  max: number,
  windowMs: number,
  now: Date,
  message = TRY_LATER,
): Promise<void> {
  const windowStart = Math.floor(now.getTime() / windowMs) * windowMs;
  if (Math.random() < CLEANUP_CHANCE) {
    await repo.deleteWindowsBefore(db, new Date(now.getTime() - KEEP_MS));
  }
  const count = await repo.countRequest(db, key, new Date(windowStart));
  if (count > max) {
    const retryAfter = Math.max(1, Math.ceil((windowStart + windowMs - now.getTime()) / 1000));
    throw new AppError("rate_limited", message, { retryAfter });
  }
}

/**
 * RATE_LIMITS=off turns the limits off for the browser tests, which sign up dozens of people from
 * one local address (playwright.config.ts). Ignored on Vercel, so production always has them.
 */
export const limitsOff = () => process.env.RATE_LIMITS === "off" && process.env.VERCEL !== "1";

/**
 * Counts one request against a named limit. `subject` is the client IP or member id; only its
 * hash is stored, so IP addresses aren't readable at a glance. The hash is unsalted, so it
 * slows down recovery of an address but doesn't prevent it; rows are deleted after two days.
 */
export async function spend(db: Db, name: LimitName, subject: string, now: Date): Promise<void> {
  if (limitsOff()) return;
  const { max, windowMs, message } = LIMITS[name];
  const hashed = createHash("sha256").update(subject).digest("base64url").slice(0, 22);
  return limit(db, `${name}:${hashed}`, max, windowMs, now, message);
}
