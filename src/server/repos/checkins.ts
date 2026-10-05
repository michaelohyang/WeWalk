import "server-only";
import { eq } from "drizzle-orm";
import type { CheckinInput } from "@/domain/schemas";
import type { CheckinRecord } from "@/domain/records";
import type { Db } from "../db/client";
import { checkins } from "../db/schema";

type CheckinRow = typeof checkins.$inferSelect;

const toRecord = (r: CheckinRow): CheckinRecord => ({
  id: r.id,
  stationId: r.stationId,
  memberId: r.memberId,
  visitedOn: r.visitedOn,
  note: r.note,
});

export async function findCheckin(db: Db, id: string): Promise<CheckinRecord | undefined> {
  const [row] = await db.select().from(checkins).where(eq(checkins.id, id));
  return row && toRecord(row);
}

/** Inserts unless the id already exists. Returns undefined if it did. */
export async function insertCheckin(db: Db, id: string, memberId: string, input: CheckinInput) {
  const [row] = await db
    .insert(checkins)
    .values({ id, memberId, ...input })
    .onConflictDoNothing({ target: checkins.id })
    .returning();
  return row && toRecord(row);
}

export async function listCheckins(db: Db): Promise<CheckinRecord[]> {
  return (await db.select().from(checkins)).map(toRecord);
}
