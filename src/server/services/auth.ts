import "server-only";
import { nameKey } from "@/domain/names";
import type { Db } from "../db/client";
import { AppError, isUniqueViolation } from "../errors";
import { decoyHash, hashPassword, verifyPassword } from "../auth/passwords";
import { hashToken, newToken } from "../auth/tokens";
import * as repo from "../repos/members";

export type Member = repo.MemberRow;
export interface Session {
  member: Member;
  deviceId: string;
}

const LINK_TTL_MS = { pair: 15 * 60 * 1000, recover: 24 * 60 * 60 * 1000 } as const;
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

/**
 * Sign up with a username and password. The first person to sign up becomes the owner.
 * `name` must already be normalized (see domain/schemas).
 */
export async function signUp(
  db: Db,
  input: { name: string; password: string },
): Promise<{ member: Member; token: string }> {
  const values = {
    name: input.name,
    nameKey: nameKey(input.name),
    passwordHash: await hashPassword(input.password),
  };
  let member: Member;
  try {
    const isOwner = (await repo.countMembers(db)) === 0;
    member = await repo.insertMember(db, { ...values, isOwner }).catch((e: unknown) => {
      // Two people raced to be first: the loser signs up as a regular member.
      if (isOwner && isUniqueViolation(e, "members_one_owner")) {
        return repo.insertMember(db, { ...values, isOwner: false });
      }
      throw e;
    });
  } catch (e) {
    if (isUniqueViolation(e, "members_name_key_unique")) throw new AppError("conflict", NAME_TAKEN);
    throw e;
  }
  return { member, token: await startDevice(db, member.id) };
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
): Promise<Session | null> {
  if (!token) return null;
  const found = await repo.findDeviceWithMember(db, hashToken(token));
  if (!found) return null;
  await repo.touchDevice(db, found.device.id, now, TOUCH_EVERY_MS);
  return { member: found.member, deviceId: found.device.id };
}

/** Owner only: a one-time link for a member who lost every phone. */
export async function createRecoveryLink(
  db: Db,
  session: Session,
  memberId: string,
  now: Date,
): Promise<string> {
  if (!session.member.isOwner) throw new AppError("forbidden", "Only the crew owner can do that.");
  if (!(await repo.findMember(db, memberId))) throw new AppError("not_found", "No such member.");
  return issueLink(db, memberId, "recover", now);
}

async function issueLink(db: Db, memberId: string, purpose: repo.LinkPurpose, now: Date) {
  await repo.deleteDeadLinks(db, now);
  const token = newToken();
  await repo.insertLink(db, {
    memberId,
    tokenHash: hashToken(token),
    purpose,
    expiresAt: new Date(now.getTime() + LINK_TTL_MS[purpose]),
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
  if (link.purpose === "recover") await repo.clearPassword(db, member.id);
  return {
    member: { ...member, hasPassword: link.purpose === "recover" ? false : member.hasPassword },
    token: await startDevice(db, member.id),
  };
}

/**
 * Who a one-time link signs in as, without using it up (so the page can say "Sign in as Dana").
 * Anyone holding a live link could redeem it anyway, so this reveals nothing new.
 */
export async function peekLink(
  db: Db,
  token: string,
  now: Date,
): Promise<{ name: string; purpose: repo.LinkPurpose } | null> {
  const link = await repo.findLiveLink(db, hashToken(token), now);
  const member = link && (await repo.findMember(db, link.memberId));
  return member && link ? { name: member.name, purpose: link.purpose as repo.LinkPurpose } : null;
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
