import { idSchema } from "@/domain/schemas";
import { crewChanged } from "@/server/crew-cache";
import { authedRoute, json, parse, setCrewCookie } from "@/server/http";
import { joinCrewById } from "@/server/services/crews";
import { spend } from "@/server/services/rate-limits";

/** Join a crew picked from the list, and switch this phone to it. */
export const POST = authedRoute<{ id: string }>(async ({ db, now, session }, params) => {
  await spend(db, "join", session.member.id, now);
  const crew = await joinCrewById(db, session, parse(idSchema, params.id));
  crewChanged();
  return setCrewCookie(json({ crew }), crew.id);
});
