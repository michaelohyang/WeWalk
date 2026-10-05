import "server-only";
import { and, count, eq, gt, isNull, lt, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { devices, links, members } from "../db/schema";

export type MemberRow = typeof members.$inferSelect;
export type LinkPurpose = "pair" | "recover";

export async function countMembers(db: Db): Promise<number> {
  const [row] = await db.select({ n: count() }).from(members);
  return row?.n ?? 0;
}

export async function insertMember(
  db: Db,
  values: { name: string; nameKey: string; isOwner: boolean },
): Promise<MemberRow> {
  const [row] = await db.insert(members).values(values).returning();
  return row!;
}

export async function findMember(db: Db, id: string): Promise<MemberRow | undefined> {
  const [row] = await db.select().from(members).where(eq(members.id, id));
  return row;
}

export async function listMembers(db: Db): Promise<Pick<MemberRow, "id" | "name">[]> {
  return db.select({ id: members.id, name: members.name }).from(members).orderBy(members.createdAt);
}

export async function renameMember(db: Db, id: string, name: string, nameKey: string) {
  const [row] = await db
    .update(members)
    .set({ name, nameKey })
    .where(eq(members.id, id))
    .returning();
  return row;
}

export async function insertDevice(db: Db, memberId: string, tokenHash: string, label = "") {
  const [row] = await db.insert(devices).values({ memberId, tokenHash, label }).returning();
  return row!;
}

export async function findDeviceWithMember(db: Db, tokenHash: string) {
  const [row] = await db
    .select({ device: devices, member: members })
    .from(devices)
    .innerJoin(members, eq(devices.memberId, members.id))
    .where(eq(devices.tokenHash, tokenHash));
  return row;
}

/** Bumps last_seen_at, at most once per `minAgeMs` to avoid a write on every request. */
export async function touchDevice(db: Db, id: string, now: Date, minAgeMs: number) {
  await db
    .update(devices)
    .set({ lastSeenAt: now })
    .where(and(eq(devices.id, id), lt(devices.lastSeenAt, new Date(now.getTime() - minAgeMs))));
}

export async function listDevices(db: Db, memberId: string) {
  return db
    .select({
      id: devices.id,
      label: devices.label,
      createdAt: devices.createdAt,
      lastSeenAt: devices.lastSeenAt,
    })
    .from(devices)
    .where(eq(devices.memberId, memberId))
    .orderBy(devices.createdAt);
}

export async function deleteDevice(db: Db, memberId: string, deviceId: string): Promise<boolean> {
  const rows = await db
    .delete(devices)
    .where(and(eq(devices.id, deviceId), eq(devices.memberId, memberId)))
    .returning({ id: devices.id });
  return rows.length > 0;
}

export async function insertLink(
  db: Db,
  values: { memberId: string; tokenHash: string; purpose: LinkPurpose; expiresAt: Date },
) {
  await db.insert(links).values(values);
}

/** Marks an unused, unexpired link as used, atomically. Returns its member, or undefined. */
export async function consumeLink(db: Db, tokenHash: string, now: Date) {
  const [row] = await db
    .update(links)
    .set({ usedAt: now })
    .where(and(eq(links.tokenHash, tokenHash), isNull(links.usedAt), gt(links.expiresAt, now)))
    .returning({ memberId: links.memberId, purpose: links.purpose });
  return row;
}

/** A link that can still be used, without using it. */
export async function findLiveLink(db: Db, tokenHash: string, now: Date) {
  const [row] = await db
    .select({ memberId: links.memberId, purpose: links.purpose })
    .from(links)
    .where(and(eq(links.tokenHash, tokenHash), isNull(links.usedAt), gt(links.expiresAt, now)));
  return row;
}

/** Housekeeping: drop links that can never be used again. */
export async function deleteDeadLinks(db: Db, now: Date) {
  await db.delete(links).where(sql`${links.usedAt} is not null or ${links.expiresAt} <= ${now}`);
}
