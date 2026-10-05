import { idSchema } from "@/domain/schemas";
import { authedRoute, clearSessionCookie, parse } from "@/server/http";
import { signOutDevice } from "@/server/services/auth";
import { NextResponse } from "next/server";

/** Sign out one of your phones. Signing out this phone also clears its cookie. */
export const DELETE = authedRoute<{ id: string }>(async ({ db, session }, params) => {
  const id = parse(idSchema, params.id);
  await signOutDevice(db, session, id);
  const res = new NextResponse(null, { status: 204 });
  return id === session.deviceId ? clearSessionCookie(res) : res;
});
