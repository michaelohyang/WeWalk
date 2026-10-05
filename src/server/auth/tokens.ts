import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** 256-bit random token, URL-safe. Only its hash is stored. */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time string comparison (via hashes, so lengths don't leak either). */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
}
