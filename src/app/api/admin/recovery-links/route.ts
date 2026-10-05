import { recoveryInputSchema } from "@/domain/schemas";
import { authedRoute, json, readJson } from "@/server/http";
import { createRecoveryLink } from "@/server/services/auth";

/** Owner only: a one-time link (24 hours) for a member who lost every phone. */
export const POST = authedRoute(async ({ req, db, now, session }) => {
  const { memberId } = await readJson(req, recoveryInputSchema);
  const token = await createRecoveryLink(db, session, memberId, now);
  return json({ url: `${req.nextUrl.origin}/pair/${token}` }, 201);
});
