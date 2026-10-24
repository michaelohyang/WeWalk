import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { checkinInputSchema, reviewInputSchema } from "@/domain/schemas";
import type { Db } from "../db/client";
import { createTestDb, resetTestDb } from "../db/testing";
import { AppError } from "../errors";
import { listCheckins, shareCheckin } from "../repos/checkins";
import { listMemberCrews } from "../repos/crews";
import { listReactions } from "../repos/reactions";
import { listReviews } from "../repos/reviews";
import { exportData } from "./account";
import { authenticate, type Session } from "./auth";
import { createCrew, joinCrew } from "./crews";
import { handleReport, openReports, removeMember, reportPost } from "./moderation";
import { react } from "./reactions";
import { NOW, newId, signIn } from "./testing";
import { putCheckin, putReview } from "./visits";

type Signed = Session & { token: string };
let db: Db;
let dana: Signed; // the first person: app admin and owner of the first crew
let sal: Signed;
let kim: Signed;
const crewsWas = process.env.CREWS_ENABLED;
beforeAll(async () => {
  db = await createTestDb();
  process.env.CREWS_ENABLED = "1";
});
afterAll(() => {
  process.env.CREWS_ENABLED = crewsWas;
});
beforeEach(async () => {
  await resetTestDb(db);
  dana = await signIn(db, "Dana");
  sal = await signIn(db, "Sal");
  kim = await signIn(db, "Kim");
});

/** A fresh session for `who`, looking at `crewId` (memberships may have changed). */
const as = async (who: Signed, crewId?: string): Promise<Signed> => ({
  ...(await authenticate(db, who.token, NOW, crewId))!,
  token: who.token,
});
const failure = (p: Promise<unknown>) =>
  p.then(
    () => undefined,
    (e: unknown) => (e instanceof AppError ? e.code : String(e)),
  );
const reviewOf = (over: Record<string, unknown> = {}) =>
  reviewInputSchema.parse({
    stationSlug: "18-w-18th-st",
    visitedOn: "2026-10-05",
    scores: { coffee: 1 },
    hotTake: "Worst coffee in the city",
    ...over,
  });
const report = (by: Session, kind: "review" | "checkin", id: string, reason = "") =>
  reportPost(db, by, { post: { kind, id }, reason });

describe("reporting a post", () => {
  it("reaches the crew's owner, who sees who reported it", async () => {
    const id = newId();
    await putReview(db, sal, id, reviewOf(), NOW);
    await report(kim, "review", id, "Mean");
    await report(kim, "review", id, "Mean"); // twice is one report
    const queue = await openReports(db, dana);
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      authorName: "Sal",
      reporterName: "Kim",
      reason: "Mean",
      kind: "review",
      hotTake: "Worst coffee in the city",
    });
    // Members don't see the queue.
    expect(await openReports(db, sal)).toEqual([]);
    expect(await failure(handleReport(db, kim, queue[0]!.id, "hide", NOW))).toBe("forbidden");
  });

  it("refuses your own posts and posts this crew doesn't see", async () => {
    const id = newId();
    await putReview(db, sal, id, reviewOf(), NOW);
    expect(await failure(report(sal, "review", id))).toBe("invalid");
    expect(await failure(report(kim, "review", newId()))).toBe("not_found");
    // A review in another crew can't be reported from this one.
    const other = await createCrew(db, sal, { name: "Other", homeCity: "nyc" });
    const elsewhere = newId();
    await putReview(
      db,
      await as(sal, other.id),
      elsewhere,
      reviewOf({ stationSlug: "dock-72" }),
      NOW,
    );
    expect(await failure(report(kim, "review", elsewhere))).toBe("not_found");
  });
});

