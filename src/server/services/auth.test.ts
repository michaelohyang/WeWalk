import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../db/client";
import { createTestDb, resetTestDb } from "../db/testing";
import { AppError } from "../errors";
import { members } from "../db/schema";
import {
  authenticate,
  createRecoveryLink,
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
import { NOW, PASSWORD, signIn } from "./testing";

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
    expect(a.member.isOwner).toBe(true);
    expect(b.member.isOwner).toBe(false);
  });

  it("refuses a name that differs only by case", async () => {
    await signIn(db, "Dana");
    expect(await code(signUp(db, { name: "DANA", password: PASSWORD }))).toBe("conflict");
  });

  it("gives exactly one owner when people sign up at the same time", async () => {
    const sessions = await Promise.all(["A", "B", "C"].map((name) => signIn(db, name)));
    expect(sessions.filter((x) => x.member.isOwner)).toHaveLength(1);
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
