import "server-only";
import {
  passportFor,
  stationOfMonth,
  summarizeStation,
  type StationSummary,
} from "@/domain/activity";
import type { AreaKey } from "@/domain/areas";
import { shortName } from "@/domain/stations";
import { CATEGORY_KEYS, type CategoryKey } from "@/domain/categories";
import { monthOf, utcDate, type IsoDate } from "@/domain/dates";
import { layoutPins, MAP_GEOMETRY, type MapGeometry, type Pin } from "@/domain/map";
import { rankStations, type RankKey } from "@/domain/ranking";
import type { ReviewRecord } from "@/domain/records";
import { personOverall, scoreStation } from "@/domain/scoring";
import type { Tag } from "@/domain/tags";
import type { Db } from "../db/client";
import { listDevices, type Session } from "./auth";
import type { CrewData, Station } from "./crew";

/*
 * View models: exactly what each screen shows, as plain serializable data. Pages stay dumb;
 * the rules stay in domain/.
 */

export interface StationCard {
  slug: string;
  name: string;
  /** "450 Lex": for the map and stamps. */
  short: string;
  address: string;
  neighborhood: string;
  area: AreaKey;
  overall: number | null;
  reviewCount: number;
  /** Anyone in the crew has been. */
  visited: boolean;
  /** You have been. */
  mine: boolean;
  lastVisit: IsoDate | null;
  hotTake: { text: string; by: string } | null;
  tags: Tag[];
}

function cards(
  crew: CrewData,
  me: string,
): { cards: StationCard[]; summaries: Map<string, StationSummary> } {
  const names = new Map(crew.members.map((m) => [m.id, m.name]));
  const mine = new Set(
    [...crew.reviews, ...crew.checkins].filter((v) => v.memberId === me).map((v) => v.stationSlug),
  );
  const summaries = new Map(
    crew.stations.map((s) => [s.slug, summarizeStation(s.slug, crew.reviews, crew.checkins)]),
  );
  const toCard = (s: Station): StationCard => {
    const x = summaries.get(s.slug)!;
    return {
      slug: s.slug,
      name: s.name,
      short: shortName(s.slug, s.name),
      address: s.address,
      neighborhood: s.neighborhood,
      area: s.area as AreaKey,
      overall: x.score.overall,
      reviewCount: x.score.reviewCount,
      visited: x.visited,
      mine: mine.has(s.slug),
      lastVisit: x.lastVisit,
      hotTake: x.hotTake && {
        text: x.hotTake.text,
        by: names.get(x.hotTake.memberId) ?? "someone",
      },
      tags: x.tags.map((t) => t.tag),
    };
  };
  return { cards: crew.stations.map(toCard), summaries };
}

export interface ExploreView {
  stations: StationCard[];
  map: MapGeometry;
  pins: Pin[];
  /** Tags someone has used, most common first. */
  tags: Tag[];
  visited: number;
  /** Top three by overall. */
  favorites: string[];
}

export async function exploreView(crew: CrewData, session: Session): Promise<ExploreView> {
  const { cards: stations, summaries } = cards(crew, session.member.id);
  const scores = new Map([...summaries].map(([slug, s]) => [slug, s.score]));
  const ranked = rankStations(crew.stations, scores, "overall");
  const rankOf = new Map(ranked.map((r) => [r.stationSlug, r.rank]));
  // Label priority: rated stations first (best first), then visited, then the rest.
  const pins = layoutPins(
    crew.stations.map((s) => ({ ...s, name: shortName(s.slug, s.name) })),
    {
      priority: (slug) =>
        rankOf.has(slug) ? 1000 - rankOf.get(slug)! : summaries.get(slug)!.visited ? 1 : 0,
      lit: (slug) => summaries.get(slug)!.visited,
    },
  );
  const tagCounts = new Map<Tag, number>();
  for (const s of summaries.values())
    for (const t of s.tags) tagCounts.set(t.tag, (tagCounts.get(t.tag) ?? 0) + t.count);
  return {
    stations,
    map: MAP_GEOMETRY,
    pins,
    tags: [...tagCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t),
    visited: stations.filter((s) => s.visited).length,
    favorites: ranked.slice(0, 3).map((r) => r.stationSlug),
  };
}

export interface ReviewView {
  id: string;
  memberId: string;
  by: string;
  visitedOn: IsoDate;
  overall: number | null;
  hotTake: string;
  body: string;
  tags: Tag[];
  mine: boolean;
}

