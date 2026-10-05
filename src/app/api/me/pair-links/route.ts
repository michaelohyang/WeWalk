import { authedRoute, json } from "@/server/http";
import { createPairLink } from "@/server/services/auth";

/** A one-time link (15 minutes) to sign in another phone as you. */
export const POST = authedRoute(async ({ req, db, now, session }) => {
  const token = await createPairLink(db, session, now);
  return json({ url: `${req.nextUrl.origin}/pair/${token}` }, 201);
});
