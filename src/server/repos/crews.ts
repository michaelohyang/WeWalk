import { and, asc, count, eq, sql } from "drizzle-orm";
import type { CityKey } from "@/domain/areas";
import type { Db } from "../db/client";
import { crewMembers, crews, FIRST_CREW_ID, members } from "../db/schema";

export type CrewRole = "owner" | "member";

/** A crew as the signed-in member sees it. */
export interface CrewRef {
  id: string;
  name: string;
  role: CrewRole;
  homeCity: CityKey;
  inviteCode: string;
}

const crewRefColumns = {
  id: crews.id,
  name: crews.name,
  role: crewMembers.role,
  homeCity: crews.homeCity,
  inviteCode: crews.inviteCode,
};

/** The member's crews, the oldest membership first. */
export async function listMemberCrews(db: Db, memberId: string): Promise<CrewRef[]> {
  const rows = await db
    .select(crewRefColumns)
    .from(crewMembers)
    .innerJoin(crews, eq(crewMembers.crewId, crews.id))
    .where(eq(crewMembers.memberId, memberId))
    .orderBy(asc(crewMembers.joinedAt), asc(crews.createdAt));
  return rows as CrewRef[];
}

/** Joins a crew; joining one you're already in changes nothing. Returns whether it was new. */
export async function addCrewMember(
  db: Db,
  crewId: string,
  memberId: string,
  role: CrewRole = "member",
): Promise<boolean> {
  const rows = await db
    .insert(crewMembers)
    .values({ crewId, memberId, role })
    .onConflictDoNothing()
    .returning({ crewId: crewMembers.crewId });
  return rows.length > 0;
}

export async function countCrewMembers(db: Db, crewId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(crewMembers)
    .where(eq(crewMembers.crewId, crewId));
  return row?.n ?? 0;
}

export async function findCrewByInviteCode(db: Db, inviteCode: string) {
  const [row] = await db
    .select({ id: crews.id, name: crews.name })
    .from(crews)
    .where(eq(crews.inviteCode, inviteCode));
  return row;
}

/** A crew's members, the earliest to join first. */
export async function listCrewMembers(db: Db, crewId: string) {
  return db
    .select({ id: members.id, name: members.name })
    .from(crewMembers)
    .innerJoin(members, eq(crewMembers.memberId, members.id))
    .where(eq(crewMembers.crewId, crewId))
    .orderBy(asc(crewMembers.joinedAt), asc(members.createdAt));
}

/**
 * Makes `toId` the crew's owner and `fromId` a member. Demotes first (one owner per crew), so
 * run it in a transaction and roll back unless it returns "moved".
 */
export async function transferCrewOwnership(
  db: Db,
  crewId: string,
  fromId: string,
  toId: string,
): Promise<"moved" | "not_owner" | "no_member"> {
  const demoted = await db
    .update(crewMembers)
    .set({ role: "member" })
    .where(
      and(
        eq(crewMembers.crewId, crewId),
        eq(crewMembers.memberId, fromId),
        eq(crewMembers.role, "owner"),
      ),
    )
    .returning({ id: crewMembers.memberId });
  if (!demoted.length) return "not_owner";
  const promoted = await db
    .update(crewMembers)
    .set({ role: "owner" })
    .where(and(eq(crewMembers.crewId, crewId), eq(crewMembers.memberId, toId)))
    .returning({ id: crewMembers.memberId });
  return promoted.length ? "moved" : "no_member";
}

/**
 * The crews this member owns that have someone else in them (they'd be left ownerless).
 * Locks the member's memberships, so a concurrent hand-over or join can't slip in.
 */
export async function ownedCrewsWithOthers(db: Db, memberId: string): Promise<string[]> {
  const rows = await db
    .select({ crewId: crewMembers.crewId })
    .from(crewMembers)
    .where(
      and(
        eq(crewMembers.memberId, memberId),
        eq(crewMembers.role, "owner"),
        // The inner table is aliased, so ${crewMembers.crewId} is the outer row.
        sql`exists (select 1 from ${crewMembers} m where m.crew_id = ${crewMembers.crewId} and m.member_id <> ${memberId})`,
      ),
    )
    .for("update");
  return rows.map((r) => r.crewId);
}

export async function insertCrew(
  db: Db,
  values: { name: string; homeCity: CityKey; inviteCode: string },
) {
  const [row] = await db.insert(crews).values(values).returning({ id: crews.id });
  return row!;
}

export { FIRST_CREW_ID };
