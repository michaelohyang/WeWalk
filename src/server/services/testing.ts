import type { Db } from "../db/client";
import { authenticate, signUp, type Session } from "./auth";

export const NOW = new Date("2026-10-05T15:00:00Z");
export const PASSWORD = "correct horse battery";

let n = 0;
/** A fresh client-generated id, as the browser would make. */
export const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

/** Signs up as `name` and returns a session, the way a logged-in phone would have one. */
export async function signIn(db: Db, name: string): Promise<Session & { token: string }> {
  const { token } = await signUp(db, { name, password: PASSWORD });
  const session = await authenticate(db, token, NOW);
  return { ...session!, token };
}
