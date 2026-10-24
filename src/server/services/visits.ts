import "server-only";
import { isPlausibleVisitDate } from "@/domain/dates";
import type { CheckinRecord, ReviewRecord } from "@/domain/records";
import type { CheckinInput, ReviewInput } from "@/domain/schemas";
import type { Db } from "../db/client";
import { AppError, isUniqueViolation } from "../errors";
import * as checkinRepo from "../repos/checkins";
import * as reviewRepo from "../repos/reviews";
import { findStation } from "../repos/stations";
import { isOurPhoto } from "../photos";
import { photoOwner } from "../repos/photos";
import { releasePhoto } from "./photos";
import type { Session } from "./auth";

/*
 * Writes are PUTs keyed by a client-generated id, so the offline outbox can retry any request
 * safely: the same id always lands on the same row.
 */

async function assertVisitable(db: Db, stationSlug: string, visitedOn: string, now: Date) {
  const station = await findStation(db, stationSlug);
  if (!station || station.hidden)
    throw new AppError("not_found", "That building isn't on the map.");
  if (!isPlausibleVisitDate(visitedOn, now)) {
    throw new AppError("invalid", BAD_DATE, { fields: { visitedOn: [BAD_DATE] } });
  }
}

const BAD_DATE = "That visit date doesn't look right.";
const GONE = "That review was just deleted.";

/**
 * Create or update your review. One review per person per station: a second review of the same
 * station under a new id is a conflict, and `details.existingId` tells the client which review
 * to edit instead.
 */
export async function putReview(
  db: Db,
  session: Session,
  id: string,
  input: ReviewInput,
  now: Date,
): Promise<{ review: ReviewRecord; created: boolean }> {
  const me = session.member.id;
  const existing = await reviewRepo.findReview(db, id);
  // A new photo must be one you uploaded here. (Keeping the review's current photo is fine.)
  if (
    input.photoUrl &&
    input.photoUrl !== existing?.photoUrl &&
    (!isOurPhoto(input.photoUrl) || (await photoOwner(db, input.photoUrl)) !== me)
  ) {
    const message = "That photo didn't upload here.";
    throw new AppError("invalid", message, { fields: { photoUrl: [message] } });
  }

  if (!existing) {
    await assertVisitable(db, input.stationSlug, input.visitedOn, now);
    try {
      const created = await reviewRepo.insertReview(db, id, me, input);
      if (created) {
        await reviewRepo.shareReview(db, id, [session.crew.id]);
        return { review: created, created: true };
      }
      // Lost a race with a retry of this same request; fall through to update it.
    } catch (e) {
      if (!isUniqueViolation(e, "reviews_one_per_member_station")) throw e;
      const mine = await reviewRepo.findReviewByMemberStation(db, me, input.stationSlug);
      throw new AppError("conflict", "You already reviewed this building. Edit that one instead.", {
        existingId: mine?.id,
      });
    }
  }

  const current = existing ?? (await reviewRepo.findReview(db, id));
  if (!current) throw new AppError("not_found", GONE);
  if (current.memberId !== me) throw new AppError("forbidden", "That's someone else's review.");
  if (current.stationSlug !== input.stationSlug) {
    const message = "A review can't move to another building.";
    throw new AppError("invalid", message, { fields: { stationSlug: [message] } });
  }
  // A hidden (removed) station keeps its reviews, but they're frozen.
  await assertVisitable(db, input.stationSlug, input.visitedOn, now);
  const updated = await reviewRepo.updateReview(db, id, input, now);
  if (!updated) throw new AppError("not_found", GONE);
  // Saving your review while looking at a crew shares it there too (one review, many crews).
  await reviewRepo.shareReview(db, id, [session.crew.id]);
  // A replaced or removed photo isn't shown anywhere any more.
  if (current.photoUrl && current.photoUrl !== updated.photoUrl) {
    await releasePhoto(db, current.photoUrl, me);
  }
  return { review: updated, created: false };
}

/** Deleting a review that's already gone succeeds, so retries are safe. */
export async function deleteReview(db: Db, session: Session, id: string): Promise<void> {
  const existing = await reviewRepo.findReview(db, id);
  if (!existing) return;
  if (existing.memberId !== session.member.id) {
    throw new AppError("forbidden", "That's someone else's review.");
  }
  await reviewRepo.deleteReview(db, id);
  if (existing.photoUrl) {
    await releasePhoto(db, existing.photoUrl, session.member.id);
  }
}

/**
 * One check-in per person per station per day. PUT is an upsert keyed by the client's id:
 * sending the same id again updates the note (that's how "Add a note" works after a one-tap
 * check-in), and an identical retry is a no-op. A second id for the same station and day is a
 * conflict, with `details.existingId` pointing at the check-in to add a note to instead.
 */
export async function putCheckin(
  db: Db,
  session: Session,
  id: string,
  input: CheckinInput,
  now: Date,
): Promise<{ checkin: CheckinRecord; created: boolean }> {
  const existing = await checkinRepo.findCheckin(db, id);
  if (existing) {
    if (existing.memberId !== session.member.id) {
      throw new AppError("forbidden", "That's someone else's check-in.");
    }
    if (existing.stationSlug !== input.stationSlug || existing.visitedOn !== input.visitedOn) {
      const message = "A check-in can't move to another building or day.";
      throw new AppError("invalid", message, { fields: { visitedOn: [message] } });
    }
    await checkinRepo.shareCheckin(db, id, [session.crew.id]);
    if (existing.note === input.note) return { checkin: existing, created: false };
    const updated = await checkinRepo.updateCheckinNote(db, id, input.note);
    if (!updated) throw new AppError("not_found", "That check-in was just deleted.");
    return { checkin: updated, created: false };
  }

  await assertVisitable(db, input.stationSlug, input.visitedOn, now);
  try {
    const created = await checkinRepo.insertCheckin(db, id, session.member.id, input);
    if (created) {
      await checkinRepo.shareCheckin(db, id, [session.crew.id]);
      return { checkin: created, created: true };
    }
    return putCheckin(db, session, id, input, now); // raced with a retry of this request
  } catch (e) {
    if (!isUniqueViolation(e, "checkins_one_per_member_station_day")) throw e;
    const today = await checkinRepo.findCheckinOn(
      db,
      session.member.id,
      input.stationSlug,
      input.visitedOn,
    );
    // Checked in here today from another crew: share that check-in with this one instead.
    if (today && !(await checkinRepo.checkinSharedWith(db, today.id, session.crew.id))) {
      await checkinRepo.shareCheckin(db, today.id, [session.crew.id]);
      return { checkin: today, created: false };
    }
    throw new AppError("conflict", "You already checked in here today.", { existingId: today?.id });
  }
}
