import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { reviewInputSchema, checkinInputSchema } from "@/domain/schemas";
import type { Db } from "../db/client";
import { stations } from "../db/schema";
import { createTestDb, resetTestDb } from "../db/testing";
import { AppError } from "../errors";
import { eq } from "drizzle-orm";
import type { Session } from "./auth";
import { NOW, newId, signIn } from "./testing";
import { deleteReview, putCheckin, putReview } from "./visits";

let db: Db;
let dana: Session;
let sal: Session;
beforeAll(async () => {
  db = await createTestDb();
});
beforeEach(async () => {
  await resetTestDb(db);
  dana = await signIn(db, "Dana");
  sal = await signIn(db, "Sal");
});

const failure = (p: Promise<unknown>) =>
  p.then(
    () => undefined,
    (e: unknown) =>
      e instanceof AppError ? { code: e.code, details: e.details } : { code: String(e) },
  );
const reviewOf = (over: Record<string, unknown> = {}) =>
  reviewInputSchema.parse({
    stationId: "18-w-18th-st",
    visitedOn: "2026-10-05",
    scores: { coffee: 4 },
    ...over,
  });
const checkinOf = (over: Record<string, unknown> = {}) =>
  checkinInputSchema.parse({ stationId: "18-w-18th-st", visitedOn: "2026-10-05", ...over });

describe("putReview", () => {
  it("creates, then updates in place when the same id is sent again", async () => {
    const id = newId();
    const first = await putReview(db, dana, id, reviewOf(), NOW);
    expect(first.created).toBe(true);
    const again = await putReview(
      db,
      dana,
      id,
      reviewOf({ scores: { coffee: 2, wifi: 5 }, hotTake: "hm" }),
      NOW,
    );
    expect(again.created).toBe(false);
    expect(again.review.scores).toEqual({ coffee: 2, wifi: 5 });
    expect(again.review.hotTake).toBe("hm");
  });

  it("is idempotent for an identical retry", async () => {
    const id = newId();
    await putReview(db, dana, id, reviewOf(), NOW);
    const retry = await putReview(db, dana, id, reviewOf(), NOW);
    expect(retry.review.id).toBe(id);
  });

  it("clears a category when it's skipped on edit", async () => {
    const id = newId();
    await putReview(db, dana, id, reviewOf({ scores: { coffee: 4, wifi: 3 } }), NOW);
    const edited = await putReview(db, dana, id, reviewOf({ scores: { wifi: 3 } }), NOW);
    expect(edited.review.scores).toEqual({ wifi: 3 });
  });

  it("allows one review per person per station and says which one to edit", async () => {
    const first = newId();
    await putReview(db, dana, first, reviewOf(), NOW);
    expect(await failure(putReview(db, dana, newId(), reviewOf(), NOW))).toEqual({
      code: "conflict",
      details: { existingId: first },
    });
    // Someone else reviewing the same station is fine.
    expect((await putReview(db, sal, newId(), reviewOf(), NOW)).created).toBe(true);
  });

  it("won't let you edit someone else's review", async () => {
    const id = newId();
    await putReview(db, dana, id, reviewOf(), NOW);
    expect((await failure(putReview(db, sal, id, reviewOf(), NOW)))?.code).toBe("forbidden");
  });

  it("won't move a review to another building", async () => {
    const id = newId();
    await putReview(db, dana, id, reviewOf(), NOW);
    expect(
      (await failure(putReview(db, dana, id, reviewOf({ stationId: "250-broadway" }), NOW)))?.code,
    ).toBe("invalid");
  });

  it("rejects unknown and hidden stations, and implausible dates", async () => {
    expect(
      (await failure(putReview(db, dana, newId(), reviewOf({ stationId: "nope" }), NOW)))?.code,
    ).toBe("not_found");
    await db.update(stations).set({ hidden: true }).where(eq(stations.slug, "250-broadway"));
    expect(
      (await failure(putReview(db, dana, newId(), reviewOf({ stationId: "250-broadway" }), NOW)))
        ?.code,
    ).toBe("not_found");
    await db.update(stations).set({ hidden: false }).where(eq(stations.slug, "250-broadway"));
    expect(
      (await failure(putReview(db, dana, newId(), reviewOf({ visitedOn: "2026-10-09" }), NOW)))
        ?.code,
    ).toBe("invalid");
  });

  it("freezes reviews of a removed (hidden) station", async () => {
    const id = newId();
    await putReview(db, dana, id, reviewOf({ stationId: "250-broadway" }), NOW);
    await db.update(stations).set({ hidden: true }).where(eq(stations.slug, "250-broadway"));
    const edit = await failure(
      putReview(db, dana, id, reviewOf({ stationId: "250-broadway" }), NOW),
    );
    await db.update(stations).set({ hidden: false }).where(eq(stations.slug, "250-broadway"));
    expect(edit?.code).toBe("not_found");
  });

  it("reports field problems in details.fields", async () => {
    const id = newId();
    await putReview(db, dana, id, reviewOf(), NOW);
    const moved = await failure(
      putReview(db, dana, id, reviewOf({ stationId: "250-broadway" }), NOW),
    );
    expect(moved?.details).toEqual({ fields: { stationId: [expect.any(String)] } });
  });

  it("rejects an implausible date on edit too", async () => {
    const id = newId();
    await putReview(db, dana, id, reviewOf(), NOW);
    expect(
      (await failure(putReview(db, dana, id, reviewOf({ visitedOn: "2030-01-01" }), NOW)))?.code,
    ).toBe("invalid");
  });

  it("handles a burst of identical retries without duplicates", async () => {
    const id = newId();
    const results = await Promise.all(
      [1, 2, 3].map(() => putReview(db, dana, id, reviewOf(), NOW)),
    );
    expect(results.filter((r) => r.created)).toHaveLength(1);
  });
});

