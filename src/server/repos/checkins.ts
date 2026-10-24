import "server-only";
import { and, eq, getTableColumns, sql } from "drizzle-orm";
import type { CheckinInput } from "@/domain/schemas";
import type { CheckinRecord } from "@/domain/records";
import type { Db } from "../db/client";
import { checkinCrews, checkins, FIRST_CREW_ID, stations } from "../db/schema";
import { stationKey } from "./stations";

type CheckinRow = typeof checkins.$inferSelect & { stationSlug: string };

/** Check-ins with their station's slug: the rest of the app names stations by slug. */
const select = (db: Db) =>
  db
    .select({ ...getTableColumns(checkins), stationSlug: stations.slug })
    .from(checkins)
    .innerJoin(stations, eq(checkins.stationId, stations.id));

const toRecord = (r: CheckinRow): CheckinRecord => ({
  id: r.id,
  stationSlug: r.stationSlug,
  memberId: r.memberId,
  visitedOn: r.visitedOn,
  note: r.note,
  checkedInAt: r.createdAt.toISOString(),
});

export async function findCheckin(db: Db, id: string): Promise<CheckinRecord | undefined> {
  const [row] = await select(db).where(eq(checkins.id, id));
  return row && toRecord(row);
}

/** Inserts unless the id already exists. Returns undefined if it did. */
export async function insertCheckin(db: Db, id: string, memberId: string, input: CheckinInput) {
  const { stationSlug, ...fields } = input;
  const [row] = await db
    .insert(checkins)
    .values({ id, memberId, ...fields, stationId: stationKey(stationSlug) })
    .onConflictDoNothing({ target: checkins.id })
    .returning({ id: checkins.id });
  return row && findCheckin(db, row.id);
}

/** The check-ins a crew sees (as with reviews, unlinked ones count as the first crew's). */
export async function listCheckins(db: Db, crewId: string): Promise<CheckinRecord[]> {
  const shared = sql`exists (select 1 from ${checkinCrews} cc where cc.checkin_id = ${checkins.id} and cc.crew_id = ${crewId})`;
  const unlinked = sql`not exists (select 1 from ${checkinCrews} cc where cc.checkin_id = ${checkins.id})`;
  const rows = await select(db).where(
    crewId === FIRST_CREW_ID ? sql`(${shared} or ${unlinked})` : shared,
  );
  return rows.map(toRecord);
}

/** One member's check-ins, in every crew. */
export async function listCheckinsBy(db: Db, memberId: string): Promise<CheckinRecord[]> {
  return (await select(db).where(eq(checkins.memberId, memberId))).map(toRecord);
}

/** Shares a check-in with crews (sharing it again changes nothing). */
export async function shareCheckin(db: Db, checkinId: string, crewIds: readonly string[]) {
  if (!crewIds.length) return;
  await db
    .insert(checkinCrews)
    .values(crewIds.map((crewId) => ({ checkinId, crewId })))
    .onConflictDoNothing();
}

/** Whether a check-in is already shared with a crew. */
export async function checkinSharedWith(db: Db, checkinId: string, crewId: string) {
  const [row] = await db
    .select({ crewId: checkinCrews.crewId })
    .from(checkinCrews)
    .where(and(eq(checkinCrews.checkinId, checkinId), eq(checkinCrews.crewId, crewId)));
  return !!row;
}

/** One member's check-ins with the station's name, oldest first (data export). */
export async function listMemberCheckins(db: Db, memberId: string) {
  return db
    .select({
      stationSlug: stations.slug,
      stationName: stations.name,
      visitedOn: checkins.visitedOn,
      note: checkins.note,
      createdAt: checkins.createdAt,
    })
    .from(checkins)
    .innerJoin(stations, eq(checkins.stationId, stations.id))
    .where(eq(checkins.memberId, memberId))
    .orderBy(checkins.createdAt);
}

/** Returns undefined if the check-in no longer exists. */
export async function updateCheckinNote(db: Db, id: string, note: string) {
  const [row] = await db
    .update(checkins)
    .set({ note })
    .where(eq(checkins.id, id))
    .returning({ id: checkins.id });
  return row && findCheckin(db, row.id);
}

export async function findCheckinOn(
  db: Db,
  memberId: string,
  stationSlug: string,
  visitedOn: string,
) {
  const [row] = await select(db).where(
    and(
      eq(checkins.memberId, memberId),
      eq(stations.slug, stationSlug),
      eq(checkins.visitedOn, visitedOn),
    ),
  );
  return row && toRecord(row);
}
