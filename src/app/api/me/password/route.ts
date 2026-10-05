import { NextResponse } from "next/server";
import { setPasswordInputSchema } from "@/domain/schemas";
import { authedRoute, readJson } from "@/server/http";
import { setPassword } from "@/server/services/auth";

/** Set or change your password: `{ current?, password }`. */
export const PUT = authedRoute(async ({ req, db, session }) => {
  await setPassword(db, session, await readJson(req, setPasswordInputSchema));
  return new NextResponse(null, { status: 204 });
});
