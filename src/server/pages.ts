import "server-only";
import type { RankKey } from "@/domain/ranking";
import { getDb } from "./db/client";
import { getSession } from "./session";
import { crewView, exploreView, passportView, ranksView, stationView } from "./services/views";

/*
 * Data loaders for pages. Each one checks the session itself: layouts and pages render in
 * parallel, so the layout's sign-in gate doesn't protect a page's data. They return null when
 * signed out; the layout shows the members-only screen in that case.
 */

export async function loadExplore() {
  if (!(await getSession())) return null;
  return exploreView(await getDb());
}

/** `undefined` when signed out, `null` when the station doesn't exist (or is hidden). */
export async function loadStation(id: string) {
  const session = await getSession();
  if (!session) return undefined;
  return stationView(await getDb(), session, id);
}

export async function loadRanks(key: RankKey) {
  if (!(await getSession())) return null;
  return ranksView(await getDb(), key, new Date());
}

export async function loadPassport() {
  const session = await getSession();
  if (!session) return null;
  return passportView(await getDb(), session);
}

export async function loadCrew() {
  const session = await getSession();
  if (!session) return null;
  return crewView(await getDb(), session);
}
