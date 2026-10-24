import "server-only";
import { cityOf, isArea, type CityKey } from "@/domain/areas";
import type { CrewData } from "../crew";

/**
 * The crew's data narrowed to one city: its stations, and the visits and reactions there.
 * Members stay whole, so names still resolve. For screens that show one city at a time.
 */
export function inCity(crew: CrewData, city: CityKey): CrewData {
  const stations = crew.stations.filter((s) => isArea(s.area) && cityOf(s.area) === city);
  const here = new Set(stations.map((s) => s.slug));
  const reviews = crew.reviews.filter((r) => here.has(r.stationSlug));
  const shown = new Set(reviews.map((r) => r.id));
  return {
    ...crew,
    stations,
    reviews,
    checkins: crew.checkins.filter((c) => here.has(c.stationSlug)),
    reactions: crew.reactions.filter((r) => shown.has(r.reviewId)),
  };
}
