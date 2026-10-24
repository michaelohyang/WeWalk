import "server-only";
import { and, count, eq, gt, isNull, lt, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { devices, links, members } from "../db/schema";

/** Everything about a member except their password: what the rest of the app may see. */
const memberColumns = {
  id: members.id,
  name: members.name,
  nameKey: members.nameKey,
  isAdmin: members.isAdmin,
  hasPassword: sql<boolean>`${members.passwordHash} is not null`,
  onboardedAt: members.onboardedAt,
  createdAt: members.createdAt,
};
export type MemberRow = {
  id: string;
  name: string;
  nameKey: string;
  /** App-wide admin (stations, recovery links). Crew ownership is a crew role. */
  isAdmin: boolean;
  hasPassword: boolean;
  /** Null until they finish the welcome steps. */
  onboardedAt: Date | null;
  createdAt: Date;
};

export async function countMembers(db: Db): Promise<number> {
  const [row] = await db.select({ n: count() }).from(members);
  return row?.n ?? 0;
}

export async function insertMember(
  db: Db,
  values: { name: string; nameKey: string; isAdmin: boolean; passwordHash: string },
): Promise<MemberRow> {
  // New people start with the welcome steps (the column's default is for existing rows).
  const [row] = await db
    .insert(members)
    .values({ ...values, onboardedAt: null })
    .returning(memberColumns);
  return row!;
}

export async function findMember(db: Db, id: string): Promise<MemberRow | undefined> {
  const [row] = await db.select(memberColumns).from(members).where(eq(members.id, id));
  return row;
}

/** Login only: the stored hash and lockout state for a username. */
export async function findCredentials(db: Db, nameKey: string) {
  const [row] = await db
    .select({
      id: members.id,
      passwordHash: members.passwordHash,
      failedLogins: members.failedLogins,
      lockedUntil: members.lockedUntil,
    })
    .from(members)
    .where(eq(members.nameKey, nameKey));
  return row;
}

/** Password and lockout state for a signed-in member (by id). */
export async function findCredentialsById(db: Db, id: string) {
  const [row] = await db
    .select({
      passwordHash: members.passwordHash,
      failedLogins: members.failedLogins,
      lockedUntil: members.lockedUntil,
    })
    .from(members)
    .where(eq(members.id, id));
  return row;
}

export async function findPasswordHash(db: Db, id: string): Promise<string | null | undefined> {
  const [row] = await db
    .select({ passwordHash: members.passwordHash })
    .from(members)
    .where(eq(members.id, id));
  return row?.passwordHash;
}

export async function setPasswordHash(db: Db, id: string, passwordHash: string) {
  await db
    .update(members)
    .set({ passwordHash, failedLogins: 0, lockedUntil: null })
    .where(eq(members.id, id));
}

/** Counts a wrong password; locks the account for `lockMs` once `max` are reached in a row. */
export async function recordFailedLogin(
  db: Db,
  id: string,
  now: Date,
  max: number,
  lockMs: number,
) {
  await db
    .update(members)
    .set({
      failedLogins: sql`${members.failedLogins} + 1`,
      lockedUntil: sql`case when ${members.failedLogins} + 1 >= ${max}
        then ${new Date(now.getTime() + lockMs)}::timestamptz else ${members.lockedUntil} end`,
    })
    .where(eq(members.id, id));
}

export async function clearPassword(db: Db, id: string) {
  await db
    .update(members)
    .set({ passwordHash: null, failedLogins: 0, lockedUntil: null })
    .where(eq(members.id, id));
}

export async function clearFailedLogins(db: Db, id: string) {
  await db.update(members).set({ failedLogins: 0, lockedUntil: null }).where(eq(members.id, id));
}

export async function listMembers(db: Db): Promise<Pick<MemberRow, "id" | "name">[]> {
  return db.select({ id: members.id, name: members.name }).from(members).orderBy(members.createdAt);
}

/** Marks the welcome steps done (once: the first time stays). */
export async function markOnboarded(db: Db, id: string, now: Date) {
  await db
    .update(members)
    .set({ onboardedAt: now })
    .where(and(eq(members.id, id), isNull(members.onboardedAt)));
}

export async function renameMember(db: Db, id: string, name: string, nameKey: string) {
  const [row] = await db
    .update(members)
    .set({ name, nameKey })
    .where(eq(members.id, id))
    .returning(memberColumns);
  return row;
}

/**
 * Deletes a member. The foreign keys cascade (schema.ts), so their phones, recovery links,
 * reviews (and everyone's reactions to them), check-ins and the reactions they gave go too.
 */
export async function deleteMember(db: Db, id: string): Promise<boolean> {
  const rows = await db.delete(members).where(eq(members.id, id)).returning({ id: members.id });
  return rows.length > 0;
}

/**
 * Locks a member's row until the transaction ends (so a hand-over to them, or a join, can't land
 * between a check and deleting them). False if they're gone.
 */
export async function lockMember(db: Db, id: string): Promise<boolean> {
  const [row] = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.id, id))
    .for("update");
  return !!row;
}

export async function insertDevice(db: Db, memberId: string, tokenHash: string, label = "") {
  const [row] = await db.insert(devices).values({ memberId, tokenHash, label }).returning();
  return row!;
}

export async function findDeviceWithMember(db: Db, tokenHash: string) {
  const [row] = await db
    .select({ device: devices, member: memberColumns })
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

/**
 * One-time links are all recovery links now. (The table also allows "pair", from when a phone
 * could be added with a link; those expired within 15 minutes and are no longer made or accepted.)
 */
const live = (tokenHash: string, now: Date) =>
  and(
    eq(links.tokenHash, tokenHash),
    eq(links.purpose, "recover"),
    isNull(links.usedAt),
    gt(links.expiresAt, now),
  );

export async function insertLink(
  db: Db,
  values: { memberId: string; tokenHash: string; expiresAt: Date },
) {
  await db.insert(links).values({ ...values, purpose: "recover" });
}

/** Marks an unused, unexpired link as used, atomically. Returns its member, or undefined. */
export async function consumeLink(db: Db, tokenHash: string, now: Date) {
  const [row] = await db
    .update(links)
    .set({ usedAt: now })
    .where(live(tokenHash, now))
    .returning({ memberId: links.memberId });
  return row;
}

/** A link that can still be used, without using it. */
export async function findLiveLink(db: Db, tokenHash: string, now: Date) {
  const [row] = await db
    .select({ memberId: links.memberId })
    .from(links)
    .where(live(tokenHash, now));
  return row;
}

/** Housekeeping: drop links that can never be used again. */
export async function deleteDeadLinks(db: Db, now: Date) {
  await db.delete(links).where(sql`${links.usedAt} is not null or ${links.expiresAt} <= ${now}`);
}
