import { NextResponse } from "next/server";
import { renameCrewInputSchema } from "@/domain/schemas";
import { crewChanged } from "@/server/crew-cache";
import { authedRoute, readJson } from "@/server/http";
import { renameCrew } from "@/server/services/crews";

/** Owner: rename the crew ({ name }). */
export const PATCH = authedRoute(async ({ req, db, session }) => {
  const { name } = await readJson(req, renameCrewInputSchema);
  await renameCrew(db, session, name);
  crewChanged();
  return new NextResponse(null, { status: 204 });
});
