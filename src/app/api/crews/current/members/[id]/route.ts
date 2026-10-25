import { NextResponse } from "next/server";
import { idSchema } from "@/domain/schemas";
import { crewChanged } from "@/server/crew-cache";
import { authedRoute, parse } from "@/server/http";
import { removeMember } from "@/server/services/moderation";

/** Owner: take someone out of the crew. They can't rejoin it. */
export const DELETE = authedRoute<{ id: string }>(async ({ db, now, session }, params) => {
  await removeMember(db, session, parse(idSchema, params.id), now);
  crewChanged();
  return new NextResponse(null, { status: 204 });
});
