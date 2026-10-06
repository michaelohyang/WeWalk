import "server-only";
import { shortName } from "@/domain/stations";
import { layoutPins, MAP_GEOMETRY, type MapGeometry, type Pin } from "@/domain/map";
import { rankStations } from "@/domain/ranking";
import type { Tag } from "@/domain/tags";
import type { Session } from "../auth";
import type { CrewData } from "../crew";
import { cards, type StationCard } from "./cards";

/* The Explore screen: map, filters and crew favorites. */

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
