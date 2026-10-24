import { joinCrewInputSchema } from "@/domain/schemas";
import { crewChanged } from "@/server/crew-cache";
import { authedRoute, json, readJson, setCrewCookie } from "@/server/http";
import { joinCrew } from "@/server/services/crews";
import { spend } from "@/server/services/rate-limits";

/** Join a crew by its invite code ({ code }) and switch this phone to it. */
export const POST = authedRoute(async ({ req, db, now, session }) => {
  await spend(db, "join", session.member.id, now);
  const { code } = await readJson(req, joinCrewInputSchema);
  const crew = await joinCrew(db, session, code);
  crewChanged();
  return setCrewCookie(json({ crew }), crew.id);
});
