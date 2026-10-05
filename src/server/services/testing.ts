import type { Db } from "../db/client";
import { authenticate, joinCrew, type Session } from "./auth";

export const CREW_CODE = "test-crew-code-0123456789";
export const NOW = new Date("2026-10-05T15:00:00Z");

let n = 0;
/** A fresh client-generated id, as the browser would make. */
export const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

/** Joins the crew as `name` and returns a session, the way a signed-in phone would have one. */
export async function signIn(db: Db, name: string): Promise<Session & { token: string }> {
  const { token } = await joinCrew(db, { code: CREW_CODE, name }, CREW_CODE);
  const session = await authenticate(db, token, NOW);
  return { ...session!, token };
}
