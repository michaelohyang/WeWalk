import { joinInputSchema } from "@/domain/schemas";
import { json, memberJson, readJson, route, setSessionCookie } from "@/server/http";
import { joinCrew } from "@/server/services/auth";

/** Join the crew from the invite link: `{ code, name }` → session cookie. */
export const POST = route(async ({ req, db }) => {
  const input = await readJson(req, joinInputSchema);
  const { member, token } = await joinCrew(db, input, process.env.CREW_CODE);
  return setSessionCookie(json({ member: memberJson(member) }, 201), token);
});
