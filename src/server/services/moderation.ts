import "server-only";
import type { Db } from "../db/client";
import { AppError } from "../errors";
import { checkinSharedWith, findCheckin } from "../repos/checkins";
import * as crewsRepo from "../repos/crews";
import * as repo from "../repos/moderation";
import { crewSeesReview, findReview } from "../repos/reviews";
import { crewOf, isAdmin, ownsCrew, type Session } from "./auth";

/*
 * Moderation, one crew at a time. Members report a review or check-in; the crew's owner sees who
 * reported it and hides the post from the crew, removes its author, or dismisses the report.
 * Reports about the owner's own posts go to the app admin, who can hide or dismiss.
 */

export type { OpenReport, PostRef } from "../repos/moderation";
export type ReportAction = "hide" | "remove" | "dismiss";

const GONE = "That post isn't in this crew any more.";
const OWN_POST = "That's your own post. You can edit or delete it instead.";
const HANDLED = "Someone already dealt with that report.";
const NOT_YOURS = "Only the crew owner can deal with that report.";
const NOT_ADMIN = "Reports about a crew's owner go to the app admin.";
const OWNER_STAYS = "A crew's owner can't be removed from it.";
const NOT_SELF = "You can't remove yourself. Leave the crew instead.";
const NOT_MEMBER = "They're not in this crew.";
const OWNER_ONLY = "Only the crew owner can do that.";

/** Report a post in the crew you're looking at. Reporting it twice is the same as once. */
export async function reportPost(
  db: Db,
  session: Session,
  input: { post: repo.PostRef; reason: string },
): Promise<void> {
  const crew = crewOf(session);
  const { post } = input;
  const found =
    post.kind === "review" ? await findReview(db, post.id) : await findCheckin(db, post.id);
  const shared =
    found &&
    (post.kind === "review"
      ? await crewSeesReview(db, post.id, crew.id)
      : await checkinSharedWith(db, post.id, crew.id));
  if (!found || !shared) throw new AppError("not_found", GONE);
  if (found.memberId === session.member.id) throw new AppError("invalid", OWN_POST);
  await repo.insertReport(db, {
    crewId: crew.id,
    reporterId: session.member.id,
    authorId: found.memberId,
    post,
    reason: input.reason,
  });
}

/** The reports you deal with: your crew's (as its owner) and owners' posts (as the admin). */
export async function openReports(db: Db, session: Session): Promise<repo.OpenReport[]> {
  return repo.listOpenReports(db, {
    ownerOf: ownsCrew(session) ? crewOf(session).id : null,
    admin: isAdmin(session),
  });
}

/** Takes someone out of a crew with their posts, and keeps them from rejoining it. */
async function removeFromCrew(db: Db, crewId: string, memberId: string, now: Date) {
  await crewsRepo.lockCrew(db, crewId, "update"); // waits for joins in flight (see joinCrew)
  await crewsRepo.unlinkMemberFromCrew(db, crewId, memberId);
  await crewsRepo.removeCrewMember(db, crewId, memberId);
  await repo.banMember(db, crewId, memberId);
  await repo.resolveReports(db, crewId, { kind: "member", id: memberId }, "removed", now);
}

/**
 * Deal with a report: hide the post from its crew, remove its author from the crew, or dismiss
 * it. Every open report on that post in that crew closes with it (all of the author's, on a
 * removal). Roles are read under a lock, not from the session, so a hand-over can't slip between.
 */
export async function handleReport(
  db: Db,
  session: Session,
  reportId: string,
  action: ReportAction,
  now: Date,
): Promise<void> {
  const me = session.member.id;
  await db.transaction(async (tx) => {
    const report = await repo.findOpenReport(tx, reportId);
    if (!report) throw new AppError("not_found", HANDLED);
    const [myRole, authorRole] = [
      await crewsRepo.lockRole(tx, report.crewId, me),
      await crewsRepo.lockRole(tx, report.crewId, report.authorId),
    ];
    if (authorRole === "owner") {
      if (!isAdmin(session)) throw new AppError("forbidden", NOT_ADMIN);
      if (action === "remove") throw new AppError("conflict", OWNER_STAYS);
    } else if (myRole !== "owner") {
      throw new AppError("forbidden", NOT_YOURS);
    }
    const post: repo.PostRef = report.reviewId
      ? { kind: "review", id: report.reviewId }
      : { kind: "checkin", id: report.checkinId! };
    if (action === "hide") {
      await repo.hidePost(tx, report.crewId, post);
      await repo.resolveReports(tx, report.crewId, post, "hidden", now);
    } else if (action === "dismiss") {
      await repo.resolveReports(tx, report.crewId, post, "dismissed", now);
    } else if (authorRole) {
      await removeFromCrew(tx, report.crewId, report.authorId, now);
    } else {
      // They already left: nothing to remove, but keep them out.
      await repo.banMember(tx, report.crewId, report.authorId);
      await repo.resolveReports(
        tx,
        report.crewId,
        { kind: "member", id: report.authorId },
        "removed",
        now,
      );
    }
  });
}

/** Owner: take someone out of the crew you're looking at. They can't rejoin it. */
export async function removeMember(
  db: Db,
  session: Session,
  memberId: string,
  now: Date,
): Promise<void> {
  const crew = crewOf(session);
  if (memberId === session.member.id) throw new AppError("invalid", NOT_SELF);
  await db.transaction(async (tx) => {
    if ((await crewsRepo.lockRole(tx, crew.id, session.member.id)) !== "owner")
      throw new AppError("forbidden", OWNER_ONLY);
    if (!(await crewsRepo.lockRole(tx, crew.id, memberId)))
      throw new AppError("not_found", NOT_MEMBER);
    await removeFromCrew(tx, crew.id, memberId, now);
  });
}
