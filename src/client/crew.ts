/**
 * Which crew this phone is looking at (the readable `ww_crew` cookie; the server sets and
 * validates it). Queued writes remember it, so a post made in one crew lands there even if the
 * phone switches crews before it's sent.
 */
export const CREW_COOKIE = "ww_crew";

/** The header that tells the server which crew a queued write was made in (server/http.ts). */
export const CREW_HEADER = "x-wewalk-crew";

export function currentCrew(): string | null {
  if (typeof document === "undefined") return null;
  const match = /(?:^|;\s*)ww_crew=([^;]*)/.exec(document.cookie);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}
