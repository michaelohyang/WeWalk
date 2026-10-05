import { loginInputSchema } from "@/domain/schemas";
import { json, memberJson, readJson, route, setSessionCookie } from "@/server/http";
import { logIn } from "@/server/services/auth";

/** Log in: `{ name, password }` → session cookie. 401 for a wrong name or password, alike. */
export const POST = route(async ({ req, db, now }) => {
  const input = await readJson(req, loginInputSchema);
  const { member, token } = await logIn(db, input, now);
  return setSessionCookie(json({ member: memberJson(member) }), { token, memberId: member.id });
});
