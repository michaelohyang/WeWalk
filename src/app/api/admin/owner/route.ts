import { NextResponse } from "next/server";
import { handOverInputSchema } from "@/domain/schemas";
import { authedRoute, readJson } from "@/server/http";
import { handOverOwnership } from "@/server/services/account";

/** Owner only: make someone else the crew's owner: `{ memberId }`. */
export const PUT = authedRoute(async ({ req, db, session }) => {
  const { memberId } = await readJson(req, handOverInputSchema);
  await handOverOwnership(db, session, memberId);
  return new NextResponse(null, { status: 204 });
});
