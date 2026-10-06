import "server-only";
import { and, eq } from "drizzle-orm";
import type { ReactionKey, ReactionRecord } from "@/domain/reactions";
import type { Db } from "../db/client";
import { reactions } from "../db/schema";

export async function listReactions(db: Db): Promise<ReactionRecord[]> {
  const rows = await db
    .select({ reviewId: reactions.reviewId, memberId: reactions.memberId, kind: reactions.kind })
    .from(reactions);
  return rows as ReactionRecord[];
}

/** Adds a reaction; adding one that's already there does nothing. */
export async function addReaction(db: Db, value: ReactionRecord) {
  await db.insert(reactions).values(value).onConflictDoNothing();
}

/** Removes a reaction; removing one that isn't there does nothing. */
export async function removeReaction(
  db: Db,
  reviewId: string,
  memberId: string,
  kind: ReactionKey,
) {
  await db
    .delete(reactions)
    .where(
      and(
        eq(reactions.reviewId, reviewId),
        eq(reactions.memberId, memberId),
        eq(reactions.kind, kind),
      ),
    );
}
