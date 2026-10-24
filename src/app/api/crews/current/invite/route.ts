import { authedRoute, json } from "@/server/http";
import { rotateInviteCode } from "@/server/services/crews";

/** Owner: a new invite link; the old one stops working. */
export const POST = authedRoute(async ({ db, session }) =>
  json({ inviteCode: await rotateInviteCode(db, session) }),
);
