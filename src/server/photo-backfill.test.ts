import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "./db/client";
import { reviews } from "./db/schema";
import { createTestDb, resetTestDb } from "./db/testing";
import { backfillPhotoSizes, type BackfillDeps } from "./photo-backfill";
import { reviewInputSchema } from "@/domain/schemas";
import { NOW, signIn } from "./services/testing";
import { putReview } from "./services/visits";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});
beforeEach(() => resetTestDb(db));

const OLD = "/api/photos/0f8fad5b-d9cb-469f-a165-70867728950e";
/** SOI + a baseline frame header: 1600 tall, 736 wide. */
const sized = new Uint8Array([
  0xff, 0xd8, 0xff, 0xc0, 0, 11, 8, 0x06, 0x40, 0x02, 0xe0, 1, 1, 0x11, 0,
]);

async function reviewWithPhoto(photoUrl: string) {
  const me = await signIn(db, "Dana");
  const id = "00000000-0000-4000-8000-000000000001";
  const input = reviewInputSchema.parse({
    stationSlug: "dock-72",
    visitedOn: "2026-10-01",
    scores: { coffee: 4 },
    photoUrl,
  });
  await putReview(db, me, id, input, NOW);
  return id;
}

const deps = (over: Partial<BackfillDeps> = {}): BackfillDeps & { lines: string[] } => {
  const lines: string[] = [];
  return {
    lines,
    apply: true,
    log: (l) => lines.push(l),
    fetchBytes: async () => sized,
    store: async (_b, s) =>
      `/api/photos/11111111-2222-4333-8444-555555555555-${s.width}x${s.height}`,
    ...over,
  };
};

const photoOf = async (id: string) =>
  (await db.select({ u: reviews.photoUrl }).from(reviews).where(eq(reviews.id, id)))[0]!.u;

describe("backfillPhotoSizes", () => {
  it("moves an old photo to a size-carrying address", async () => {
    const id = await reviewWithPhoto(OLD);
    const d = deps();
    expect(await backfillPhotoSizes(db, d)).toEqual({ checked: 1, updated: 1, skipped: 0 });
    expect(await photoOf(id)).toBe("/api/photos/11111111-2222-4333-8444-555555555555-736x1600");
  });

  it("changes nothing on a dry run, or for photos that already have a size", async () => {
    const id = await reviewWithPhoto(OLD);
    expect((await backfillPhotoSizes(db, deps({ apply: false }))).updated).toBe(1);
    expect(await photoOf(id)).toBe(OLD);

    await db.update(reviews).set({ photoUrl: `${OLD}-736x1600` });
    expect(await backfillPhotoSizes(db, deps())).toEqual({ checked: 1, updated: 0, skipped: 0 });
  });

  it("skips photos it can't read, and keeps going", async () => {
    const id = await reviewWithPhoto(OLD);
    const d = deps({ fetchBytes: async () => new Uint8Array([1, 2, 3]) });
    expect(await backfillPhotoSizes(db, d)).toEqual({ checked: 1, updated: 0, skipped: 1 });
    expect(await photoOf(id)).toBe(OLD);
  });
});
