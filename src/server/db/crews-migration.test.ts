import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import * as schema from "./schema";
import { FIRST_CREW_ID } from "./schema";

/*
 * The crews migration runs on a live database full of people, reviews and reactions. Build one
 * at the version before crews, fill it the way the old app did, then migrate and check that
 * everyone and everything landed in the first crew.
 */
const real = path.join(process.cwd(), "src/server/db/migrations");
const before = mkdtempSync(path.join(tmpdir(), "wewalk-before-crews-"));
cpSync(real, before, { recursive: true });
const journalFile = path.join(before, "meta/_journal.json");
const journal = JSON.parse(readFileSync(journalFile, "utf8")) as { entries: { tag: string }[] };
journal.entries = journal.entries.filter((e) => !e.tag.endsWith("_crews"));
writeFileSync(journalFile, JSON.stringify(journal));
afterAll(() => rmSync(before, { recursive: true, force: true }));

const rows = async <T>(db: ReturnType<typeof drizzle>, query: ReturnType<typeof sql>) =>
  ((await db.execute(query)) as unknown as { rows: T[] }).rows;

describe("the crews migration on existing data", () => {
  it("puts every member, review, check-in and reaction in the first crew", async () => {
    const db = drizzle(new PGlite(), { schema });
    await migrate(db, { migrationsFolder: before });
    await db.execute(sql`insert into stations (slug, name, address, neighborhood, area, lat, lng)
      values ('dock-72', 'Dock 72', 'Dock 72 Way', 'Navy Yard', 'brooklyn', 40.7, -73.97)`);
    const [station] = await rows<{ id: number }>(db, sql`select id from stations`);
    await db.execute(sql`insert into members (id, name, name_key, is_owner) values
      ('00000000-0000-4000-8000-0000000000a1', 'Dana', 'dana', true),
      ('00000000-0000-4000-8000-0000000000a2', 'Sam', 'sam', false)`);
    await db.execute(sql`insert into reviews (id, station_id, member_id, visited_on, coffee)
      values ('00000000-0000-4000-8000-0000000000b1', ${station!.id},
              '00000000-0000-4000-8000-0000000000a1', '2026-10-01', 4)`);
    await db.execute(sql`insert into checkins (id, station_id, member_id, visited_on)
      values ('00000000-0000-4000-8000-0000000000c1', ${station!.id},
              '00000000-0000-4000-8000-0000000000a2', '2026-10-01')`);
    await db.execute(sql`insert into reactions (review_id, member_id, kind)
      values ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a2', 'fire')`);

    await migrate(db, { migrationsFolder: real });

    expect(await rows(db, sql`select id, name from crews`)).toEqual([
      { id: FIRST_CREW_ID, name: "NYC crew" },
    ]);
    expect(
      await rows(db, sql`select member_id, role from crew_members order by role desc, member_id`),
    ).toEqual([
      { member_id: "00000000-0000-4000-8000-0000000000a1", role: "owner" },
      { member_id: "00000000-0000-4000-8000-0000000000a2", role: "member" },
    ]);
    expect(await rows(db, sql`select name from members where is_admin`)).toEqual([
      { name: "Dana" },
    ]);
    expect(await rows(db, sql`select crew_id from review_crews`)).toEqual([
      { crew_id: FIRST_CREW_ID },
    ]);
    expect(await rows(db, sql`select crew_id from checkin_crews`)).toEqual([
      { crew_id: FIRST_CREW_ID },
    ]);
    expect(await rows(db, sql`select crew_id from reactions`)).toEqual([
      { crew_id: FIRST_CREW_ID },
    ]);
  });
});
