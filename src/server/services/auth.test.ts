import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../db/client";
import { createTestDb, resetTestDb } from "../db/testing";
import { AppError } from "../errors";
import { FIRST_CREW_ID, members } from "../db/schema";
import {
  authenticate,
  createRecoveryLink,
  finishOnboarding,
  listDevices,
  LOCKOUT_MS,
  logIn,
  MAX_FAILED_LOGINS,
  redeemLink,
  rename,
  setPassword,
  signOutDevice,
  signUp,
} from "./auth";
import { firstCrewInvite, NOW, PASSWORD, signIn } from "./testing";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});
beforeEach(() => resetTestDb(db));

const code = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => (e instanceof AppError ? e.code : `unexpected: ${String(e)}`),
  );
const minutes = (m: number) => new Date(NOW.getTime() + m * 60_000);

describe("signUp", () => {
  it("makes the first member the owner, nobody after", async () => {
    const a = await signIn(db, "Dana");
    const b = await signIn(db, "Sal");
    expect(a.crew!.role).toBe("owner");
    expect(b.crew!.role).toBe("member");
    expect([a.member.isAdmin, b.member.isAdmin]).toEqual([true, false]);
  });

  it("refuses a name that differs only by case", async () => {
    await signIn(db, "Dana");
    expect(await code(signUp(db, { name: "DANA", password: PASSWORD }))).toBe("conflict");
  });

  it("gives exactly one owner when people sign up at the same time", async () => {
    const sessions = await Promise.all(["A", "B", "C"].map((name) => signIn(db, name)));
    expect(sessions.filter((x) => x.crew?.role === "owner")).toHaveLength(1);
  });

  it("stores only a hash of the password, and never hands it to the app", async () => {
    const me = await signIn(db, "Dana");
    const [row] = await db.select({ hash: members.passwordHash }).from(members);
    expect(row!.hash).toMatch(/^scrypt\$/);
    expect(row!.hash).not.toContain(PASSWORD);
    expect(me.member).not.toHaveProperty("passwordHash");
    expect(me.member.hasPassword).toBe(true);
  });
});

describe("logIn", () => {
  it("logs in with the right password, in any letter case for the name", async () => {
    const me = await signIn(db, "Dana");
    const again = await logIn(db, { name: "dana", password: PASSWORD }, NOW);
    expect(again.member.id).toBe(me.member.id);
    expect((await authenticate(db, again.token, NOW))?.member.id).toBe(me.member.id);
  });

  it("says the same thing for a wrong password and an unknown name", async () => {
    await signIn(db, "Dana");
    const wrong = await logIn(db, { name: "Dana", password: "nope" }, NOW).catch((e) => e);
    const nobody = await logIn(db, { name: "Nobody", password: "nope" }, NOW).catch((e) => e);
    expect(wrong).toBeInstanceOf(AppError);
    expect([wrong.code, wrong.message]).toEqual([nobody.code, nobody.message]);
  });

  it("locks the account after too many wrong passwords, then lets it try again", async () => {
    await signIn(db, "Dana");
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) {
      await code(logIn(db, { name: "Dana", password: "nope" }, NOW));
    }
    // Locked: even the right password is refused for now.
    const locked = await logIn(db, { name: "Dana", password: PASSWORD }, NOW).catch((e) => e);
    expect(locked.message).toMatch(/Too many wrong passwords/);
    const later = new Date(NOW.getTime() + LOCKOUT_MS + 1);
    expect(await code(logIn(db, { name: "Dana", password: PASSWORD }, later))).toBe("ok");
  });

  it("starts counting again after a lock expires, instead of re-locking on one mistake", async () => {
    await signIn(db, "Dana");
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) {
      await code(logIn(db, { name: "Dana", password: "nope" }, NOW));
    }
    const later = new Date(NOW.getTime() + LOCKOUT_MS + 1);
    // One typo after the lock ends is just one wrong password...
    expect(await code(logIn(db, { name: "Dana", password: "nope" }, later))).toBe("unauthorized");
    // ...so the right password still works.
    const soon = new Date(later.getTime() + 1000);
    expect(await code(logIn(db, { name: "Dana", password: PASSWORD }, soon))).toBe("ok");
  });

  it("can't log in to an account that has no password yet", async () => {
    const me = await signIn(db, "Dana");
    await db.update(members).set({ passwordHash: null });
    expect(await code(logIn(db, { name: "Dana", password: PASSWORD }, NOW))).toBe("unauthorized");
    expect(me.member.id).toBeTruthy();
  });
});

describe("setPassword", () => {
  it("changing it needs the current password", async () => {
    const me = await signIn(db, "Dana");
    expect(await code(setPassword(db, me, { password: "a new password" }))).toBe("invalid");
    expect(await code(setPassword(db, me, { current: "nope", password: "a new password" }))).toBe(
      "invalid",
    );
    await setPassword(db, me, { current: PASSWORD, password: "a new password" });
    expect(await code(logIn(db, { name: "Dana", password: PASSWORD }, NOW))).toBe("unauthorized");
    expect(await code(logIn(db, { name: "Dana", password: "a new password" }, NOW))).toBe("ok");
  });

  it("people without one just set one", async () => {
    const me = await signIn(db, "Dana");
    await db.update(members).set({ passwordHash: null });
    await setPassword(db, me, { password: "first password" });
    expect(await code(logIn(db, { name: "Dana", password: "first password" }, NOW))).toBe("ok");
  });
});

