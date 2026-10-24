import { loginInputSchema } from "@/domain/schemas";
import { clientIp, json, memberJson, readJson, route, setSessionCookie } from "@/server/http";
import { logIn } from "@/server/services/auth";
import { spend } from "@/server/services/rate-limits";

/** Log in: `{ name, password }` → session cookie. 401 for a wrong name or password, alike. */
export const POST = route(async ({ req, db, now }) => {
  await spend(db, "login", clientIp(req), now);
  const input = await readJson(req, loginInputSchema);
  const { member, token } = await logIn(db, input, now);
  return setSessionCookie(json({ member: memberJson(member) }), { token, memberId: member.id });
});
