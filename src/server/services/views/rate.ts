import "server-only";
import { cityOf, DEFAULT_CITY, isArea, type CityKey } from "@/domain/areas";
import type { IsoDate } from "@/domain/dates";
import type { ReviewRecord } from "@/domain/records";
import type { Tag } from "@/domain/tags";
import type { Session } from "../auth";
import type { CrewData, MyVisits } from "../crew";

/* The rate form: what you can rate, your existing review, and likely next ones. */

export interface RateView {
  /** Everything you can rate, A–Z. */
  stations: { slug: string; name: string; address: string; neighborhood: string; city: CityKey }[];
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
    photoUrl: string | null;
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
  myVisits: MyVisits,
): Promise<RateView> {
  const station = crew.stations.find((s) => s.slug === stationSlug);
  // Your review of a building is one review, whichever crew you posted it in: saving it here
  // shares it with this crew too.
  const mine = station && myVisits.reviews.find((r) => r.stationSlug === station.slug);
  const visits = [...myVisits.reviews, ...myVisits.checkins];
  return {
    stations: [...crew.stations]
      .sort((a, b) => a.name.localeCompare(b.name, "en-US", { numeric: true }))
      .map((s) => ({
        slug: s.slug,
        name: s.name,
        address: s.address,
        neighborhood: s.neighborhood,
        city: isArea(s.area) ? cityOf(s.area) : DEFAULT_CITY,
      })),
    stationSlug: station?.slug ?? null,
    existing: mine
      ? {
          id: mine.id,
          visitedOn: mine.visitedOn,
          scores: mine.scores,
          hotTake: mine.hotTake,
          body: mine.body,
          tags: mine.tags,
          photoUrl: mine.photoUrl,
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
