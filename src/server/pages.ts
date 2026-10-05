import "server-only";
import type { AreaKey } from "@/domain/areas";
import type { RankKey } from "@/domain/ranking";
import { getDb } from "./db/client";
import { crewData } from "./crew-cache";
import { getSession } from "./session";
import { peekLink } from "./services/auth";
import {
  crewView,
  exploreView,
  passportView,
  ranksView,
  rateView,
  stationView,
} from "./services/views";

/*
 * Data loaders for pages. Each one checks the session itself: layouts and pages render in
 * parallel, so the layout's sign-in gate doesn't protect a page's data. They return null when
 * signed out; the layout shows the members-only screen in that case.
 */

export async function loadExplore() {
  const session = await getSession();
  if (!session) return null;
  return exploreView(await crewData(), session);
}

/** `undefined` when signed out, `null` when the station doesn't exist (or is hidden). */
export async function loadStation(id: string) {
  const session = await getSession();
  if (!session) return undefined;
  return stationView(await crewData(), session, id);
}

export async function loadRanks(key: RankKey, area: AreaKey | null) {
  const session = await getSession();
  if (!session) return null;
  return ranksView(await crewData(), session, key, area, new Date());
}

export async function loadPassport() {
  const session = await getSession();
  if (!session) return null;
  return passportView(await crewData(), session);
}

export async function loadCrew() {
  const session = await getSession();
  if (!session) return null;
  return crewView(await crewData(), await getDb(), session);
}

export async function loadRate(stationId: string | undefined) {
  const session = await getSession();
  if (!session) return null;
  return rateView(await crewData(), session, stationId);
}

/** The pairing page: who the link signs in as (null if it's dead), and who's signed in now. */
export async function loadPair(token: string) {
  const [session, link] = await Promise.all([
    getSession(),
    peekLink(await getDb(), token, new Date()),
  ]);
  return { link, signedInAs: session?.member.name ?? null };
}

/** Login and signup pages: only for people who aren't signed in. */
export async function isSignedIn() {
  return !!(await getSession());
}
