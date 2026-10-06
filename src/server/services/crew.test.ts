import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { checkinInputSchema, reviewInputSchema } from "@/domain/schemas";
import type { Db } from "../db/client";
import { stations } from "../db/schema";
import { createTestDb } from "../db/testing";
import { loadCrew } from "./crew";
import { NOW, newId, signIn } from "./testing";
import { putCheckin, putReview } from "./visits";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});

describe("loadCrew", () => {
  it("returns stations on the map with their reviews and check-ins, and members by name", async () => {
    const dana = await signIn(db, "Dana");
    await putReview(
      db,
      dana,
      newId(),
      reviewInputSchema.parse({
        stationId: "dock-72",
        visitedOn: "2026-10-01",
        scores: { vibe: 5 },
      }),
      NOW,
    );
    await putCheckin(
      db,
      dana,
      newId(),
      checkinInputSchema.parse({ stationId: "250-broadway", visitedOn: "2026-10-02" }),
      NOW,
    );
    await db.update(stations).set({ hidden: true }).where(eq(stations.slug, "250-broadway"));

    const crew = await loadCrew(db);
    expect(crew.stations).toHaveLength(28);
    expect(crew.stations.map((s) => s.id)).not.toContain("250-broadway");
    expect(crew.members).toEqual([{ id: dana.member.id, name: "Dana" }]);
    expect(crew.reviews).toHaveLength(1);
    expect(crew.reviews[0]).toMatchObject({ stationId: "dock-72", scores: { vibe: 5 } });
    expect(crew.checkins).toHaveLength(0); // its station is hidden
  });
});
