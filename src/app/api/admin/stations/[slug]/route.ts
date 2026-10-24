import { stationInputSchema, stationSlugSchema } from "@/domain/schemas";
import { crewChanged } from "@/server/crew-cache";
import { authedRoute, json, parse, readJson } from "@/server/http";
import { updateStation } from "@/server/services/stations";

/** Owner only: edit or hide a building. The slug in the URL never changes. */
export const PUT = authedRoute<{ slug: string }>(async ({ req, db, session }, params) => {
  const slug = parse(stationSlugSchema, params.slug);
  const input = await readJson(req, stationInputSchema);
  const station = await updateStation(db, session, slug, input);
  crewChanged();
  return json({ station });
});
