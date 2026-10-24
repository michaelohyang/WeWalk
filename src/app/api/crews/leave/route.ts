import { NextResponse } from "next/server";
import { crewChanged } from "@/server/crew-cache";
import { authedRoute } from "@/server/http";
import { leaveCrew } from "@/server/services/crews";

/** Leave the crew this phone is looking at. */
export const POST = authedRoute(async ({ db, session }) => {
  await leaveCrew(db, session);
  crewChanged();
  // The next request picks another of your crews, or /welcome if there's none.
  return new NextResponse(null, { status: 204 });
});
