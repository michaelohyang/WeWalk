import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * The crew's invite code, from SIGNUP_CODE. Unset means anyone with the site's address can
 * sign up. Members share it inside the invite link (/signup?code=…), so nobody types it.
 */
export const signupCode = (): string | null => process.env.SIGNUP_CODE?.trim() || null;

/** Constant-time comparison; hashing first makes the lengths equal. */
export function codeMatches(given: string | undefined, expected: string): boolean {
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(given?.trim() ?? ""), digest(expected));
}
