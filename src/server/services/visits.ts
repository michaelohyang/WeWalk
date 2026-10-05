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

async function assertVisitable(db: Db, stationId: string, visitedOn: string, now: Date) {
  const station = await findStation(db, stationId);
  if (!station || station.hidden)
    throw new AppError("not_found", "That building isn't on the map.");
  if (!isPlausibleVisitDate(visitedOn, now)) {
    throw new AppError("invalid", "That visit date doesn't look right.", { field: "visitedOn" });
  }
}

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
    await assertVisitable(db, input.stationId, input.visitedOn, now);
    try {
      const created = await reviewRepo.insertReview(db, id, me, input);
      if (created) return { review: created, created: true };
      // Lost a race with a retry of this same request; fall through to update it.
    } catch (e) {
      if (!isUniqueViolation(e, "reviews_one_per_member_station")) throw e;
      const mine = await reviewRepo.findReviewByMemberStation(db, me, input.stationId);
      throw new AppError("conflict", "You already reviewed this building. Edit that one instead.", {
        existingId: mine?.id,
      });
    }
  }

  const current = existing ?? (await reviewRepo.findReview(db, id))!;
  if (current.memberId !== me) throw new AppError("forbidden", "That's someone else's review.");
  if (current.stationId !== input.stationId) {
    throw new AppError("invalid", "A review can't move to another building.", {
      field: "stationId",
    });
  }
  if (!isPlausibleVisitDate(input.visitedOn, now)) {
    throw new AppError("invalid", "That visit date doesn't look right.", { field: "visitedOn" });
  }
  return { review: await reviewRepo.updateReview(db, id, input, now), created: false };
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

/** One check-in per person per station per day. Repeating the same id returns the original. */
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
    return { checkin: existing, created: false };
  }

  await assertVisitable(db, input.stationId, input.visitedOn, now);
  try {
    const created = await checkinRepo.insertCheckin(db, id, session.member.id, input);
    if (created) return { checkin: created, created: true };
    return putCheckin(db, session, id, input, now); // raced with a retry of this request
  } catch (e) {
    if (isUniqueViolation(e, "checkins_one_per_member_station_day")) {
      throw new AppError("conflict", "You already checked in here today.");
    }
    throw e;
  }
}
