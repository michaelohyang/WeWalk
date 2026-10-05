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
import { loadCrew, type CrewData, type Station } from "./crew";

/*
 * View models: exactly what each screen shows, as plain serializable data. Pages stay dumb;
 * the rules stay in domain/.
 */

export interface StationCard {
  id: string;
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
    [...crew.reviews, ...crew.checkins].filter((v) => v.memberId === me).map((v) => v.stationId),
  );
  const summaries = new Map(
    crew.stations.map((s) => [s.id, summarizeStation(s.id, crew.reviews, crew.checkins)]),
  );
  const toCard = (s: Station): StationCard => {
    const x = summaries.get(s.id)!;
    return {
      id: s.id,
      name: s.name,
      short: shortName(s.id, s.name),
      address: s.address,
      neighborhood: s.neighborhood,
      area: s.area as AreaKey,
      overall: x.score.overall,
      reviewCount: x.score.reviewCount,
      visited: x.visited,
      mine: mine.has(s.id),
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

export async function exploreView(db: Db, session: Session): Promise<ExploreView> {
  const crew = await loadCrew(db);
  const { cards: stations, summaries } = cards(crew, session.member.id);
  const scores = new Map([...summaries].map(([id, s]) => [id, s.score]));
  const ranked = rankStations(crew.stations, scores, "overall");
  const rankOf = new Map(ranked.map((r) => [r.stationId, r.rank]));
  // Label priority: rated stations first (best first), then visited, then the rest.
  const pins = layoutPins(
    crew.stations.map((s) => ({ ...s, name: shortName(s.id, s.name) })),
    {
      priority: (id) =>
        rankOf.has(id) ? 1000 - rankOf.get(id)! : summaries.get(id)!.visited ? 1 : 0,
      lit: (id) => summaries.get(id)!.visited,
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
    favorites: ranked.slice(0, 3).map((r) => r.stationId),
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
  log: { date: IsoDate; by: string; text: string }[];
}

export async function stationView(
  db: Db,
  session: Session,
  id: string,
): Promise<StationView | null> {
  const crew = await loadCrew(db);
  const station = cards(crew, session.member.id).cards.find((c) => c.id === id);
  if (!station) return null;
  const names = new Map(crew.members.map((m) => [m.id, m.name]));
  const by = (memberId: string) => names.get(memberId) ?? "someone";
  const reviews = crew.reviews.filter((r) => r.stationId === id);
  const score = scoreStation(reviews);
  const latestFirst = (a: ReviewRecord, b: ReviewRecord) =>
    b.visitedOn.localeCompare(a.visitedOn) || b.updatedAt.localeCompare(a.updatedAt);

  return {
    station,
    myCheckins: crew.checkins
      .filter((c) => c.stationId === id && c.memberId === session.member.id)
      .sort((a, b) => b.visitedOn.localeCompare(a.visitedOn))
      .map(({ id, visitedOn, note }) => ({ id, visitedOn, note })),
    categories: CATEGORY_KEYS.map((key) => ({ key, value: score.categories[key] })),
    reviews: [...reviews].sort(latestFirst).map((r) => ({
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
        .filter((c) => c.stationId === id)
        .map((c) => ({ date: c.visitedOn, by: by(c.memberId), text: c.note || "Checked in" })),
      ...reviews.map((r) => ({ date: r.visitedOn, by: by(r.memberId), text: "Posted a review" })),
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
  db: Db,
  session: Session,
  key: RankKey,
  area: AreaKey | null,
  now: Date,
): Promise<RanksView> {
  const crew = await loadCrew(db);
  const { cards: all, summaries } = cards(crew, session.member.id);
  const inArea = crew.stations.filter((s) => !area || s.area === area);
  const byId = new Map(all.map((c) => [c.id, c]));
  const scores = new Map([...summaries].map(([id, s]) => [id, s.score]));
  const month = monthOf(utcDate(now));
  const som = stationOfMonth(crew.stations, crew.reviews, crew.checkins, month);
  return {
    key,
    area,
    month,
    stationOfMonth: som && { station: byId.get(som.stationId)!, fresh: som.fresh },
    rows: rankStations(inArea, scores, key).map((r) => ({
      rank: r.rank,
      value: r.value,
      station: byId.get(r.stationId)!,
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

export async function passportView(db: Db, session: Session): Promise<PassportView> {
  const crew = await loadCrew(db);
  const { cards: all } = cards(crew, session.member.id);
  const byId = new Map(all.map((c) => [c.id, c]));
  const p = passportFor(session.member.id, crew.stations, [...crew.reviews, ...crew.checkins]);
  const stamped = new Set(p.stamps.map((s) => s.stationId));
  return {
    stamps: p.stamps.map((s) => ({ station: byId.get(s.stationId)!, firstVisit: s.firstVisit })),
    // Places the crew has been come first: they're the easy next stamps.
    notYet: all
      .filter((c) => !stamped.has(c.id))
      .sort((a, b) => Number(b.visited) - Number(a.visited) || a.name.localeCompare(b.name)),
    crewVisited: p.crewVisited,
    total: p.total,
  };
}

export interface CrewView {
  me: { id: string; name: string; isOwner: boolean };
  /** Path of the crew's invite link (`/j/<code>`), or null if joining is switched off. */
  invitePath: string | null;
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

export async function crewView(
  db: Db,
  session: Session,
  crewCode: string | null,
): Promise<CrewView> {
  const [crew, devices] = await Promise.all([loadCrew(db), listDevices(db, session)]);
  const board = crew.members.map((m) => {
    const rs = crew.reviews.filter((r) => r.memberId === m.id);
    const cs = crew.checkins.filter((c) => c.memberId === m.id);
    const hot = [...rs]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .find((r) => r.hotTake);
    return {
      memberId: m.id,
      name: m.name,
      stations: new Set([...rs, ...cs].map((v) => v.stationId)).size,
      reviews: rs.length,
      checkins: cs.length,
      hotTake: hot?.hotTake ?? null,
    };
  });
  return {
    me: { id: session.member.id, name: session.member.name, isOwner: session.member.isOwner },
    invitePath: crewCode ? `/j/${encodeURIComponent(crewCode)}` : null,
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
  stations: { id: string; name: string; neighborhood: string }[];
  /** The station being rated, if the URL named a real one. */
  stationId: string | null;
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
  visitedIds: string[];
}

export async function rateView(
  db: Db,
  session: Session,
  stationId: string | undefined,
): Promise<RateView> {
  const crew = await loadCrew(db);
  const station = crew.stations.find((s) => s.id === stationId);
  const mine =
    station &&
    crew.reviews.find((r) => r.stationId === station.id && r.memberId === session.member.id);
  const visits = [...crew.reviews, ...crew.checkins].filter(
    (v) => v.memberId === session.member.id,
  );
  return {
    stations: [...crew.stations]
      .sort((a, b) => a.name.localeCompare(b.name, "en-US", { numeric: true }))
      .map((s) => ({ id: s.id, name: s.name, neighborhood: s.neighborhood })),
    stationId: station?.id ?? null,
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
    visitedIds: [...new Set(visits.map((v) => v.stationId))],
  };
}
