import "server-only";
import type { Session } from "../auth";
import type { CrewData } from "../crew";
import { cards, type StationCard } from "./cards";

/* The map screen: every station on the map with what its pin and card show. */

export type MapStation = Pick<
  StationCard,
  | "slug"
  | "name"
  | "short"
  | "neighborhood"
  | "area"
  | "overall"
  | "reviewCount"
  | "visited"
  | "mine"
> & { lat: number; lng: number };

export interface MapView {
  stations: MapStation[];
}

export function mapView(crew: CrewData, session: Session): MapView {
  return { stations: mapStations(crew, cards(crew, session.member.id).cards) };
}

/** Station cards plus their positions: for screens that already have the cards (Home). */
export function mapStations(crew: CrewData, stationCards: StationCard[]): MapStation[] {
  const positions = new Map(crew.stations.map((s) => [s.slug, s]));
  return stationCards.map((c) => {
    const { lat, lng } = positions.get(c.slug)!;
    return {
      slug: c.slug,
      name: c.name,
      short: c.short,
      neighborhood: c.neighborhood,
      area: c.area,
      overall: c.overall,
      reviewCount: c.reviewCount,
      visited: c.visited,
      mine: c.mine,
      lat,
      lng,
    };
  });
}
