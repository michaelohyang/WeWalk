import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { crews, FIRST_CREW_ID } from "../db/schema";
import { authenticate, signUp, type Session } from "./auth";

export const NOW = new Date("2026-10-05T15:00:00Z");
export const PASSWORD = "correct horse battery";

let n = 0;
/** A fresh client-generated id, as the browser would make. */
export const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

/** The first crew's invite code: signing up with it joins that crew, as an invite link would. */
export async function firstCrewInvite(db: Db): Promise<string> {
  const [crew] = await db
    .select({ code: crews.inviteCode })
    .from(crews)
    .where(eq(crews.id, FIRST_CREW_ID));
  return crew!.code;
}

/** Signs up as `name` into the first crew and returns a session, the way a logged-in phone would have one. */
export async function signIn(db: Db, name: string): Promise<Session & { token: string }> {
  const { token } = await signUp(db, { name, password: PASSWORD, code: await firstCrewInvite(db) });
  const session = await authenticate(db, token, NOW);
  return { ...session!, token };
}