describe("authenticate", () => {
  it("finds the session for a cookie token, and nothing for junk", async () => {
    const me = await signIn(db, "Dana");
    expect((await authenticate(db, me.token, NOW))?.member.name).toBe("Dana");
    expect(await authenticate(db, "not-a-token", NOW)).toBeNull();
    expect(await authenticate(db, undefined, NOW)).toBeNull();
  });
});

describe("recovery links", () => {
  it("only the owner can make one, for an existing member, and it lasts 24 hours", async () => {
    const owner = await signIn(db, "Owner");
    const dana = await signIn(db, "Dana");
    expect(await code(createRecoveryLink(db, dana, owner.member.id, NOW))).toBe("forbidden");
    expect(
      await code(createRecoveryLink(db, owner, "00000000-0000-4000-8000-000000000000", NOW)),
    ).toBe("not_found");

    const link = await createRecoveryLink(db, owner, dana.member.id, NOW);
    const restored = await redeemLink(db, link, minutes(23 * 60));
    expect(restored.member.id).toBe(dana.member.id);
    // It clears the forgotten password, so they pick a new one (without knowing the old one).
    expect(restored.member.hasPassword).toBe(false);
    expect(await code(logIn(db, { name: "Dana", password: PASSWORD }, NOW))).toBe("unauthorized");
    await setPassword(db, dana, { password: "brand new one" });
    expect(await code(logIn(db, { name: "Dana", password: "brand new one" }, NOW))).toBe("ok");
  });

  it("works once, even when two phones race, and expires after 24 hours", async () => {
    const owner = await signIn(db, "Owner");
    const dana = await signIn(db, "Dana");
    const link = await createRecoveryLink(db, owner, dana.member.id, NOW);
    const results = await Promise.all([1, 2, 3].map(() => code(redeemLink(db, link, minutes(1)))));
    expect(results.sort()).toEqual(["gone", "gone", "ok"]);
    const late = await createRecoveryLink(db, owner, dana.member.id, NOW);
    expect(await code(redeemLink(db, late, minutes(24 * 60)))).toBe("gone");
    expect(await code(redeemLink(db, "made-up", NOW))).toBe("gone");
  });
});

describe("devices", () => {
  it("lists my phones and signs one out", async () => {
    const me = await signIn(db, "Dana");
    const other = await logIn(db, { name: "Dana", password: PASSWORD }, NOW);
    const devices = await listDevices(db, me);
    expect(devices).toHaveLength(2);
    expect(devices.filter((d) => d.current)).toHaveLength(1);

    const otherId = devices.find((d) => !d.current)!.id;
    await signOutDevice(db, me, otherId);
    expect(await authenticate(db, other.token, NOW)).toBeNull();
    expect(await authenticate(db, me.token, NOW)).not.toBeNull();
  });

  it("can't sign out someone else's phone", async () => {
    const me = await signIn(db, "Dana");
    const sal = await signIn(db, "Sal");
    expect(await code(signOutDevice(db, me, sal.deviceId))).toBe("not_found");
    expect(await authenticate(db, sal.token, NOW)).not.toBeNull();
  });
});

describe("rename", () => {
  it("renames, but not onto someone else's name", async () => {
    const me = await signIn(db, "Dana");
    await signIn(db, "Sal");
    expect((await rename(db, me, "Dana K")).name).toBe("Dana K");
    expect(await code(rename(db, me, "sal"))).toBe("conflict");
    expect((await rename(db, me, "DANA K")).name).toBe("DANA K");
  });
});

describe("signUp with an invite code", () => {
  const join = (name: string, code: string | undefined, invite: string | null) =>
    code_(signUp(db, { name, password: PASSWORD, code }, invite));
  const code_ = code;

  it("lets the first person in without one, so the owner can set up the crew", async () => {
    expect(await join("Owner", undefined, "sesame")).toBe("ok");
  });

  it("is open to anyone when no code is set", async () => {
    await join("Owner", undefined, null);
    expect(await join("Sam", undefined, null)).toBe("ok");
  });

  it("refuses a missing or wrong code once the crew exists", async () => {
    await join("Owner", undefined, "sesame");
    expect(await join("Sam", undefined, "sesame")).toBe("forbidden");
    expect(await join("Sam", "open up", "sesame")).toBe("forbidden");
    expect(await join("Sam", "sesame", "sesame")).toBe("ok");
  });
});

describe("signUp without an invite, and the welcome steps", () => {
  const signUpAs = async (name: string, code?: string, gate: string | null = null) => {
    const { token, crewId } = await signUp(db, { name, password: PASSWORD, code }, gate);
    return { crewId, session: (await authenticate(db, token, NOW))! };
  };

  it("puts the very first person in the first crew, and nobody after", async () => {
    const first = await signUpAs("Dana");
    expect(first.crewId).toBe(FIRST_CREW_ID);
    const next = await signUpAs("Sam");
    expect(next.crewId).toBeNull();
    expect(next.session.crew).toBeNull();
    expect(next.session.crews).toEqual([]);
  });

  it("starts everyone, invited or not, with the welcome steps", async () => {
    const dana = await signUpAs("Dana");
    const invited = await signUpAs("Sam", await firstCrewInvite(db));
    expect(invited.session.crew?.id).toBe(FIRST_CREW_ID);
    expect([dana.session.member.onboardedAt, invited.session.member.onboardedAt]).toEqual([
      null,
      null,
    ]);
  });

  it("marks the welcome steps done once; doing it again keeps the first time", async () => {
    const { session } = await signUpAs("Dana");
    await finishOnboarding(db, session, NOW);
    await finishOnboarding(db, session, minutes(5));
    const [row] = await db.select({ at: members.onboardedAt }).from(members);
    expect(row!.at).toEqual(NOW);
  });
});
