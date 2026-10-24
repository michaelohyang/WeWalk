import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { recordPhoto } from "../repos/photos";
import { count, eq } from "drizzle-orm";
import { checkinInputSchema, reviewInputSchema } from "@/domain/schemas";
import type { Db } from "../db/client";
import { checkins, devices, links, members, reactions, reviews } from "../db/schema";
import { createTestDb, resetTestDb } from "../db/testing";
import { AppError } from "../errors";
import { memoryPhoto, storePhoto } from "../photos";
import { clearPassword } from "../repos/members";
import { deleteAccount, exportData, handOverOwnership } from "./account";
import { authenticate, createRecoveryLink, logIn, MAX_FAILED_LOGINS, type Session } from "./auth";
import { react } from "./reactions";
import { NOW, PASSWORD, newId, signIn } from "./testing";
import { putCheckin, putReview } from "./visits";

let db: Db;
let dana: Session & { token: string }; // the owner (first to sign up)
let sal: Session & { token: string };
let kim: Session & { token: string };
beforeAll(async () => {
  db = await createTestDb();
});
beforeEach(async () => {
  await resetTestDb(db);
  dana = await signIn(db, "Dana");
  sal = await signIn(db, "Sal");
  kim = await signIn(db, "Kim");
});

const code = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => (e instanceof AppError ? e.code : `unexpected: ${String(e)}`),
  );
const reviewAt = (stationSlug: string, photoUrl: string | null = null) =>
  reviewInputSchema.parse({
    stationSlug,
    visitedOn: "2026-10-05",
    scores: { coffee: 4 },
    hotTake: "solid",
    tags: ["quiet floor"],
    photoUrl,
  });
const checkinAt = (stationSlug: string) =>
  checkinInputSchema.parse({ stationSlug, visitedOn: "2026-10-05", note: "here" });
const jpeg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const photoId = (url: string) => url.split("/").pop()!;

/** Each member reviews and checks in at their own station, and reacts to everyone else. */
async function busyCrew() {
  const photo = await storePhoto(jpeg());
  await recordPhoto(db, photo, sal.member.id); // as the upload route does
  const ids = { dana: newId(), sal: newId(), kim: newId() };
  await putReview(db, dana, ids.dana, reviewAt("dock-72"), NOW);
  await putReview(db, sal, ids.sal, reviewAt("18-w-18th-st", photo), NOW);
  await putReview(db, kim, ids.kim, reviewAt("33-irving-pl"), NOW);
  for (const [who, slug] of [
    [dana, "dock-72"],
    [sal, "18-w-18th-st"],
    [kim, "33-irving-pl"],
  ] as const) {
    await putCheckin(db, who, newId(), checkinAt(slug), NOW);
  }
  for (const [who, review] of [
    [dana, ids.sal],
    [dana, ids.kim],
    [sal, ids.dana],
    [sal, ids.kim],
    [kim, ids.dana],
    [kim, ids.sal],
  ] as const) {
    await react(db, who, review, "fire");
  }
  await logIn(db, { name: "Sal", password: PASSWORD }, NOW); // a second phone
  await createRecoveryLink(db, dana, sal.member.id, NOW);
  return { photo, ids };
}

const rowsOf = async (memberId: string) => {
  const n = async (table: typeof devices | typeof links | typeof reviews | typeof checkins) =>
    (await db.select({ n: count() }).from(table).where(eq(table.memberId, memberId)))[0]!.n;
  const given = await db
    .select({ n: count() })
    .from(reactions)
    .where(eq(reactions.memberId, memberId));
  return {
    devices: await n(devices),
    links: await n(links),
    reviews: await n(reviews),
    checkins: await n(checkins),
    reactionsGiven: given[0]!.n,
  };
};

