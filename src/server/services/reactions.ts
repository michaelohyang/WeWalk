import "server-only";
import type { ReactionKey } from "@/domain/reactions";
import type { Db } from "../db/client";
import { AppError } from "../errors";
import * as reactionRepo from "../repos/reactions";
import { crewSeesReview, findReview } from "../repos/reviews";
import { crewOf, type Session } from "./auth";

/*
 * Reactions are PUT (add) and DELETE (remove) on one URL per review and kind, so both are
 * idempotent and the offline outbox can retry them safely.
 */

/** React to someone else's review, in the crew you're looking at (it must see the review). */
export async function react(db: Db, session: Session, reviewId: string, kind: ReactionKey) {
  const review = await findReview(db, reviewId);
  if (!review || !(await crewSeesReview(db, reviewId, crewOf(session).id))) {
    throw new AppError("not_found", "That review was just deleted.");
  }
  if (review.memberId === session.member.id) {
    throw new AppError("invalid", "You can't react to your own review.");
  }
  await reactionRepo.addReaction(db, {
    reviewId,
    memberId: session.member.id,
    kind,
    crewId: crewOf(session).id,
  });
}

/** Take back your reaction in this crew. Taking back one that isn't there succeeds. */
export async function unreact(db: Db, session: Session, reviewId: string, kind: ReactionKey) {
  await reactionRepo.removeReaction(db, {
    reviewId,
    memberId: session.member.id,
    kind,
    crewId: crewOf(session).id,
  });
}