export interface StationView {
  station: StationCard;
  /** Your check-ins here (newest first), so the page knows if you're checked in today. */
  myCheckins: { id: string; visitedOn: IsoDate; note: string }[];
  categories: { key: CategoryKey; value: number | null }[];
  reviews: ReviewView[];
  /** Check-ins and reviews, newest first. */
  log: { date: IsoDate; by: string; mine: boolean; kind: "checkin" | "review"; note: string }[];
}

export async function stationView(
  crew: CrewData,
  session: Session,
  slug: string,
): Promise<StationView | null> {
  const station = cards(crew, session.member.id).cards.find((c) => c.slug === slug);
  if (!station) return null;
  const names = new Map(crew.members.map((m) => [m.id, m.name]));
  const by = (memberId: string) => names.get(memberId) ?? "someone";
  const me = session.member.id;
  const reviews = crew.reviews.filter((r) => r.stationSlug === slug);
  const score = scoreStation(reviews);
  const latestFirst = (a: ReviewRecord, b: ReviewRecord) =>
    b.visitedOn.localeCompare(a.visitedOn) || b.updatedAt.localeCompare(a.updatedAt);

  return {
    station,
    myCheckins: crew.checkins
      .filter((c) => c.stationSlug === slug && c.memberId === session.member.id)
      .sort((a, b) => b.visitedOn.localeCompare(a.visitedOn))
      .map(({ id, visitedOn, note }) => ({ id, visitedOn, note })),
    categories: CATEGORY_KEYS.map((key) => ({ key, value: score.categories[key] })),
    // Yours first: after posting you land here and should see it without scrolling.
    reviews: [...reviews]
      .sort((a, b) => Number(b.memberId === me) - Number(a.memberId === me) || latestFirst(a, b))
      .map((r) => ({
        id: r.id,
        memberId: r.memberId,
        by: by(r.memberId),
        visitedOn: r.visitedOn,
        overall: personOverall(r.scores),
        hotTake: r.hotTake,
        body: r.body,
        tags: r.tags,
        mine: r.memberId === session.member.id,
      })),
    log: [
      ...crew.checkins
        .filter((c) => c.stationSlug === slug)
        .map((c) => ({
          date: c.visitedOn,
          by: by(c.memberId),
          mine: c.memberId === me,
          kind: "checkin" as const,
          note: c.note,
        })),
      ...reviews.map((r) => ({
        date: r.visitedOn,
        by: by(r.memberId),
        mine: r.memberId === me,
        kind: "review" as const,
        note: "",
      })),
    ].sort((a, b) => b.date.localeCompare(a.date)),
  };
}

export interface RanksView {
  key: RankKey;
  area: AreaKey | null;
  month: string;
  stationOfMonth: { station: StationCard; fresh: boolean } | null;
  rows: { rank: number; value: number; station: StationCard }[];
  unrated: number;
}

/** Rankings by `key`, optionally within one area. Station of the Month is always crew-wide. */
export async function ranksView(
  crew: CrewData,
  session: Session,
  key: RankKey,
  area: AreaKey | null,
  now: Date,
): Promise<RanksView> {
  const { cards: all, summaries } = cards(crew, session.member.id);
  const inArea = crew.stations.filter((s) => !area || s.area === area);
  const bySlug = new Map(all.map((c) => [c.slug, c]));
  const scores = new Map([...summaries].map(([slug, s]) => [slug, s.score]));
  const month = monthOf(utcDate(now));
  const som = stationOfMonth(crew.stations, crew.reviews, crew.checkins, month);
  return {
    key,
    area,
    month,
    stationOfMonth: som && { station: bySlug.get(som.stationSlug)!, fresh: som.fresh },
    rows: rankStations(inArea, scores, key).map((r) => ({
      rank: r.rank,
      value: r.value,
      station: bySlug.get(r.stationSlug)!,
    })),
    unrated: all.filter((c) => c.overall === null && (!area || c.area === area)).length,
  };
}

export interface PassportView {
  stamps: { station: StationCard; firstVisit: IsoDate }[];
  notYet: StationCard[];
  crewVisited: number;
  total: number;
}

export async function passportView(crew: CrewData, session: Session): Promise<PassportView> {
  const { cards: all } = cards(crew, session.member.id);
  const bySlug = new Map(all.map((c) => [c.slug, c]));
  const p = passportFor(session.member.id, crew.stations, [...crew.reviews, ...crew.checkins]);
  const stamped = new Set(p.stamps.map((s) => s.stationSlug));
  return {
    stamps: p.stamps.map((s) => ({
      station: bySlug.get(s.stationSlug)!,
      firstVisit: s.firstVisit,
    })),
    // Places the crew has been come first: they're the easy next stamps.
    notYet: all
      .filter((c) => !stamped.has(c.slug))
      .sort((a, b) => Number(b.visited) - Number(a.visited) || a.name.localeCompare(b.name)),
    crewVisited: p.crewVisited,
    total: p.total,
  };
}

