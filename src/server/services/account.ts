import "server-only";
import * as crewsRepo from "../repos/crews";
import type { Db } from "../db/client";
import { AppError } from "../errors";
import { verifyPassword } from "../auth/passwords";
import { listMemberCheckins } from "../repos/checkins";
import * as memberRepo from "../repos/members";
import { listMemberReactions } from "../repos/reactions";
import { listMemberReviews } from "../repos/reviews";
import { deletePhoto } from "../photos";
import { ownsCrew, type Session } from "./auth";

/*
 * Your account: take a copy of your data, hand the crew to someone else, or leave for good.
 */

/**
 * Everything the crew has that's yours, as plain JSON. Nothing about other members (not even
 * who wrote the reviews you reacted to), and no secrets: no password or session token hashes.
 */
export async function exportData(db: Db, session: Session, now: Date) {
  const me = session.member;
  const [devices, reviews, checkins, reactions] = await Promise.all([
    memberRepo.listDevices(db, me.id),
    listMemberReviews(db, me.id),
    listMemberCheckins(db, me.id),
    listMemberReactions(db, me.id),
  ]);
  return {
    exportedAt: now.toISOString(),
    profile: {
      name: me.name,
      joinedAt: me.createdAt.toISOString(),
      isAdmin: me.isAdmin,
      crews: session.crews.map((c) => ({ name: c.name, role: c.role })),
    },
    devices: devices.map((d) => ({
      label: d.label,
      createdAt: d.createdAt.toISOString(),
      lastSeenAt: d.lastSeenAt.toISOString(),
    })),
    reviews: reviews.map((r) => ({
      stationSlug: r.stationSlug,
      stationName: r.stationName,
      visitedOn: r.visitedOn,
      scores: r.scores,
      hotTake: r.hotTake,
      body: r.body,
      tags: r.tags,
      photoUrl: r.photoUrl,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    checkins: checkins.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
    reactions: reactions.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  };
}

const WRONG_PASSWORD = "That's not your password.";
const NEEDS_PASSWORD = "Set a password first. Deleting your account needs it.";
const OWNER_STAYS =
  "You run a crew with other people in it. Hand it over to someone first, so it keeps an owner.";

/**
 * Deletes your account and everything that's yours: phones, recovery links, reviews and their
 * photos, check-ins, reactions you gave, and reactions others gave your reviews. Needs your
 * password, so a phone left unlocked can't do it. Members without one (they came back through
 * a recovery link) set one first. A crew's owner can only leave once they're the last one in it,
 * so no crew is left without an owner.
 */
export async function deleteAccount(
  db: Db,
  session: Session,
  input: { password: string },
): Promise<void> {
  const me = session.member.id;
  const stored = await memberRepo.findPasswordHash(db, me);
  if (!stored)
    throw new AppError("invalid", NEEDS_PASSWORD, { fields: { password: [NEEDS_PASSWORD] } });
  if (!(await verifyPassword(input.password, stored))) {
    throw new AppError("invalid", WRONG_PASSWORD, { fields: { password: [WRONG_PASSWORD] } });
  }
  const photos = await db.transaction(async (tx) => {
    if (!(await memberRepo.lockMember(tx, me))) {
      throw new AppError("unauthorized", "You're signed out.");
    }
    if ((await crewsRepo.ownedCrewsWithOthers(tx, me)).length) {
      throw new AppError("conflict", OWNER_STAYS);
    }
    const urls = (await listMemberReviews(tx, me)).flatMap((r) => r.photoUrl ?? []);
    await memberRepo.deleteMember(tx, me);
    return urls;
  });
  // Only once the reviews are gone for sure: a rolled-back delete would leave broken photos.
  await Promise.all(photos.map(deletePhoto));
}

/** Owner only: make another member the crew's owner (you become a regular member). */
export async function handOverOwnership(db: Db, session: Session, memberId: string) {
  if (!ownsCrew(session)) throw new AppError("forbidden", "Only the crew owner can do that.");
  if (memberId === session.member.id) throw new AppError("invalid", "You already run this crew.");
  await db.transaction(async (tx) => {
    // Throwing rolls back, so a failed hand-over never leaves the crew without an owner.
    const result = await crewsRepo.transferCrewOwnership(
      tx,
      session.crew.id,
      session.member.id,
      memberId,
    );
    // A stale session (handed over already on another phone) isn't the owner any more.
    if (result === "not_owner") throw new AppError("forbidden", "Only the crew owner can do that.");
    if (result === "no_member") throw new AppError("not_found", "They're not in this crew.");
  });
}
