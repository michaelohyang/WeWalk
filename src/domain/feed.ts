import type { CheckinRecord, ReviewRecord } from "./records";

/** One thing someone in the crew did, for the home feed. */
export type FeedItem =
  | { kind: "review"; at: string; review: ReviewRecord }
  | { kind: "checkin"; at: string; checkin: CheckinRecord };

/**
 * The crew's latest activity, newest first: reviews (by when they were last written, so an
 * edit brings one back up) and check-ins (by when they were made).
 */
export function crewFeed(
  reviews: readonly ReviewRecord[],
  checkins: readonly CheckinRecord[],
  limit = 20,
): FeedItem[] {
  return [
    ...reviews.map((review) => ({ kind: "review" as const, at: review.updatedAt, review })),
    ...checkins.map((checkin) => ({ kind: "checkin" as const, at: checkin.checkedInAt, checkin })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}
