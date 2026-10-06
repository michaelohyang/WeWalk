import "server-only";
import { isPlausibleVisitDate } from "@/domain/dates";
import type { CheckinRecord, ReviewRecord } from "@/domain/records";
import type { CheckinInput, ReviewInput } from "@/domain/schemas";
import type { Db } from "../db/client";
import { AppError, isUniqueViolation } from "../errors";
import * as checkinRepo from "../repos/checkins";
import * as reviewRepo from "../repos/reviews";
import { findStation } from "../repos/stations";
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

  if (!existing) {
    await assertVisitable(db, input.stationSlug, input.visitedOn, now);
    try {
      const created = await reviewRepo.insertReview(db, id, me, input);
      if (created) return { review: created, created: true };
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
    if (existing.note === input.note) return { checkin: existing, created: false };
    const updated = await checkinRepo.updateCheckinNote(db, id, input.note);
    if (!updated) throw new AppError("not_found", "That check-in was just deleted.");
    return { checkin: updated, created: false };
  }

  await assertVisitable(db, input.stationSlug, input.visitedOn, now);
  try {
    const created = await checkinRepo.insertCheckin(db, id, session.member.id, input);
    if (created) return { checkin: created, created: true };
    return putCheckin(db, session, id, input, now); // raced with a retry of this request
  } catch (e) {
    if (!isUniqueViolation(e, "checkins_one_per_member_station_day")) throw e;
    const today = await checkinRepo.findCheckinOn(
      db,
      session.member.id,
      input.stationSlug,
      input.visitedOn,
    );
    throw new AppError("conflict", "You already checked in here today.", { existingId: today?.id });
  }
}
