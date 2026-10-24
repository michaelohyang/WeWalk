import { and, asc, eq, not, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db } from "../db/client";
import {
  checkinCrews,
  checkinHides,
  checkins,
  crewBans,
  crewMembers,
  crews,
  members,
  reactions,
  reports,
  reviewCrews,
  reviewHides,
  reviews,
  stations,
} from "../db/schema";

export type ReportStatus = "open" | "hidden" | "removed" | "dismissed";
export type PostRef = { kind: "review"; id: string } | { kind: "checkin"; id: string };

/** Whether the post's author owns the crew the report was made in (then the admin handles it). */
const authorOwnsCrew = sql<boolean>`exists (
  select 1 from ${crewMembers} cm
  where cm.crew_id = ${reports.crewId} and cm.member_id = ${reports.authorId} and cm.role = 'owner'
)`;

export async function insertReport(
  db: Db,
  values: { crewId: string; reporterId: string; authorId: string; post: PostRef; reason: string },
) {
  await db
    .insert(reports)
    .values({
      crewId: values.crewId,
      reporterId: values.reporterId,
      authorId: values.authorId,
      reviewId: values.post.kind === "review" ? values.post.id : null,
      checkinId: values.post.kind === "checkin" ? values.post.id : null,
      reason: values.reason,
    })
    // Already reported and still open: one report is enough.
    .onConflictDoNothing();
}

/** An open report, locked until the transaction ends (two taps on it can't both act). */
export async function findOpenReport(db: Db, id: string) {
  const [row] = await db
    .select({
      id: reports.id,
      crewId: reports.crewId,
      authorId: reports.authorId,
      reviewId: reports.reviewId,
      checkinId: reports.checkinId,
      authorOwnsCrew,
    })
    .from(reports)
    .where(and(eq(reports.id, id), eq(reports.status, "open")))
    .for("update");
  return row;
}

const author = alias(members, "author");
const reporter = alias(members, "reporter");

export interface OpenReport {
  id: string;
  crewId: string;
  crewName: string;
  authorId: string;
  authorName: string;
  authorOwnsCrew: boolean;
  /** Null once the reporter has deleted their account. */
  reporterName: string | null;
  reason: string;
  createdAt: Date;
  kind: "review" | "checkin";
  station: { name: string; neighborhood: string };
  hotTake: string | null;
  body: string | null;
  photoUrl: string | null;
  note: string | null;
}

const MAX_LISTED = 50;

/**
 * Open reports someone handles, oldest first: those in `ownerOf` (a crew they own) about anyone
 * but its owner, and, for the admin, those about a crew's owner in any crew.
 */
export async function listOpenReports(
  db: Db,
  handler: { ownerOf: string | null; admin: boolean },
): Promise<OpenReport[]> {
  const scopes: SQL[] = [];
  if (handler.ownerOf) scopes.push(and(eq(reports.crewId, handler.ownerOf), not(authorOwnsCrew))!);
  if (handler.admin) scopes.push(authorOwnsCrew);
  if (!scopes.length) return [];
  const rows = await db
    .select({
      id: reports.id,
      crewId: reports.crewId,
      crewName: crews.name,
      authorId: reports.authorId,
      authorName: author.name,
      authorOwnsCrew,
      reporterName: reporter.name,
      reason: reports.reason,
      createdAt: reports.createdAt,
      reviewId: reports.reviewId,
      stationName: stations.name,
      neighborhood: stations.neighborhood,
      hotTake: reviews.hotTake,
      body: reviews.body,
      photoUrl: reviews.photoUrl,
      note: checkins.note,
    })
    .from(reports)
    .innerJoin(crews, eq(crews.id, reports.crewId))
    .innerJoin(author, eq(author.id, reports.authorId))
    .leftJoin(reporter, eq(reporter.id, reports.reporterId))
    .leftJoin(reviews, eq(reviews.id, reports.reviewId))
    .leftJoin(checkins, eq(checkins.id, reports.checkinId))
    .innerJoin(
      stations,
      sql`${stations.id} = coalesce(${reviews.stationId}, ${checkins.stationId})`,
    )
    .where(and(eq(reports.status, "open"), or(...scopes)))
    .orderBy(asc(reports.createdAt))
    .limit(MAX_LISTED);
  return rows.map(({ reviewId, stationName, neighborhood, ...r }) => ({
    ...r,
    kind: reviewId ? "review" : "checkin",
    station: { name: stationName, neighborhood },
  }));
}

/** Closes every open report in a crew about one post, or about everything one member posted. */
export async function resolveReports(
  db: Db,
  crewId: string,
  about: PostRef | { kind: "member"; id: string },
  status: Exclude<ReportStatus, "open">,
  now: Date,
) {
  const target =
    about.kind === "review"
      ? eq(reports.reviewId, about.id)
      : about.kind === "checkin"
        ? eq(reports.checkinId, about.id)
        : eq(reports.authorId, about.id);
  await db
    .update(reports)
    .set({ status, resolvedAt: now })
    .where(and(eq(reports.crewId, crewId), eq(reports.status, "open"), target));
}

/** Takes a post out of a crew for good: unshared, its reactions there gone, and kept out. */
export async function hidePost(db: Db, crewId: string, post: PostRef) {
  if (post.kind === "review") {
    await db
      .delete(reviewCrews)
      .where(and(eq(reviewCrews.crewId, crewId), eq(reviewCrews.reviewId, post.id)));
    await db
      .delete(reactions)
      .where(and(eq(reactions.crewId, crewId), eq(reactions.reviewId, post.id)));
    await db.insert(reviewHides).values({ crewId, reviewId: post.id }).onConflictDoNothing();
  } else {
    await db
      .delete(checkinCrews)
      .where(and(eq(checkinCrews.crewId, crewId), eq(checkinCrews.checkinId, post.id)));
    await db.insert(checkinHides).values({ crewId, checkinId: post.id }).onConflictDoNothing();
  }
}

export async function banMember(db: Db, crewId: string, memberId: string) {
  await db.insert(crewBans).values({ crewId, memberId }).onConflictDoNothing();
}

export async function isBanned(db: Db, crewId: string, memberId: string): Promise<boolean> {
  const [row] = await db
    .select({ crewId: crewBans.crewId })
    .from(crewBans)
    .where(and(eq(crewBans.crewId, crewId), eq(crewBans.memberId, memberId)));
  return !!row;
}

/** The reports a member made, oldest first (data export): no names of the people reported. */
export async function listReportsBy(db: Db, memberId: string) {
  const rows = await db
    .select({
      reviewId: reports.reviewId,
      reason: reports.reason,
      status: reports.status,
      createdAt: reports.createdAt,
      stationName: stations.name,
    })
    .from(reports)
    .leftJoin(reviews, eq(reviews.id, reports.reviewId))
    .leftJoin(checkins, eq(checkins.id, reports.checkinId))
    .innerJoin(
      stations,
      sql`${stations.id} = coalesce(${reviews.stationId}, ${checkins.stationId})`,
    )
    .where(eq(reports.reporterId, memberId))
    .orderBy(asc(reports.createdAt));
  return rows.map(({ reviewId, ...r }) => ({ kind: reviewId ? "review" : "checkin", ...r }));
}
