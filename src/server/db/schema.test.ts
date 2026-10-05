import { sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "./client";
import { checkins, members, reviews, stations } from "./schema";
import { STATIONS } from "./seed/stations";
import { createTestDb, resetTestDb } from "./testing";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});
beforeEach(() => resetTestDb(db));

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

async function member(name = "Dana") {
  const [m] = await db.insert(members).values({ name, nameKey: name.toLowerCase() }).returning();
  return m!;
}

/** Postgres error code of a failed statement (unique_violation = 23505, check_violation = 23514). */
async function pgCode(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
    return undefined;
  } catch (e) {
    const err = e as { code?: string; cause?: { code?: string } };
    return err.cause?.code ?? err.code;
  }
}

describe("migrations + seed", () => {
  it("seeds every station from the seed file", async () => {
    const rows = await db.select().from(stations);
    expect(rows).toHaveLength(STATIONS.length);
    expect(rows).toHaveLength(29);
  });

  it("seeding again is a no-op upsert", async () => {
    const { seedStations } = await import("./seed/seed");
    await seedStations(db);
    expect(await db.$count(stations)).toBe(29);
  });

  it("has row-level security on every table", async () => {
    // Tests run on PGlite, whose execute() returns { rows }.
    const { rows } = (await db.execute(sql`
      select c.relname, c.relrowsecurity from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relname not like '__drizzle%'`)) as unknown as {
      rows: { relname: string; relrowsecurity: boolean }[];
    };
    expect(rows.length).toBe(6);
    for (const r of rows) expect(r, r.relname).toMatchObject({ relrowsecurity: true });
  });
});

describe("constraints", () => {
  it("keeps names unique ignoring case (via name_key)", async () => {
    await member("Dana");
    expect(await pgCode(member("DANA"))).toBe("23505");
  });

  it("allows only one owner", async () => {
    await db.insert(members).values({ name: "A", nameKey: "a", isOwner: true });
    expect(
      await pgCode(db.insert(members).values({ name: "B", nameKey: "b", isOwner: true })),
    ).toBe("23505");
  });

  it("allows one review per member per station", async () => {
    const m = await member();
    const row = { stationId: "250-broadway", memberId: m.id, visitedOn: "2026-10-01", vibe: 4 };
    await db.insert(reviews).values({ id: uuid(1), ...row });
    expect(await pgCode(db.insert(reviews).values({ id: uuid(2), ...row }))).toBe("23505");
  });

  it("requires at least one score, each 1–5", async () => {
    const m = await member();
    const row = { stationId: "250-broadway", memberId: m.id, visitedOn: "2026-10-01" };
    expect(await pgCode(db.insert(reviews).values({ id: uuid(1), ...row }))).toBe("23514");
    expect(await pgCode(db.insert(reviews).values({ id: uuid(2), ...row, coffee: 6 }))).toBe(
      "23514",
    );
    expect(await pgCode(db.insert(reviews).values({ id: uuid(3), ...row, coffee: 0 }))).toBe(
      "23514",
    );
  });

  it("rejects reviews for unknown stations", async () => {
    const m = await member();
    expect(
      await pgCode(
        db.insert(reviews).values({
          id: uuid(1),
          stationId: "nope",
          memberId: m.id,
          visitedOn: "2026-10-01",
          vibe: 3,
        }),
      ),
    ).toBe("23503");
  });

  it("allows one check-in per member per station per day", async () => {
    const m = await member();
    const row = { stationId: "250-broadway", memberId: m.id, visitedOn: "2026-10-01" };
    await db.insert(checkins).values({ id: uuid(1), ...row });
    expect(await pgCode(db.insert(checkins).values({ id: uuid(2), ...row }))).toBe("23505");
    await db.insert(checkins).values({ id: uuid(3), ...row, visitedOn: "2026-10-02" });
  });

  it("deleting a member deletes their reviews and check-ins", async () => {
    const m = await member();
    await db.insert(reviews).values({
      id: uuid(1),
      stationId: "250-broadway",
      memberId: m.id,
      visitedOn: "2026-10-01",
      vibe: 4,
    });
    await db
      .insert(checkins)
      .values({ id: uuid(2), stationId: "250-broadway", memberId: m.id, visitedOn: "2026-10-01" });
    await db.delete(members);
    expect(await db.$count(reviews)).toBe(0);
    expect(await db.$count(checkins)).toBe(0);
  });
});
