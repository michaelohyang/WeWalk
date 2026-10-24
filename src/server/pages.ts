import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CITY_COOKIE, DEFAULT_CITY, isCity, type AreaKey, type CityKey } from "@/domain/areas";
import type { RankKey } from "@/domain/ranking";
import { getDb } from "./db/client";
import { crewData } from "./crew-cache";
import { getSession } from "./session";
import { isAdmin, peekLink, type Session } from "./services/auth";
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
import { crewCreationEnabled, crewForInvite } from "./services/crews";
import { loadMyVisits } from "./services/crew";

/**
 * The crew a page is for. Someone who hasn't finished the welcome steps, or is in no crew (they
 * left their last one), goes to /welcome.
 */
function crewFor(session: Session) {
  if (!session.member.onboardedAt) redirect("/welcome");
  return session.crew ?? redirect("/welcome");
}

/** The city this phone is looking at (a cookie the city switch sets); unknown values mean NYC. */
export async function selectedCity(): Promise<CityKey> {
  const value = (await cookies()).get(CITY_COOKIE)?.value;
  return isCity(value) ? value : DEFAULT_CITY;
}

async function hasCityCookie(): Promise<boolean> {
  return isCity((await cookies()).get(CITY_COOKIE)?.value);
}

/*
 * Data loaders for pages. Each one checks the session itself: layouts and pages render in
 * parallel, so the layout's sign-in gate doesn't protect a page's data. They return null when
 * signed out; the layout shows the members-only screen in that case.
 */

export async function loadExplore() {
  const session = await getSession();
  if (!session) return null;
  return exploreView(
    await crewData(crewFor(session).id),
    session,
    new Date(),
    await selectedCity(),
  );
}

/** `undefined` when signed out, `null` when the station doesn't exist (or is hidden). */
export async function loadStation(slug: string) {
  const session = await getSession();
  if (!session) return undefined;
  return stationView(await crewData(crewFor(session).id), session, slug);
}

export async function loadRanks(key: RankKey, area: AreaKey | null, city: CityKey) {
  const session = await getSession();
  if (!session) return null;
  return ranksView(
    inCity(await crewData(crewFor(session).id), city),
    session,
    key,
    area,
    new Date(),
  );
}

export async function loadMap() {
  const session = await getSession();
  if (!session) return null;
  const city = await selectedCity();
  return { ...mapView(inCity(await crewData(crewFor(session).id), city), session), city };
}

export async function loadPassport() {
  const session = await getSession();
  if (!session) return null;
  return passportView(
    await crewData(crewFor(session).id),
    session,
    new Date(),
    await selectedCity(),
    await loadMyVisits(await getDb(), session.member.id),
  );
}

export async function loadCrew() {
  const session = await getSession();
  if (!session) return null;
  return crewView(await crewData(crewFor(session).id), await getDb(), session);
}

export async function loadRate(stationSlug: string | undefined) {
  const session = await getSession();
  if (!session) return null;
  return rateView(
    await crewData(crewFor(session).id),
    session,
    stationSlug,
    await loadMyVisits(await getDb(), session.member.id),
  );
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

/** The join page: signed in or not, and which crew the code names (null if it doesn't work). */
export async function loadJoin(code: string) {
  const session = await getSession();
  if (!session) return { signedIn: false as const };
  return { signedIn: true as const, crew: await crewForInvite(await getDb(), code) };
}

/** /welcome: the welcome steps for someone new, or picking a crew for someone in none. */
export async function loadWelcome() {
  const session = await getSession();
  if (!session) redirect("/login");
  const onboarded = !!session.member.onboardedAt;
  if (session.crew && onboarded) redirect("/");
  return {
    name: session.member.name,
    /** This phone's sign-in, so they can sign out from here. */
    deviceId: session.deviceId,
    canStartCrew: crewCreationEnabled(),
    /** New here: the city and first-rating steps too, not just picking a crew. */
    onboarded,
    /** The crew they're in already (they came from an invite link): the crew step is skipped. */
    crew: session.crew && { name: session.crew.name },
    /** The phone's city, or the crew's home city if the phone hasn't picked one. */
    city: (await hasCityCookie()) ? await selectedCity() : (session.crew?.homeCity ?? DEFAULT_CITY),
  };
}