export interface CrewView {
  me: { id: string; name: string; isOwner: boolean; hasPassword: boolean };
  /** Everyone, for the owner's recovery links. Empty for non-owners. */
  members: { id: string; name: string }[];
  devices: { id: string; label: string; lastSeenAt: string; current: boolean }[];
  leaderboard: {
    memberId: string;
    name: string;
    stations: number;
    reviews: number;
    checkins: number;
    hotTake: string | null;
  }[];
}

export async function crewView(crew: CrewData, db: Db, session: Session): Promise<CrewView> {
  const devices = await listDevices(db, session);
  const board = crew.members.map((m) => {
    const rs = crew.reviews.filter((r) => r.memberId === m.id);
    const cs = crew.checkins.filter((c) => c.memberId === m.id);
    const hot = [...rs]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .find((r) => r.hotTake);
    return {
      memberId: m.id,
      name: m.name,
      stations: new Set([...rs, ...cs].map((v) => v.stationSlug)).size,
      reviews: rs.length,
      checkins: cs.length,
      hotTake: hot?.hotTake ?? null,
    };
  });
  return {
    me: {
      id: session.member.id,
      name: session.member.name,
      isOwner: session.member.isOwner,
      hasPassword: session.member.hasPassword,
    },
    members: session.member.isOwner ? crew.members.filter((m) => m.id !== session.member.id) : [],
    devices: devices.map((d) => ({
      id: d.id,
      label: d.label,
      lastSeenAt: d.lastSeenAt.toISOString(),
      current: d.current,
    })),
    leaderboard: board
      .filter((b) => b.stations > 0)
      .sort(
        (a, b) => b.stations - a.stations || b.reviews - a.reviews || a.name.localeCompare(b.name),
      ),
  };
}

export interface RateView {
  /** Everything you can rate, A–Z. */
  stations: { slug: string; name: string; neighborhood: string }[];
  /** The station being rated, if the URL named a real one. */
  stationSlug: string | null;
  /** Your existing review of it: the form opens in edit mode. */
  existing: {
    id: string;
    visitedOn: IsoDate;
    scores: ReviewRecord["scores"];
    hotTake: string;
    body: string;
    tags: Tag[];
  } | null;
  /** Stations you've been to (for the "first visit: new stamp" moment). */
  visitedSlugs: string[];
  /** Your latest check-ins at buildings you haven't reviewed, newest first: likely next to rate. */
  toReview: { stationSlug: string; visitedOn: IsoDate }[];
}

export async function rateView(
  crew: CrewData,
  session: Session,
  stationSlug: string | undefined,
): Promise<RateView> {
  const station = crew.stations.find((s) => s.slug === stationSlug);
  const mine =
    station &&
    crew.reviews.find((r) => r.stationSlug === station.slug && r.memberId === session.member.id);
  const visits = [...crew.reviews, ...crew.checkins].filter(
    (v) => v.memberId === session.member.id,
  );
  return {
    stations: [...crew.stations]
      .sort((a, b) => a.name.localeCompare(b.name, "en-US", { numeric: true }))
      .map((s) => ({ slug: s.slug, name: s.name, neighborhood: s.neighborhood })),
    stationSlug: station?.slug ?? null,
    existing: mine
      ? {
          id: mine.id,
          visitedOn: mine.visitedOn,
          scores: mine.scores,
          hotTake: mine.hotTake,
          body: mine.body,
          tags: mine.tags,
        }
      : null,
    visitedSlugs: [...new Set(visits.map((v) => v.stationSlug))],
    toReview: toReview(crew, session.member.id),
  };
}

function toReview(crew: CrewData, me: string): RateView["toReview"] {
  const reviewed = new Set(crew.reviews.filter((r) => r.memberId === me).map((r) => r.stationSlug));
  const seen = new Set<string>();
  return crew.checkins
    .filter((c) => c.memberId === me && !reviewed.has(c.stationSlug))
    .sort((a, b) => b.visitedOn.localeCompare(a.visitedOn))
    .filter((c) => !seen.has(c.stationSlug) && !!seen.add(c.stationSlug))
    .slice(0, 3)
    .map((c) => ({ stationSlug: c.stationSlug, visitedOn: c.visitedOn }));
}
