import { idSchema, reactionKindSchema } from "@/domain/schemas";
import { crewChanged } from "@/server/crew-cache";
import { authedRoute, parse } from "@/server/http";
import { react, unreact } from "@/server/services/reactions";
import { NextResponse } from "next/server";

type Params = { id: string; kind: string };

/** React to a review (🔥 💯 😂 🙅). Reacting twice is the same as once. */
export const PUT = authedRoute<Params>(async ({ db, session }, params) => {
  await react(db, session, parse(idSchema, params.id), parse(reactionKindSchema, params.kind));
  crewChanged();
  return new NextResponse(null, { status: 204 });
});

/** Take back a reaction. Taking back one that isn't there succeeds. */
export const DELETE = authedRoute<Params>(async ({ db, session }, params) => {
  await unreact(db, session, parse(idSchema, params.id), parse(reactionKindSchema, params.kind));
  crewChanged();
  return new NextResponse(null, { status: 204 });
});