describe("deleteAccount", () => {
  it("removes exactly the member's data, and leaves everyone else's", async () => {
    const { photo, ids } = await busyCrew();
    const danaBefore = await rowsOf(dana.member.id);
    const kimBefore = await rowsOf(kim.member.id);

    await deleteAccount(db, sal, { password: PASSWORD });

    expect(await db.select().from(members).where(eq(members.id, sal.member.id))).toEqual([]);
    expect(await rowsOf(sal.member.id)).toEqual({
      devices: 0,
      links: 0,
      reviews: 0,
      checkins: 0,
      reactionsGiven: 0,
    });
    // Nobody's reactions to Sal's review survive it.
    expect(await db.select().from(reactions).where(eq(reactions.reviewId, ids.sal))).toEqual([]);
    expect(memoryPhoto(photoId(photo))).toBeUndefined();
    expect(await authenticate(db, sal.token, NOW)).toBeNull();

    // Dana and Kim each lose only their reaction to Sal's review.
    expect(await rowsOf(dana.member.id)).toEqual({
      ...danaBefore,
      reactionsGiven: danaBefore.reactionsGiven - 1,
    });
    expect(await rowsOf(kim.member.id)).toEqual({
      ...kimBefore,
      reactionsGiven: kimBefore.reactionsGiven - 1,
    });
    expect(await db.select({ n: count() }).from(reactions)).toEqual([{ n: 2 }]); // Dana⇄Kim
    expect(await authenticate(db, dana.token, NOW)).not.toBeNull();
  });

  it("needs the right password, and deletes nothing without it", async () => {
    await busyCrew();
    const before = await rowsOf(sal.member.id);
    const wrong = await deleteAccount(db, sal, { password: "not it" }).catch((e: AppError) => e);
    expect(wrong).toMatchObject({
      code: "invalid",
      details: { fields: { password: [expect.any(String)] } },
    });
    expect(await rowsOf(sal.member.id)).toEqual(before);
  });

  it("counts wrong passwords toward the login lockout", async () => {
    await busyCrew();
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) {
      expect(await code(deleteAccount(db, sal, { password: "nope" }, NOW))).toBe("invalid");
    }
    // Locked: even the right password is refused, here and when logging in.
    expect(await code(deleteAccount(db, sal, { password: PASSWORD }, NOW))).toBe("invalid");
    expect(await code(logIn(db, { name: sal.member.name, password: PASSWORD }, NOW))).toBe(
      "unauthorized",
    );
    expect(await db.select().from(members).where(eq(members.id, sal.member.id))).toHaveLength(1);
  });

  it("asks a member without a password to set one first", async () => {
    await clearPassword(db, sal.member.id);
    expect(await code(deleteAccount(db, sal, { password: "" }))).toBe("invalid");
    expect(await db.select().from(members).where(eq(members.id, sal.member.id))).toHaveLength(1);
  });

  it("keeps the owner while anyone else is in the crew", async () => {
    const refused = await deleteAccount(db, dana, { password: PASSWORD }).catch((e: AppError) => e);
    expect(refused).toMatchObject({
      code: "conflict",
      message: expect.stringMatching(/Hand it over/),
    });
    expect(await db.select({ n: count() }).from(members)).toEqual([{ n: 3 }]);
  });

  it("lets the owner go once they're the last one here", async () => {
    await deleteAccount(db, sal, { password: PASSWORD });
    await deleteAccount(db, kim, { password: PASSWORD });
    await deleteAccount(db, dana, { password: PASSWORD });
    expect(await db.select({ n: count() }).from(members)).toEqual([{ n: 0 }]);
  });
});

describe("handOverOwnership", () => {
  it("moves the owner flag, after which the old owner may leave", async () => {
    await handOverOwnership(db, dana, sal.member.id);
    const owners = await db
      .select({ id: members.id })
      .from(members)
      .where(eq(members.isOwner, true));
    expect(owners).toEqual([{ id: sal.member.id }]);
    const formerOwner = (await authenticate(db, dana.token, NOW))!;
    expect(formerOwner.member.isOwner).toBe(false);
    await deleteAccount(db, formerOwner, { password: PASSWORD });
    expect(await db.select({ n: count() }).from(members)).toEqual([{ n: 2 }]);
  });

  it("is owner-only, and needs someone else who exists", async () => {
    expect(await code(handOverOwnership(db, sal, kim.member.id))).toBe("forbidden");
    expect(await code(handOverOwnership(db, dana, dana.member.id))).toBe("invalid");
    expect(await code(handOverOwnership(db, dana, newId()))).toBe("not_found");
    // A failed hand-over (say, to someone who just deleted their account) keeps the owner.
    const owners = await db
      .select({ id: members.id })
      .from(members)
      .where(eq(members.isOwner, true));
    expect(owners).toEqual([{ id: dana.member.id }]);
    // A stale session (the owner already handed it over on another phone) can't do it again.
    await handOverOwnership(db, dana, sal.member.id);
    expect(await code(handOverOwnership(db, dana, kim.member.id))).toBe("forbidden");
  });
});

describe("exportData", () => {
  it("has the member's own data, and nothing secret or about anyone else", async () => {
    const { photo } = await busyCrew();
    const data = await exportData(db, sal, NOW);

    expect(data.profile).toEqual({
      name: "Sal",
      joinedAt: sal.member.createdAt.toISOString(),
      isOwner: false,
    });
    expect(data.devices).toHaveLength(2);
    expect(Object.keys(data.devices[0]!).sort()).toEqual(["createdAt", "label", "lastSeenAt"]);
    expect(data.reviews).toEqual([
      {
        stationSlug: "18-w-18th-st",
        stationName: expect.any(String),
        visitedOn: "2026-10-05",
        scores: { coffee: 4 },
        hotTake: "solid",
        body: "",
        tags: ["quiet floor"],
        photoUrl: photo,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    ]);
    expect(data.checkins).toEqual([
      {
        stationSlug: "18-w-18th-st",
        stationName: expect.any(String),
        visitedOn: "2026-10-05",
        note: "here",
        createdAt: expect.any(String),
      },
    ]);
    expect(data.reactions.map((r) => [r.kind, r.stationSlug]).sort()).toEqual([
      ["fire", "33-irving-pl"],
      ["fire", "dock-72"],
    ]);

    const text = JSON.stringify(data);
    for (const other of [dana, kim]) {
      expect(text).not.toContain(other.member.id);
      expect(text).not.toContain(other.member.name);
    }
    expect(text).not.toContain(sal.member.id);
    expect(text).not.toMatch(/scrypt|token|hash|password/i);
  });
});
