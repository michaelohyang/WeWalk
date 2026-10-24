import { NextResponse } from "next/server";
import { deleteAccountInputSchema, renameInputSchema } from "@/domain/schemas";
import { crewChanged } from "@/server/crew-cache";
import { authedRoute, clearSessionCookie, json, memberJson, readJson } from "@/server/http";
import { deleteAccount } from "@/server/services/account";
import { listDevices, rename } from "@/server/services/auth";

/** Who am I, which crew am I looking at, and which phones am I signed in on. */
export const GET = authedRoute(async ({ db, session }) =>
  json({
    member: memberJson(session.member),
    crew: { id: session.crew.id, name: session.crew.name, role: session.crew.role },
    devices: await listDevices(db, session),
  }),
);

/** Rename yourself: `{ name }`. */
export const PATCH = authedRoute(async ({ req, db, session }) => {
  const { name } = await readJson(req, renameInputSchema);
  const member = await rename(db, session, name);
  crewChanged();
  return json({ member: memberJson(member) });
});

/** Delete your account and everything that's yours: `{ password }`. Signs this phone out. */
export const DELETE = authedRoute(async ({ req, db, now, session }) => {
  await deleteAccount(db, session, await readJson(req, deleteAccountInputSchema), now);
  crewChanged();
  return clearSessionCookie(new NextResponse(null, { status: 204 }));
});
