import { stationInputSchema } from "@/domain/schemas";
import { crewChanged } from "@/server/crew-cache";
import { authedRoute, json, readJson } from "@/server/http";
import { createStation } from "@/server/services/stations";

/** Owner only: add a building. Its slug comes from the name. */
export const POST = authedRoute(async ({ req, db, session }) => {
  const input = await readJson(req, stationInputSchema);
  const station = await createStation(db, session, input);
  crewChanged();
  return json({ station }, 201);
});
