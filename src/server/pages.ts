import "server-only";
import { cookies } from "next/headers";
import { CITY_COOKIE, DEFAULT_CITY, isCity, type AreaKey, type CityKey } from "@/domain/areas";
import type { RankKey } from "@/domain/ranking";
import { getDb } from "./db/client";
import { crewData } from "./crew-cache";
import { getSession } from "./session";
import { isAdmin, peekLink } from "./services/auth";
import {
  crewView,
  exploreView,
  mapView,
  passportView,
  ranksView,
  rateView,
  stationAdminView,
  stationView,
} from "./services/views";
import { inCity } from "./services/views/city";

/** The city this phone is looking at (a cookie the city switch sets); unknown values mean NYC. */
export async function selectedCity(): Promise<CityKey> {
  const value = (await cookies()).get(CITY_COOKIE)?.value;
  return isCity(value) ? value : DEFAULT_CITY;
}

/*
 * Data loaders for pages. Each one checks the session itself: layouts and pages render in
 * parallel, so the layout's sign-in gate doesn't protect a page's data. They return null when
 * signed out; the layout shows the members-only screen in that case.
 */

export async function loadExplore() {
  const session = await getSession();
  if (!session) return null;
  return exploreView(await crewData(), session, new Date(), await selectedCity());
}

/** `undefined` when signed out, `null` when the station doesn't exist (or is hidden). */
export async function loadStation(slug: string) {
  const session = await getSession();
  if (!session) return undefined;
  return stationView(await crewData(), session, slug);
}

export async function loadRanks(key: RankKey, area: AreaKey | null, city: CityKey) {
  const session = await getSession();
  if (!session) return null;
  return ranksView(inCity(await crewData(), city), session, key, area, new Date());
}

export async function loadMap() {
  const session = await getSession();
  if (!session) return null;
  const city = await selectedCity();
  return { ...mapView(inCity(await crewData(), city), session), city };
}

export async function loadPassport() {
  const session = await getSession();
  if (!session) return null;
  return passportView(await crewData(), session, new Date(), await selectedCity());
}

export async function loadCrew() {
  const session = await getSession();
  if (!session) return null;
  return crewView(await crewData(), await getDb(), session);
}

export async function loadRate(stationSlug: string | undefined) {
  const session = await getSession();
  if (!session) return null;
  return rateView(await crewData(), session, stationSlug);
}

/** The building admin: `undefined` when signed out, `null` for anyone who isn't an admin. */
export async function loadStationAdmin() {
  const session = await getSession();
  if (!session) return undefined;
  if (!isAdmin(session)) return null;
  return stationAdminView(await getDb(), session);
}

/** The recovery page: who the link signs in as (null if it's dead), and who's signed in now. */
export async function loadRecoveryLink(token: string) {
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
