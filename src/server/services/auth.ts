import "server-only";
import { nameKey } from "@/domain/names";
import type { Db } from "../db/client";
import { AppError, isUniqueViolation } from "../errors";
import { hashToken, newToken, safeEqual } from "../auth/tokens";
import * as repo from "../repos/members";

export type Member = repo.MemberRow;
export interface Session {
  member: Member;
  deviceId: string;
}

const LINK_TTL_MS = { pair: 15 * 60 * 1000, recover: 24 * 60 * 60 * 1000 } as const;
const TOUCH_EVERY_MS = 60 * 60 * 1000;
/** The invite code is the only thing between the internet and the crew; keep it unguessable. */
export const MIN_CREW_CODE_LENGTH = 16;

const NAME_TAKEN = "Someone in the crew already goes by that. Add an initial?";

/** Whether `code` is this crew's invite code (and joining is switched on). */
export function isInviteCode(code: string, crewCode: string | undefined): boolean {
  return !!crewCode && crewCode.length >= MIN_CREW_CODE_LENGTH && safeEqual(code, crewCode);
}

/** A new phone session for `memberId`. Returns the raw token for the cookie. */
async function startDevice(db: Db, memberId: string): Promise<string> {
  const token = newToken();
  await repo.insertDevice(db, memberId, hashToken(token));
  return token;
}

/**
 * Join the crew from the invite link. The first person to join becomes the owner.
 * `name` must already be normalized (see domain/schemas).
 */
export async function joinCrew(
  db: Db,
  input: { code: string; name: string },
  crewCode: string | undefined,
): Promise<{ member: Member; token: string }> {
  if (!crewCode || crewCode.length < MIN_CREW_CODE_LENGTH) {
    // Misconfigured deploy: refuse rather than accept a guessable code.
    console.error(`CREW_CODE must be set and at least ${MIN_CREW_CODE_LENGTH} characters.`);
    throw new AppError(
      "unauthorized",
      "Joining is switched off right now. Ask whoever runs WeWalk.",
    );
  }
  if (!safeEqual(input.code, crewCode)) {
    throw new AppError(
      "unauthorized",
      "That invite link doesn't work. Ask the crew for a fresh one.",
    );
  }

  const values = { name: input.name, nameKey: nameKey(input.name) };
  let member: Member;
  try {
    const isOwner = (await repo.countMembers(db)) === 0;
    member = await repo.insertMember(db, { ...values, isOwner }).catch((e: unknown) => {
      // Two people raced to be first: the loser joins as a regular member.
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

/** A one-time link to sign in a new phone as yourself. Returns the raw token for the URL. */
export async function createPairLink(db: Db, session: Session, now: Date): Promise<string> {
  return issueLink(db, session.member.id, "pair", now);
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
    throw new AppError("gone", "That link expired or was already used. Make a new one from Crew.");
  }
  return { member, token: await startDevice(db, member.id) };
}

export async function listDevices(db: Db, session: Session) {
  const rows = await repo.listDevices(db, session.member.id);
  return rows.map((d) => ({ ...d, current: d.id === session.deviceId }));
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
