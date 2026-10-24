import { NextResponse } from "next/server";
import { authedRoute } from "@/server/http";
import { finishOnboarding } from "@/server/services/auth";

/** The welcome steps are done (doing it again changes nothing). */
export const POST = authedRoute(async ({ db, now, session }) => {
  await finishOnboarding(db, session, now);
  return new NextResponse(null, { status: 204 });
});
