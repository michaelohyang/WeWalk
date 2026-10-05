import { signupInputSchema } from "@/domain/schemas";
import { crewChanged } from "@/server/crew-cache";
import { json, memberJson, readJson, route, setSessionCookie } from "@/server/http";
import { signUp } from "@/server/services/auth";

/** Sign up: `{ name, password }` → session cookie. The first person to sign up is the owner. */
export const POST = route(async ({ req, db }) => {
  const input = await readJson(req, signupInputSchema);
  const { member, token } = await signUp(db, input);
  crewChanged();
  return setSessionCookie(json({ member: memberJson(member) }, 201), {
    token,
    memberId: member.id,
  });
});
