import "server-only";
import type { AreaKey } from "@/domain/areas";
import type { RankKey } from "@/domain/ranking";
import { getDb } from "./db/client";
import { getSession } from "./session";
import { MIN_CREW_CODE_LENGTH } from "./services/auth";
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
  return exploreView(await getDb(), session);
}

/** `undefined` when signed out, `null` when the station doesn't exist (or is hidden). */
export async function loadStation(id: string) {
  const session = await getSession();
  if (!session) return undefined;
  return stationView(await getDb(), session, id);
}

export async function loadRanks(key: RankKey, area: AreaKey | null) {
  const session = await getSession();
  if (!session) return null;
  return ranksView(await getDb(), session, key, area, new Date());
}

export async function loadPassport() {
  const session = await getSession();
  if (!session) return null;
  return passportView(await getDb(), session);
}

export async function loadCrew() {
  const session = await getSession();
  if (!session) return null;
  const code = process.env.CREW_CODE;
  return crewView(
    await getDb(),
    session,
    code && code.length >= MIN_CREW_CODE_LENGTH ? code : null,
  );
}

export async function loadRate(stationId: string | undefined) {
  const session = await getSession();
  if (!session) return null;
  return rateView(await getDb(), session, stationId);
}
