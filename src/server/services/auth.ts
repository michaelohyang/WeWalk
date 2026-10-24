import "server-only";
import { codeMatches, signupCode } from "../invite";
import { nameKey } from "@/domain/names";
import type { Db } from "../db/client";
import { AppError, isUniqueViolation } from "../errors";
import { decoyHash, hashPassword, verifyPassword } from "../auth/passwords";
import { hashToken, newToken } from "../auth/tokens";
import * as crewsRepo from "../repos/crews";
import { FIRST_CREW_ID, type CrewRef } from "../repos/crews";
import * as repo from "../repos/members";

export type Member = repo.MemberRow;
export type { CrewRef };
export interface Session {
  member: Member;
  deviceId: string;
  /** The crew this request is for: the phone's pick (cookie), or the crew a queued write names. */
  crew: CrewRef;
  /** Every crew the member is in, oldest membership first. */
  crews: CrewRef[];
}

const LINK_TTL_MS = 24 * 60 * 60 * 1000;
const TOUCH_EVERY_MS = 60 * 60 * 1000;
/** Wrong passwords in a row before the account locks, and for how long. */
export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

const NAME_TAKEN = "Someone already goes by that. Add an initial?";
const BAD_LOGIN = "Wrong username or password.";

/** A new phone session for `memberId`. Returns the raw token for the cookie. */
async function startDevice(db: Db, memberId: string): Promise<string> {
  const token = newToken();
  await repo.insertDevice(db, memberId, hashToken(token));
  return token;
}

const NEEDS_INVITE = "You need an invite link from someone in the crew to join.";
const DEAD_INVITE = "That invite link doesn't work any more. Ask for a new one.";

/**
 * Which crew a sign-up joins: the one whose invite code it carries (/join/<code>), else the first
 * crew, which SIGNUP_CODE (when set) guards, as before crews.
 */
async function crewForSignup(
  db: Db,
  code: string | undefined,
  signupGate: string | null,
): Promise<string> {
  const crew = code ? await crewsRepo.findCrewByInviteCode(db, code.trim()) : undefined;
  if (crew) return crew.id;
  if (signupGate && codeMatches(code, signupGate)) return FIRST_CREW_ID;
  // A code that names no crew is a dead invite link: say so rather than drop them somewhere.
  if (code?.trim()) throw new AppError("forbidden", DEAD_INVITE);
  if (signupGate && (await repo.countMembers(db)) > 0)
    throw new AppError("forbidden", NEEDS_INVITE);
  return FIRST_CREW_ID;
}

/**
 * Sign up with a username and password, joining a crew (see crewForSignup). Someone joining an
 * empty crew becomes its owner; the very first person ever is also the app admin.
 * `name` must already be normalized (see domain/schemas).
 */
export async function signUp(
  db: Db,
  input: { name: string; password: string; code?: string },
  signupGate: string | null = signupCode(),
): Promise<{ member: Member; token: string; crewId: string }> {
  const crewId = await crewForSignup(db, input.code, signupGate);
  const values = {
    name: input.name,
    nameKey: nameKey(input.name),
    passwordHash: await hashPassword(input.password),
    isAdmin: (await repo.countMembers(db)) === 0,
  };
  // The account and its membership together: nobody is ever left without a crew.
  const member = await db
    .transaction(async (tx) => {
      const created = await repo.insertMember(tx, values);
      const empty = (await crewsRepo.countCrewMembers(tx, crewId)) === 0;
      try {
        await tx.transaction((inner) =>
          crewsRepo.addCrewMember(inner, crewId, created.id, empty ? "owner" : "member"),
        );
      } catch (e) {
        // Two people raced into an empty crew: the loser joins as a member.
        if (!empty || !isUniqueViolation(e, "crew_members_one_owner")) throw e;
        await crewsRepo.addCrewMember(tx, crewId, created.id, "member");
      }
      return created;
    })
    .catch((e: unknown) => {
      if (isUniqueViolation(e, "members_name_key_unique"))
        throw new AppError("conflict", NAME_TAKEN);
      throw e;
    });
  return { member, token: await startDevice(db, member.id), crewId };
}

/**
 * Log in with a username and password. Every failure says the same thing and takes about as
 * long, so the response never reveals whether a username exists. After MAX_FAILED_LOGINS wrong
 * passwords in a row the account locks for LOCKOUT_MS.
 */
export async function logIn(
  db: Db,
  input: { name: string; password: string },
  now: Date,
): Promise<{ member: Member; token: string }> {
  const found = await repo.findCredentials(db, nameKey(input.name));
  if (!found?.passwordHash) {
    await verifyPassword(input.password, await decoyHash());
    throw new AppError("unauthorized", BAD_LOGIN);
  }
  if (found.lockedUntil && found.lockedUntil > now) {
    throw new AppError(
      "unauthorized",
      "Too many wrong passwords. Try again in 15 minutes, or ask the crew owner for a recovery link.",
    );
  }
  // A lock that has run out starts a fresh count; otherwise one typo would lock it again.
  if (found.lockedUntil) await repo.clearFailedLogins(db, found.id);
  if (!(await verifyPassword(input.password, found.passwordHash))) {
    await repo.recordFailedLogin(db, found.id, now, MAX_FAILED_LOGINS, LOCKOUT_MS);
    throw new AppError("unauthorized", BAD_LOGIN);
  }
  if (found.failedLogins) await repo.clearFailedLogins(db, found.id);
  const member = (await repo.findMember(db, found.id))!;
  return { member, token: await startDevice(db, member.id) };
}

