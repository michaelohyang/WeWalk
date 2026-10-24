import { recoveryInputSchema } from "@/domain/schemas";
import { authedRoute, clientIp, json, readJson } from "@/server/http";
import { createRecoveryLink } from "@/server/services/auth";
import { spend } from "@/server/services/rate-limits";

/** Owner only: a one-time link (24 hours) for a member who lost every phone. */
export const POST = authedRoute(async ({ req, db, now, session }) => {
  await spend(db, "recovery", clientIp(req), now);
  const { memberId } = await readJson(req, recoveryInputSchema);
  const token = await createRecoveryLink(db, session, memberId, now);
  return json({ url: `${req.nextUrl.origin}/recover/${token}` }, 201);
});
