import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../db/client";
import { createTestDb, resetTestDb } from "../db/testing";
import { FIRST_CREW_ID } from "../db/schema";
import { AppError } from "../errors";
import { authenticate, type Session } from "./auth";
import { createCrew, crewDirectory, joinCrewById } from "./crews";
import { removeMember } from "./moderation";
import { NOW, newId, signIn } from "./testing";

type Signed = Session & { token: string };
let db: Db;
let dana: Signed; // owner of the first crew ("NYC crew", New York)
let sam: Signed;
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
  sam = await signIn(db, "Sam");
});

const fresh = async (who: Signed): Promise<Signed> => ({
  ...(await authenticate(db, who.token, NOW))!,
  token: who.token,
});
const failure = (p: Promise<unknown>) =>
  p.then(
    () => undefined,
    (e: unknown) => (e instanceof AppError ? e.code : String(e)),
  );

describe("the crew directory", () => {
  it("lists every crew, your city first, then the biggest, with whether you're in it", async () => {
    await createCrew(db, sam, { name: "Seaport", homeCity: "boston" });
    await createCrew(db, sam, { name: "Back Bay", homeCity: "boston" });
    const list = await crewDirectory(db, await fresh(dana), "boston");
    expect(list.map((c) => [c.name, c.members, c.joined])).toEqual([
      ["Back Bay", 1, false],
      ["Seaport", 1, false],
      ["NYC crew", 2, true],
    ]);
    expect((await crewDirectory(db, await fresh(dana), "nyc"))[0]!.name).toBe("NYC crew");
  });

  it("sorts before the cap, so a short list keeps the most relevant crews", async () => {
    await createCrew(db, sam, { name: "Aardvarks", homeCity: "nyc" });
    await createCrew(db, sam, { name: "Zesty walkers", homeCity: "atlanta" });
    const two = await crewDirectory(db, await fresh(dana), "atlanta", 2);
    expect(two.map((c) => c.name)).toEqual(["Zesty walkers", "NYC crew"]);
  });

  it("joins a listed crew with one tap; joining again just switches to it", async () => {
    const seaport = await createCrew(db, sam, { name: "Seaport", homeCity: "boston" });
    expect(await joinCrewById(db, dana, seaport.id)).toEqual({ id: seaport.id, name: "Seaport" });
    expect(await joinCrewById(db, dana, seaport.id)).toEqual({ id: seaport.id, name: "Seaport" });
    expect((await fresh(dana)).crews.map((c) => c.id)).toContain(seaport.id);
    expect(await failure(joinCrewById(db, dana, newId()))).toBe("not_found");
  });

  it("hides a crew from someone its owner removed, and won't let them back in", async () => {
    await removeMember(db, dana, sam.member.id, NOW);
    const list = await crewDirectory(db, await fresh(sam), "nyc");
    expect(list.map((c) => c.id)).not.toContain(FIRST_CREW_ID);
    expect(await failure(joinCrewById(db, await fresh(sam), FIRST_CREW_ID))).toBe("forbidden");
  });
});
