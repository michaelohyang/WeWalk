import "server-only";
import { summarizeStation, type StationSummary } from "@/domain/activity";
import type { AreaKey } from "@/domain/areas";
import { shortName } from "@/domain/stations";
import type { IsoDate } from "@/domain/dates";
import type { Tag } from "@/domain/tags";
import type { CrewData, Station } from "../crew";

/* A station as every list and the map show it, plus the per-station summaries behind it. */

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

export function cards(
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
