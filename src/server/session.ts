import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { getDb } from "./db/client";
import { CREW_COOKIE, SESSION_COOKIE } from "./http";
import { authenticate, type Session } from "./services/auth";

/** The signed-in phone for this request (pages and layouts), or null. Cached per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const jar = await cookies();
  return authenticate(
    await getDb(),
    jar.get(SESSION_COOKIE)?.value,
    new Date(),
    jar.get(CREW_COOKIE)?.value,
  );
});
