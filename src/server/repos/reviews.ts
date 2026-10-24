import "server-only";
import { and, eq, getTableColumns, sql } from "drizzle-orm";
import { CATEGORY_KEYS, type Score } from "@/domain/categories";
import type { ReviewInput } from "@/domain/schemas";
import type { ReviewRecord } from "@/domain/records";
import type { Scores } from "@/domain/scoring";
import type { Tag } from "@/domain/tags";
import type { Db } from "../db/client";
import { crews, reviewCrews, reviewHides, reviews, stations } from "../db/schema";
import { stationKey } from "./stations";

type ReviewRow = typeof reviews.$inferSelect & { stationSlug: string };

/** Reviews with their station's slug: the rest of the app names stations by slug. */
const select = (db: Db) =>
  db
    .select({ ...getTableColumns(reviews), stationSlug: stations.slug })
    .from(reviews)
    .innerJoin(stations, eq(reviews.stationId, stations.id));

function toReviewRecord(row: ReviewRow): ReviewRecord {
  const scores: Scores = {};
  for (const k of CATEGORY_KEYS) {
    const v = row[k];
    if (v !== null) scores[k] = v as Score;
  }
  return {
    id: row.id,
    stationSlug: row.stationSlug,
    memberId: row.memberId,
    visitedOn: row.visitedOn,
    scores,
    hotTake: row.hotTake,
    body: row.body,
    tags: row.tags as Tag[],
    photoUrl: row.photoUrl,
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
    photoUrl: input.photoUrl,
  };
}

export async function findReview(db: Db, id: string): Promise<ReviewRecord | undefined> {
  const [row] = await select(db).where(eq(reviews.id, id));
  return row && toReviewRecord(row);
}

export async function findReviewByMemberStation(db: Db, memberId: string, stationSlug: string) {
  const [row] = await select(db).where(
    and(eq(reviews.memberId, memberId), eq(stations.slug, stationSlug)),
  );
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
    .values({ id, memberId, stationId: stationKey(input.stationSlug), ...columns(input) })
    .onConflictDoNothing({ target: reviews.id })
    .returning({ id: reviews.id });
  return row && findReview(db, row.id);
}

/** Returns undefined if the review no longer exists (deleted meanwhile). */
export async function updateReview(db: Db, id: string, input: ReviewInput, now: Date) {
  const [row] = await db
    .update(reviews)
    .set({ ...columns(input), updatedAt: now })
    .where(eq(reviews.id, id))
    .returning({ id: reviews.id });
  return row && findReview(db, row.id);
}

export async function deleteReview(db: Db, id: string) {
  await db.delete(reviews).where(eq(reviews.id, id));
}

/**
 * The reviews a crew sees: those shared with it. A review shared with no crew (its author left
 * them all) is seen by nobody.
 */
export async function listReviews(db: Db, crewId: string): Promise<ReviewRecord[]> {
  const rows = await select(db).where(
    sql`exists (select 1 from ${reviewCrews} rc where rc.review_id = ${reviews.id} and rc.crew_id = ${crewId})`,
  );
  return rows.map(toReviewRecord);
}

/** One member's reviews, in every crew. */
export async function listReviewsBy(db: Db, memberId: string): Promise<ReviewRecord[]> {
  return (await select(db).where(eq(reviews.memberId, memberId))).map(toReviewRecord);
}

/**
 * Shares a review with crews (sharing it again changes nothing). A crew whose owner took it out
 * (review_hides) is skipped, so editing a review never puts it back.
 */
export async function shareReview(db: Db, reviewId: string, crewIds: readonly string[]) {
  if (!crewIds.length) return;
  const ids = sql.join(
    crewIds.map((id) => sql`${id}::uuid`),
    sql`, `,
  );
  await db.execute(sql`
    insert into ${reviewCrews} (review_id, crew_id)
    select ${reviewId}::uuid, c.id from ${crews} c
    where c.id in (${ids})
      and not exists (
        select 1 from ${reviewHides} h where h.review_id = ${reviewId}::uuid and h.crew_id = c.id
      )
    on conflict do nothing`);
}

/** Whether a crew sees a review (it's shared with it). */
export async function crewSeesReview(db: Db, reviewId: string, crewId: string): Promise<boolean> {
  const [row] = await db
    .select({ crewId: reviewCrews.crewId })
    .from(reviewCrews)
    .where(and(eq(reviewCrews.reviewId, reviewId), eq(reviewCrews.crewId, crewId)));
  return !!row;
}

/** One member's reviews with both timestamps and the station's name, oldest first (data export). */
export async function listMemberReviews(db: Db, memberId: string) {
  const rows = await db
    .select({ ...getTableColumns(reviews), stationSlug: stations.slug, stationName: stations.name })
    .from(reviews)
    .innerJoin(stations, eq(reviews.stationId, stations.id))
    .where(eq(reviews.memberId, memberId))
    .orderBy(reviews.createdAt);
  return rows.map((row) => ({
    ...toReviewRecord(row),
    stationName: row.stationName,
    createdAt: row.createdAt.toISOString(),
  }));
}

/** Whether any review shows this photo. */
export async function photoInUse(db: Db, url: string): Promise<boolean> {
  const [row] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(eq(reviews.photoUrl, url))
    .limit(1);
  return !!row;
}
