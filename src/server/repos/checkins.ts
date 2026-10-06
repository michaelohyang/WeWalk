import "server-only";
import { and, eq, getTableColumns } from "drizzle-orm";
import type { CheckinInput } from "@/domain/schemas";
import type { CheckinRecord } from "@/domain/records";
import type { Db } from "../db/client";
import { checkins, stations } from "../db/schema";
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

export async function listCheckins(db: Db): Promise<CheckinRecord[]> {
  return (await select(db)).map(toRecord);
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
