import { NextResponse } from "next/server";
import { reportInputSchema } from "@/domain/schemas";
import { authedRoute, readJson } from "@/server/http";
import { reportPost } from "@/server/services/moderation";
import { spend } from "@/server/services/rate-limits";

/** Report a review or check-in in this crew to its owner: `{ kind, id, reason }`. */
export const POST = authedRoute(async ({ req, db, now, session }) => {
  await spend(db, "reports", session.member.id, now);
  const { kind, id, reason } = await readJson(req, reportInputSchema);
  await reportPost(db, session, { post: { kind, id }, reason });
  return new NextResponse(null, { status: 204 });
});
