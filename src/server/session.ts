import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { getDb } from "./db/client";
import { SESSION_COOKIE } from "./http";
import { authenticate, type Session } from "./services/auth";

/** The signed-in phone for this request (pages and layouts), or null. Cached per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return authenticate(await getDb(), token, new Date());
});
