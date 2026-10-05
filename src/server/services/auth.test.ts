import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../db/client";
import { createTestDb, resetTestDb } from "../db/testing";
import { AppError } from "../errors";
import {
  authenticate,
  createPairLink,
  createRecoveryLink,
  joinCrew,
  listDevices,
  redeemLink,
  rename,
  signOutDevice,
} from "./auth";
import { CREW_CODE, NOW, signIn } from "./testing";

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

describe("joinCrew", () => {
  it("needs the right invite code, and an invite code to be configured", async () => {
    expect(await code(joinCrew(db, { code: "wrong", name: "Dana" }, CREW_CODE))).toBe(
      "unauthorized",
    );
    expect(await code(joinCrew(db, { code: "", name: "Dana" }, undefined))).toBe("unauthorized");
    expect(await code(joinCrew(db, { code: "x", name: "Dana" }, ""))).toBe("unauthorized");
    // A short, guessable code is treated as not configured, even when it matches.
    expect(await code(joinCrew(db, { code: "short", name: "Dana" }, "short"))).toBe("unauthorized");
  });

  it("makes the first member the owner, nobody after", async () => {
    const a = await signIn(db, "Dana");
    const b = await signIn(db, "Sal");
    expect(a.member.isOwner).toBe(true);
    expect(b.member.isOwner).toBe(false);
  });

  it("refuses a name that differs only by case", async () => {
    await signIn(db, "Dana");
    expect(await code(joinCrew(db, { code: CREW_CODE, name: "DANA" }, CREW_CODE))).toBe("conflict");
  });

  it("gives exactly one owner when people join at the same time", async () => {
    const sessions = await Promise.all(["A", "B", "C"].map((name) => signIn(db, name)));
    expect(sessions.filter((x) => x.member.isOwner)).toHaveLength(1);
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

describe("pairing links", () => {
  it("signs in a second phone as the same person, once", async () => {
    const me = await signIn(db, "Dana");
    const link = await createPairLink(db, me, NOW);
    const second = await redeemLink(db, link, minutes(1));
    expect(second.member.id).toBe(me.member.id);
    expect((await authenticate(db, second.token, NOW))?.member.id).toBe(me.member.id);
    expect(await code(redeemLink(db, link, minutes(2)))).toBe("gone");
  });

  it("expires after 15 minutes", async () => {
    const me = await signIn(db, "Dana");
    const link = await createPairLink(db, me, NOW);
    expect(await code(redeemLink(db, link, minutes(15)))).toBe("gone");
  });

  it("can only be redeemed once even when two phones race", async () => {
    const me = await signIn(db, "Dana");
    const link = await createPairLink(db, me, NOW);
    const results = await Promise.all([1, 2, 3].map(() => code(redeemLink(db, link, minutes(1)))));
    expect(results.sort()).toEqual(["gone", "gone", "ok"]);
  });

  it("rejects made-up tokens", async () => {
    expect(await code(redeemLink(db, "made-up", NOW))).toBe("gone");
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
  });
});

describe("devices", () => {
  it("lists my phones and signs one out", async () => {
    const me = await signIn(db, "Dana");
    const other = await redeemLink(db, await createPairLink(db, me, NOW), NOW);
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
