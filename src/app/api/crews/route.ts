import { createCrewInputSchema } from "@/domain/schemas";
import { crewChanged } from "@/server/crew-cache";
import { authedRoute, json, readJson, setCrewCookie } from "@/server/http";
import { createCrew } from "@/server/services/crews";

/** Start a crew ({ name, homeCity }): you own it, and this phone switches to it. */
export const POST = authedRoute(async ({ req, db, session }) => {
  const crew = await createCrew(db, session, await readJson(req, createCrewInputSchema));
  crewChanged();
  return setCrewCookie(json({ crew }, 201), crew.id);
});
