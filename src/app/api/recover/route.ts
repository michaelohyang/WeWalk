import { redeemLinkSchema } from "@/domain/schemas";
import { clientIp, json, memberJson, readJson, route, setSessionCookie } from "@/server/http";
import { redeemLink } from "@/server/services/auth";
import { spend } from "@/server/services/rate-limits";

/**
 * Use a one-time recovery link: `{ token }` → session cookie, password cleared so the person
 * picks a new one. A POST, not a GET, so chat apps that fetch link previews can't use it up.
 */
export const POST = route(async ({ req, db, now }) => {
  await spend(db, "recovery", clientIp(req), now);
  const { token } = await readJson(req, redeemLinkSchema);
  const { member, token: session } = await redeemLink(db, token, now);
  return setSessionCookie(json({ member: memberJson(member) }), {
    token: session,
    memberId: member.id,
  });
});
