import "server-only";
import { randomBytes } from "node:crypto";
import type { CityKey } from "@/domain/areas";
import type { Db } from "../db/client";
import { AppError, isUniqueViolation } from "../errors";
import * as crewsRepo from "../repos/crews";
import { isBanned } from "../repos/moderation";
import { crewOf, ownsCrew, type Session } from "./auth";

const BAD_INVITE = "That invite link doesn't work any more. Ask for a new one.";
const BANNED = "The crew's owner removed you, so you can't rejoin it.";
const NO_CREW = "That crew isn't around any more.";

export interface CrewListing {
  id: string;
  name: string;
  homeCity: CityKey;
  members: number;
  /** You're in it already. */
  joined: boolean;
}

/**
 * The crews you can join, for the welcome steps and Find a crew: the city you picked first, then
 * the biggest. Crews you were removed from aren't listed.
 */
export async function crewDirectory(
  db: Db,
  session: Session,
  city: CityKey,
  max?: number,
): Promise<CrewListing[]> {
  return (await crewsRepo.listCrewDirectory(db, session.member.id, city, max)) as CrewListing[];
}

/** The crew an invite code names (for the join page), or null. */
export async function crewForInvite(db: Db, code: string) {
  return (await crewsRepo.findCrewByInviteCode(db, code.trim())) ?? null;
}

/** Join the crew an invite code names. Joining one you're already in just switches to it. */
export async function joinCrew(
  db: Db,
  session: Session,
  code: string,
): Promise<{ id: string; name: string }> {
  const crew = await crewsRepo.findCrewByInviteCode(db, code.trim());
  if (!crew) throw new AppError("not_found", BAD_INVITE);
  return join(db, session, crew);
}

/** Join a crew picked from the directory. Crews are open: anyone can join, unless removed from it. */
export async function joinCrewById(
  db: Db,
  session: Session,
  crewId: string,
): Promise<{ id: string; name: string }> {
  const crew = await crewsRepo.findCrew(db, crewId);
  if (!crew) throw new AppError("not_found", NO_CREW);
  return join(db, session, crew);
}

async function join(db: Db, session: Session, crew: { id: string; name: string }) {
  await db.transaction(async (tx) => {
    // Under the crew's lock, so a removal can't land between the ban check and the join.
    await crewsRepo.lockCrew(tx, crew.id, "share");
    if (await isBanned(tx, crew.id, session.member.id)) throw new AppError("forbidden", BANNED);
    await crewsRepo.addCrewMember(tx, crew.id, session.member.id);
  });
  return crew;
}

/**
 * New crews wait for CREWS_ENABLED=1, so a rollback never meets a second crew (older code would
 * show its posts to everyone). Turn it on once crews have been live for a deploy.
 */
export const crewCreationEnabled = () => process.env.CREWS_ENABLED === "1";

/** A fresh invite code: 12 url-safe characters, too many to guess. */
const newInviteCode = () => randomBytes(9).toString("base64url");

/** Start a crew: you're its owner, and the phone switches to it. */
export async function createCrew(
  db: Db,
  session: Session,
  input: { name: string; homeCity: CityKey },
): Promise<{ id: string; name: string; inviteCode: string }> {
  if (!crewCreationEnabled()) throw new AppError("unavailable", "New crews aren't open yet.");
  const inviteCode = newInviteCode();
  const crew = await db.transaction(async (tx) => {
    const created = await crewsRepo.insertCrew(tx, { ...input, inviteCode });
    await crewsRepo.addCrewMember(tx, created.id, session.member.id, "owner");
    return created;
  });
  return { id: crew.id, name: input.name, inviteCode };
}

const OWNER_STAYS = "You run this crew. Hand it over to someone first, so it keeps an owner.";
const OWNER_ONLY = "Only the crew owner can do that.";

/**
 * Leave the crew you're looking at: your posts and reactions come out of it (they stay in your
 * other crews). The owner hands it over first, unless they're the last one in it; a crew left
 * empty is deleted (the first crew always stays). With no crews left you go to /welcome.
 */
export async function leaveCrew(db: Db, session: Session): Promise<void> {
  const crew = crewOf(session);
  await db.transaction(async (tx) => {
    await crewsRepo.lockMembershipsOf(tx, session.member.id);
    // Roles read under the lock, not from the session (a hand-over may have just landed).
    if ((await crewsRepo.ownedCrewsWithOthers(tx, session.member.id)).includes(crew.id)) {
      throw new AppError("conflict", OWNER_STAYS);
    }
    await crewsRepo.unlinkMemberFromCrew(tx, crew.id, session.member.id);
    await crewsRepo.removeCrewMember(tx, crew.id, session.member.id);
    if (crew.id !== crewsRepo.FIRST_CREW_ID) await crewsRepo.deleteEmptyCrews(tx, [crew.id]);
  });
}

/** Owner: rename the crew. */
export async function renameCrew(db: Db, session: Session, name: string): Promise<void> {
  if (!ownsCrew(session)) throw new AppError("forbidden", OWNER_ONLY);
  await crewsRepo.renameCrew(db, crewOf(session).id, name);
}

/** Owner: a new invite link. The old one stops working. */
export async function rotateInviteCode(db: Db, session: Session): Promise<string> {
  if (!ownsCrew(session)) throw new AppError("forbidden", OWNER_ONLY);
  // 72 random bits: a clash is next to impossible, but one would just mean drawing again.
  for (let attempt = 0; ; attempt++) {
    const code = newInviteCode();
    try {
      await crewsRepo.setInviteCode(db, crewOf(session).id, code);
      return code;
    } catch (e) {
      if (attempt > 0 || !isUniqueViolation(e, "crews_invite_code_unique")) throw e;
    }
  }
}
