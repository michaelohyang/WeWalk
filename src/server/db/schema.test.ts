import { eq, sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "./client";
import { checkins, members, reviews, stations } from "./schema";
import { cityOf, isArea } from "@/domain/areas";
import { STATIONS } from "@/domain/stations";
import { createTestDb, resetTestDb } from "./testing";
import { stationKey } from "../repos/stations";

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
    // Every station's area is a known one, in one of the cities (the check constraint agrees).
    const perCity = new Map<string, number>();
    for (const r of rows) {
      expect(isArea(r.area), r.slug).toBe(true);
      if (!isArea(r.area)) continue;
      const city = cityOf(r.area);
      perCity.set(city, (perCity.get(city) ?? 0) + 1);
    }
    expect(Object.fromEntries(perCity)).toEqual({ nyc: 29, boston: 7, atlanta: 5 });
  });

  it("seeding again is a no-op: same rows, same integer ids", async () => {
    const before = await db.select({ id: stations.id, slug: stations.slug }).from(stations);
    const { seedStations } = await import("./seed/seed");
    expect(await seedStations(db)).toBe(0);
    const after = await db.select({ id: stations.id, slug: stations.slug }).from(stations);
    expect(after).toHaveLength(STATIONS.length);
    expect(new Map(after.map((r) => [r.slug, r.id]))).toEqual(
      new Map(before.map((r) => [r.slug, r.id])),
    );
    expect(after.every((r) => Number.isInteger(r.id))).toBe(true);
  });

  it("stores each station's short name", async () => {
    const [row] = await db
      .select({ short: stations.short })
      .from(stations)
      .where(eq(stations.slug, "450-lexington-ave"));
    expect(row?.short).toBe("450 Lex");
  });

  it("re-seeding never overwrites an edit or un-hides a station, but adds missing slugs", async () => {
    const { seedStations } = await import("./seed/seed");
    await db
      .update(stations)
      .set({ name: "250 Broadway (edited)", short: null, lat: 40.7 })
      .where(eq(stations.slug, "250-broadway"));
    await db.update(stations).set({ hidden: true }).where(eq(stations.slug, "199-water-st"));
    await db.delete(stations).where(eq(stations.slug, "450-lexington-ave"));

    expect(await seedStations(db)).toBe(1);

    const bySlug = new Map((await db.select().from(stations)).map((r) => [r.slug, r]));
    expect(bySlug.get("250-broadway")).toMatchObject({
      name: "250 Broadway (edited)",
      short: null,
      lat: 40.7,
    });
    expect(bySlug.get("199-water-st")?.hidden).toBe(true);
    expect(bySlug.get("450-lexington-ave")).toMatchObject({ name: "450 Lexington Ave" });
  });

  it("has row-level security on every table", async () => {
    // Tests run on PGlite, whose execute() returns { rows }.
    const { rows } = (await db.execute(sql`
      select c.relname, c.relrowsecurity from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relname not like '__drizzle%'`)) as unknown as {
      rows: { relname: string; relrowsecurity: boolean }[];
    };
    expect(rows.length).toBe(7);
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
    const row = {
      stationId: stationKey("250-broadway"),
      memberId: m.id,
      visitedOn: "2026-10-01",
      vibe: 4,
    };
    await db.insert(reviews).values({ id: uuid(1), ...row });
    expect(await pgCode(db.insert(reviews).values({ id: uuid(2), ...row }))).toBe("23505");
  });

  it("requires at least one score, each 1–5", async () => {
    const m = await member();
    const row = { stationId: stationKey("250-broadway"), memberId: m.id, visitedOn: "2026-10-01" };
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
          stationId: 99_999,
          memberId: m.id,
          visitedOn: "2026-10-01",
          vibe: 3,
        }),
      ),
    ).toBe("23503");
  });

  it("allows one check-in per member per station per day", async () => {
    const m = await member();
    const row = { stationId: stationKey("250-broadway"), memberId: m.id, visitedOn: "2026-10-01" };
    await db.insert(checkins).values({ id: uuid(1), ...row });
    expect(await pgCode(db.insert(checkins).values({ id: uuid(2), ...row }))).toBe("23505");
    await db.insert(checkins).values({ id: uuid(3), ...row, visitedOn: "2026-10-02" });
  });

  it("deleting a member deletes their reviews and check-ins", async () => {
    const m = await member();
    await db.insert(reviews).values({
      id: uuid(1),
      stationId: stationKey("250-broadway"),
      memberId: m.id,
      visitedOn: "2026-10-01",
      vibe: 4,
    });
    await db.insert(checkins).values({
      id: uuid(2),
      stationId: stationKey("250-broadway"),
      memberId: m.id,
      visitedOn: "2026-10-01",
    });
    await db.delete(members);
    expect(await db.$count(reviews)).toBe(0);
    expect(await db.$count(checkins)).toBe(0);
  });
});