describe("hiding a post", () => {
  it("takes a review and its reactions out of the crew for good, and closes its reports", async () => {
    const id = newId();
    await putReview(db, sal, id, reviewOf(), NOW);
    await react(db, kim, id, "fire");
    await report(kim, "review", id);
    await report(dana, "review", id); // the owner can report too
    const [first] = await openReports(db, dana);
    await handleReport(db, dana, first!.id, "hide", NOW);

    expect(await listReviews(db, sal.crew!.id)).toEqual([]);
    expect(await listReactions(db, sal.crew!.id)).toEqual([]);
    expect(await openReports(db, dana)).toEqual([]);
    // Editing it doesn't put it back.
    await putReview(db, sal, id, reviewOf({ hotTake: "Fine, it's ok" }), NOW);
    expect(await listReviews(db, sal.crew!.id)).toEqual([]);
    // Handling a closed report again says so.
    expect(await failure(handleReport(db, dana, first!.id, "dismiss", NOW))).toBe("not_found");
  });

  it("works for a check-in's note, and sharing it again is refused", async () => {
    const id = newId();
    await putCheckin(
      db,
      sal,
      id,
      checkinInputSchema.parse({
        stationSlug: "18-w-18th-st",
        visitedOn: "2026-10-05",
        note: "Rude note",
      }),
      NOW,
    );
    await report(kim, "checkin", id);
    const [r] = await openReports(db, dana);
    expect(r).toMatchObject({ kind: "checkin", note: "Rude note" });
    await handleReport(db, dana, r!.id, "hide", NOW);
    await shareCheckin(db, id, [sal.crew!.id]);
    expect(await listCheckins(db, sal.crew!.id)).toEqual([]);
  });

  it("dismissing leaves the post where it is", async () => {
    const id = newId();
    await putReview(db, sal, id, reviewOf(), NOW);
    await report(kim, "review", id);
    await handleReport(db, dana, (await openReports(db, dana))[0]!.id, "dismiss", NOW);
    expect(await listReviews(db, sal.crew!.id)).toHaveLength(1);
    expect(await openReports(db, dana)).toEqual([]);
  });
});

describe("removing someone", () => {
  it("from a report: takes them and their posts out, closes their reports, and keeps them out", async () => {
    const crew = dana.crew!;
    const [a, b] = [newId(), newId()];
    await putReview(db, sal, a, reviewOf(), NOW);
    await putReview(db, sal, b, reviewOf({ stationSlug: "dock-72" }), NOW);
    await report(kim, "review", a);
    await report(kim, "review", b);
    await handleReport(db, dana, (await openReports(db, dana))[0]!.id, "remove", NOW);

    expect((await listMemberCrews(db, sal.member.id)).map((c) => c.id)).not.toContain(crew.id);
    expect(await listReviews(db, crew.id)).toEqual([]);
    expect(await openReports(db, dana)).toEqual([]);
    expect(await failure(joinCrew(db, await as(sal), crew.inviteCode))).toBe("forbidden");
  });

  it("directly, by the owner only, and never the owner themselves", async () => {
    expect(await failure(removeMember(db, sal, kim.member.id, NOW))).toBe("forbidden");
    expect(await failure(removeMember(db, dana, dana.member.id, NOW))).toBe("invalid");
    expect(await failure(removeMember(db, dana, newId(), NOW))).toBe("not_found");
    await removeMember(db, dana, kim.member.id, NOW);
    expect(await listMemberCrews(db, kim.member.id)).toEqual([]);
    expect(await failure(joinCrew(db, await as(kim), dana.crew!.inviteCode))).toBe("forbidden");
  });
});

describe("reports about a crew's owner", () => {
  it("go to the app admin, who can hide or dismiss but not remove the owner", async () => {
    // Sal starts a crew and Kim joins it; Dana (the admin) isn't in it.
    const crew = await createCrew(db, sal, { name: "Sal's", homeCity: "nyc" });
    const salThere = await as(sal, crew.id);
    await joinCrew(db, kim, crew.inviteCode);
    const kimThere = await as(kim, crew.id);
    const id = newId();
    await putReview(db, salThere, id, reviewOf(), NOW);
    await report(kimThere, "review", id);

    expect(await openReports(db, salThere)).toEqual([]);
    const [r] = await openReports(db, dana);
    expect(r).toMatchObject({ crewName: "Sal's", authorName: "Sal", authorOwnsCrew: true });
    expect(await failure(handleReport(db, salThere, r!.id, "dismiss", NOW))).toBe("forbidden");
    expect(await failure(handleReport(db, dana, r!.id, "remove", NOW))).toBe("conflict");
    await handleReport(db, dana, r!.id, "hide", NOW);
    expect(await listReviews(db, crew.id)).toEqual([]);
  });
});

describe("your data", () => {
  it("export lists the reports you made, without naming who you reported", async () => {
    const id = newId();
    await putReview(db, sal, id, reviewOf(), NOW);
    await report(kim, "review", id, "Mean");
    const data = await exportData(db, kim, NOW);
    expect(data.reports).toEqual([
      expect.objectContaining({ kind: "review", reason: "Mean", status: "open" }),
    ]);
    expect(JSON.stringify(data.reports)).not.toContain("Sal");
  });
});
