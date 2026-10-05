/**
 * Who this phone is signed in as (the readable `ww_member` cookie the server sets with the
 * session). Drafts and queued writes are kept per member, so on a shared phone nobody sees,
 * or posts, someone else's.
 */
export function currentMember(): string | null {
  if (typeof document === "undefined") return null;
  const match = /(?:^|;\s*)ww_member=([^;]*)/.exec(document.cookie);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/** The header that tells the server who made a queued write (see server/http.ts). */
export const MEMBER_HEADER = "x-wewalk-member";