/**
 * Set or change your password. Changing it needs the current one. People who joined before
 * passwords existed, or came back through a recovery link, have none and just set one.
 */
export async function setPassword(
  db: Db,
  session: Session,
  input: { current?: string; password: string },
): Promise<void> {
  const stored = await repo.findPasswordHash(db, session.member.id);
  if (stored) {
    if (!input.current || !(await verifyPassword(input.current, stored))) {
      const message = "That's not your current password.";
      throw new AppError("invalid", message, { fields: { current: [message] } });
    }
  }
  await repo.setPasswordHash(db, session.member.id, await hashPassword(input.password));
}

/** The session for a cookie token, or null. */
export async function authenticate(
  db: Db,
  token: string | undefined,
  now: Date,
  preferredCrewId?: string,
): Promise<Session | null> {
  if (!token) return null;
  const found = await repo.findDeviceWithMember(db, hashToken(token));
  if (!found) return null;
  await repo.touchDevice(db, found.device.id, now, TOUCH_EVERY_MS);
  let crews = await crewsRepo.listMemberCrews(db, found.member.id);
  if (!crews.length) {
    // Sign-up and the migration put everyone in a crew. Only someone who signed up through
    // older code mid-deploy (which knew one crew: the first) can arrive without one.
    await crewsRepo.addCrewMember(db, FIRST_CREW_ID, found.member.id);
    crews = await crewsRepo.listMemberCrews(db, found.member.id);
  }
  const crew = crews.find((c) => c.id === preferredCrewId) ?? crews[0]!;
  return { member: found.member, deviceId: found.device.id, crew, crews };
}

/** Whether you own the crew this request is for. */
export const ownsCrew = (session: Session): boolean => session.crew.role === "owner";

/**
 * App-wide admin: the building list at /admin/stations and recovery links. Not a crew role: a
 * crew owner could otherwise take over a member's account through a recovery link.
 */
export const isAdmin = (session: Session): boolean => session.member.isAdmin;

/** Admin only: a one-time link for a member who lost every phone. */
export async function createRecoveryLink(
  db: Db,
  session: Session,
  memberId: string,
  now: Date,
): Promise<string> {
  if (!isAdmin(session)) throw new AppError("forbidden", "Only the app admin can do that.");
  if (!(await repo.findMember(db, memberId))) throw new AppError("not_found", "No such member.");
  return issueRecoveryLink(db, memberId, now);
}

async function issueRecoveryLink(db: Db, memberId: string, now: Date) {
  await repo.deleteDeadLinks(db, now);
  const token = newToken();
  await repo.insertLink(db, {
    memberId,
    tokenHash: hashToken(token),
    expiresAt: new Date(now.getTime() + LINK_TTL_MS),
  });
  return token;
}

/** Uses a one-time link: starts a phone session for its member. */
export async function redeemLink(
  db: Db,
  token: string,
  now: Date,
): Promise<{ member: Member; token: string }> {
  const link = await repo.consumeLink(db, hashToken(token), now);
  const member = link && (await repo.findMember(db, link.memberId));
  if (!member) {
    throw new AppError("gone", "That link expired or was already used. Ask for a new one.");
  }
  // A recovery link is for a forgotten password: clear it, so the person picks a new one.
  await repo.clearPassword(db, member.id);
  return {
    member: { ...member, hasPassword: false },
    token: await startDevice(db, member.id),
  };
}

/**
 * Who a one-time link signs in as, without using it up (so the page can say "Sign in as Dana").
 * Anyone holding a live link could redeem it anyway, so this reveals nothing new.
 */
export async function peekLink(db: Db, token: string, now: Date): Promise<{ name: string } | null> {
  const link = await repo.findLiveLink(db, hashToken(token), now);
  const member = link && (await repo.findMember(db, link.memberId));
  return member && link ? { name: member.name } : null;
}

export async function listDevices(db: Db, session: Session) {
  const rows = await repo.listDevices(db, session.member.id);
  // This phone first, then the rest oldest first.
  return rows
    .map((d) => ({ ...d, current: d.id === session.deviceId }))
    .sort((a, b) => Number(b.current) - Number(a.current));
}

export async function signOutDevice(db: Db, session: Session, deviceId: string): Promise<void> {
  if (!(await repo.deleteDevice(db, session.member.id, deviceId))) {
    throw new AppError("not_found", "That phone isn't signed in.");
  }
}

/** `name` must already be normalized (see domain/schemas). */
export async function rename(db: Db, session: Session, name: string): Promise<Member> {
  try {
    const renamed = await repo.renameMember(db, session.member.id, name, nameKey(name));
    if (!renamed) throw new AppError("unauthorized", "You're signed out.");
    return renamed;
  } catch (e) {
    if (isUniqueViolation(e, "members_name_key_unique")) throw new AppError("conflict", NAME_TAKEN);
    throw e;
  }
}
