import type { IsoDate } from "./dates";
import type { CheckinRecord } from "./records";

/** Someone in the crew checked in somewhere today. */
export interface HereToday {
  memberId: string;
  stationSlug: string;
  /** ISO timestamp of the check-in. */
  since: string;
}

/**
 * Who's where today: each person's latest check-in dated `today`, most recent first. Someone
 * who moved buildings during the day shows up at the one they went to last.
 */
export function hereToday(checkins: readonly CheckinRecord[], today: IsoDate): HereToday[] {
  const latest = new Map<string, CheckinRecord>();
  for (const c of checkins) {
    if (c.visitedOn !== today) continue;
    const seen = latest.get(c.memberId);
    if (!seen || c.checkedInAt > seen.checkedInAt) latest.set(c.memberId, c);
  }
  return [...latest.values()]
    .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt))
    .map((c) => ({ memberId: c.memberId, stationSlug: c.stationSlug, since: c.checkedInAt }));
}
