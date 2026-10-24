import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { reviewInputSchema, stationInputSchema } from "@/domain/schemas";
import type { Db } from "../db/client";
import { createTestDb, resetTestDb } from "../db/testing";
import { AppError } from "../errors";
import { findStation, listVisibleStations } from "../repos/stations";
import type { Session } from "./auth";
import { loadCrew } from "./crew";
import { createStation, listStationsForAdmin, updateStation } from "./stations";
import { NOW, newId, signIn } from "./testing";
import { putReview } from "./visits";

let db: Db;
let owner: Session;
let sal: Session;
beforeAll(async () => {
  db = await createTestDb();
});
beforeEach(async () => {
  await resetTestDb(db);
  owner = await signIn(db, "Owner"); // the first to sign up owns the crew
  sal = await signIn(db, "Sal");
});

const failure = (p: Promise<unknown>) =>
  p.then(
    () => undefined,
    (e: unknown) =>
      e instanceof AppError ? { code: e.code, details: e.details } : { code: String(e) },
  );
const input = (over: Record<string, unknown> = {}) =>
  stationInputSchema.parse({
    name: "1 Seaport Sq.",
    short: "1 Seaport",
    address: "1 Seaport Sq, Boston, MA 02210",
    neighborhood: "Seaport",
    area: "seaport",
    lat: 42.3505,
    lng: -71.0445,
    hidden: false,
    ...over,
  });

describe("owner only", () => {
  it("refuses everyone else", async () => {
    expect(await failure(listStationsForAdmin(db, sal))).toMatchObject({ code: "forbidden" });
    expect(await failure(createStation(db, sal, input()))).toMatchObject({ code: "forbidden" });
    expect(await failure(updateStation(db, sal, "250-broadway", input()))).toMatchObject({
      code: "forbidden",
    });
    expect(await findStation(db, "1-seaport-sq")).toBeUndefined();
  });
});

describe("createStation", () => {
  it("adds a building with a slug from its name, on the map right away", async () => {
    const station = await createStation(db, owner, input());
    expect(station).toEqual({
      slug: "1-seaport-sq",
      name: "1 Seaport Sq.",
      short: "1 Seaport",
      address: "1 Seaport Sq, Boston, MA 02210",
      neighborhood: "Seaport",
      area: "seaport",
      lat: 42.3505,
      lng: -71.0445,
      hidden: false,
    });
    const crew = await loadCrew(db);
    expect(crew.stations.map((s) => s.slug)).toContain("1-seaport-sq");
  });

  it("makes slugs the database accepts from any name", async () => {
    const station = await createStation(
      db,
      owner,
      input({ name: "  Café Építő — 12th & Main!  " }),
    );
    expect(station.slug).toBe("cafe-epito-12th-main");
  });

  it("rejects a name with no letters or digits", async () => {
    expect(await failure(createStation(db, owner, input({ name: "!!!" })))).toMatchObject({
      code: "invalid",
      details: { fields: { name: [expect.any(String)] } },
    });
  });

  it("says clearly when the slug is taken, hidden stations included", async () => {
    await updateStation(db, owner, "250-broadway", {
      ...input({ name: "250 Broadway", area: "downtown" }),
      hidden: true,
    });
    const clash = await failure(createStation(db, owner, input({ name: "250 Broadway" })));
    expect(clash).toMatchObject({
      code: "conflict",
      details: { fields: { name: [expect.stringContaining("/stations/250-broadway")] } },
    });
  });
});

describe("updateStation", () => {
  it("edits every field but the slug", async () => {
    const station = await updateStation(
      db,
      owner,
      "250-broadway",
      input({ name: "250 Broadway (new lobby)", short: "", area: "downtown" }),
    );
    expect(station).toMatchObject({
      slug: "250-broadway",
      name: "250 Broadway (new lobby)",
      short: null,
      area: "downtown",
    });
    expect(await findStation(db, "250-broadway")).toMatchObject({ name: station.name });
  });

  it("hides a station: off the map, reviews kept, still in the admin list", async () => {
    await putReview(
      db,
      sal,
      newId(),
      reviewInputSchema.parse({
        stationSlug: "250-broadway",
        visitedOn: "2026-10-05",
        scores: { coffee: 4 },
      }),
      NOW,
    );
    const fields = input({ name: "250 Broadway", area: "downtown" });
    await updateStation(db, owner, "250-broadway", { ...fields, hidden: true });
    expect((await listVisibleStations(db)).map((s) => s.slug)).not.toContain("250-broadway");
    expect(await listStationsForAdmin(db, owner)).toContainEqual(
      expect.objectContaining({ slug: "250-broadway", hidden: true }),
    );
    // Un-hiding brings it back with its review.
    await updateStation(db, owner, "250-broadway", fields);
    const crew = await loadCrew(db);
    expect(crew.reviews.filter((r) => r.stationSlug === "250-broadway")).toHaveLength(1);
  });

  it("404s for an unknown station", async () => {
    expect(await failure(updateStation(db, owner, "nowhere", input()))).toMatchObject({
      code: "not_found",
    });
  });
});