describe("deleteReview", () => {
  it("deletes your own review; deleting again is fine", async () => {
    const id = newId();
    await putReview(db, dana, id, reviewOf(), NOW);
    await deleteReview(db, dana, id);
    await deleteReview(db, dana, id);
    // The slot is free again: a new review of the same station works.
    expect((await putReview(db, dana, newId(), reviewOf(), NOW)).created).toBe(true);
  });

  it("can't delete someone else's", async () => {
    const id = newId();
    await putReview(db, dana, id, reviewOf(), NOW);
    expect((await failure(deleteReview(db, sal, id)))?.code).toBe("forbidden");
  });
});

describe("putCheckin", () => {
  it("checks in once per day; a second id that day conflicts and points at the first", async () => {
    const id = newId();
    expect((await putCheckin(db, dana, id, checkinOf(), NOW)).created).toBe(true);
    expect(await failure(putCheckin(db, dana, newId(), checkinOf(), NOW))).toEqual({
      code: "conflict",
      details: { existingId: id },
    });
    const yesterday = await putCheckin(
      db,
      dana,
      newId(),
      checkinOf({ visitedOn: "2026-10-04" }),
      NOW,
    );
    expect(yesterday.created).toBe(true);
  });

  it("the same id again adds or changes the note; an identical retry is a no-op", async () => {
    const id = newId();
    await putCheckin(db, dana, id, checkinOf(), NOW);
    const noted = await putCheckin(
      db,
      dana,
      id,
      checkinOf({ note: "4th floor was dead quiet" }),
      NOW,
    );
    expect(noted).toMatchObject({ created: false, checkin: { note: "4th floor was dead quiet" } });
    const retry = await putCheckin(
      db,
      dana,
      id,
      checkinOf({ note: "4th floor was dead quiet" }),
      NOW,
    );
    expect(retry).toMatchObject({ created: false, checkin: { note: "4th floor was dead quiet" } });
  });

  it("won't move a check-in to another building or day", async () => {
    const id = newId();
    await putCheckin(db, dana, id, checkinOf(), NOW);
    expect(
      (await failure(putCheckin(db, dana, id, checkinOf({ stationId: "dock-72" }), NOW)))?.code,
    ).toBe("invalid");
    expect(
      (await failure(putCheckin(db, dana, id, checkinOf({ visitedOn: "2026-10-04" }), NOW)))?.code,
    ).toBe("invalid");
  });

  it("won't return someone else's check-in for a reused id", async () => {
    const id = newId();
    await putCheckin(db, dana, id, checkinOf(), NOW);
    expect((await failure(putCheckin(db, sal, id, checkinOf(), NOW)))?.code).toBe("forbidden");
  });

  it("rejects hidden stations and future dates", async () => {
    expect(
      (await failure(putCheckin(db, dana, newId(), checkinOf({ visitedOn: "2026-12-25" }), NOW)))
        ?.code,
    ).toBe("invalid");
    expect(
      (await failure(putCheckin(db, dana, newId(), checkinOf({ stationId: "nope" }), NOW)))?.code,
    ).toBe("not_found");
  });
});
