import "server-only";
import { and, eq } from "drizzle-orm";
import type { ReactionKey, ReactionRecord } from "@/domain/reactions";
import type { Db } from "../db/client";
import { reactions, reviews, stations } from "../db/schema";

/** The reactions made in a crew. */
export async function listReactions(db: Db, crewId: string): Promise<ReactionRecord[]> {
  const rows = await db
    .select({ reviewId: reactions.reviewId, memberId: reactions.memberId, kind: reactions.kind })
    .from(reactions)
    .where(eq(reactions.crewId, crewId));
  return rows as ReactionRecord[];
}

/** Adds a reaction in a crew; adding one that's already there does nothing. */
export async function addReaction(db: Db, value: ReactionRecord & { crewId: string }) {
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

/**
 * The reactions one member gave, with the station of each review (data export). Not the
 * review's author: that's someone else's data.
 */
export async function listMemberReactions(db: Db, memberId: string) {
  return db
    .select({
      kind: reactions.kind,
      stationSlug: stations.slug,
      stationName: stations.name,
      createdAt: reactions.createdAt,
    })
    .from(reactions)
    .innerJoin(reviews, eq(reactions.reviewId, reviews.id))
    .innerJoin(stations, eq(reviews.stationId, stations.id))
    .where(eq(reactions.memberId, memberId))
    .orderBy(reactions.createdAt);
}
