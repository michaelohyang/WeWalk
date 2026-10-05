import "server-only";
import { and, eq } from "drizzle-orm";
import { CATEGORY_KEYS, type Score } from "@/domain/categories";
import type { ReviewInput } from "@/domain/schemas";
import type { ReviewRecord } from "@/domain/records";
import type { Scores } from "@/domain/scoring";
import type { Tag } from "@/domain/tags";
import type { Db } from "../db/client";
import { reviews } from "../db/schema";

type ReviewRow = typeof reviews.$inferSelect;

export function toReviewRecord(row: ReviewRow): ReviewRecord {
  const scores: Scores = {};
  for (const k of CATEGORY_KEYS) {
    const v = row[k];
    if (v !== null) scores[k] = v as Score;
  }
  return {
    id: row.id,
    stationId: row.stationId,
    memberId: row.memberId,
    visitedOn: row.visitedOn,
    scores,
    hotTake: row.hotTake,
    body: row.body,
    tags: row.tags as Tag[],
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Column values for a review's editable fields. Skipped categories are stored as null. */
function columns(input: ReviewInput) {
  return {
    visitedOn: input.visitedOn,
    ...Object.fromEntries(CATEGORY_KEYS.map((k) => [k, input.scores[k] ?? null])),
    hotTake: input.hotTake,
    body: input.body,
    tags: input.tags,
  };
}

export async function findReview(db: Db, id: string): Promise<ReviewRecord | undefined> {
  const [row] = await db.select().from(reviews).where(eq(reviews.id, id));
  return row && toReviewRecord(row);
}

export async function findReviewByMemberStation(db: Db, memberId: string, stationId: string) {
  const [row] = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.memberId, memberId), eq(reviews.stationId, stationId)));
  return row && toReviewRecord(row);
}

/** Inserts unless the id already exists. Returns undefined if it did. */
export async function insertReview(
  db: Db,
  id: string,
  memberId: string,
  input: ReviewInput,
): Promise<ReviewRecord | undefined> {
  const [row] = await db
    .insert(reviews)
    .values({ id, memberId, stationId: input.stationId, ...columns(input) })
    .onConflictDoNothing({ target: reviews.id })
    .returning();
  return row && toReviewRecord(row);
}

/** Returns undefined if the review no longer exists (deleted meanwhile). */
export async function updateReview(db: Db, id: string, input: ReviewInput, now: Date) {
  const [row] = await db
    .update(reviews)
    .set({ ...columns(input), updatedAt: now })
    .where(eq(reviews.id, id))
    .returning();
  return row && toReviewRecord(row);
}

export async function deleteReview(db: Db, id: string) {
  await db.delete(reviews).where(eq(reviews.id, id));
}

export async function listReviews(db: Db): Promise<ReviewRecord[]> {
  return (await db.select().from(reviews)).map(toReviewRecord);
}
