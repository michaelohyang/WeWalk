import { redeemLinkSchema } from "@/domain/schemas";
import { json, memberJson, readJson, route, setSessionCookie } from "@/server/http";
import { redeemLink } from "@/server/services/auth";

/**
 * Use a one-time recovery link: `{ token }` → session cookie, password cleared so the person
 * picks a new one. A POST, not a GET, so chat apps that fetch link previews can't use it up.
 */
export const POST = route(async ({ req, db, now }) => {
  const { token } = await readJson(req, redeemLinkSchema);
  const { member, token: session } = await redeemLink(db, token, now);
  return setSessionCookie(json({ member: memberJson(member) }), {
    token: session,
    memberId: member.id,
  });
});
