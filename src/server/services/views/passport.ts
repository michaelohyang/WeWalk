import "server-only";
import { passportFor } from "@/domain/activity";
import { badgesFor, weekStreak, type Badge } from "@/domain/badges";
import { cityOf, isArea, type CityKey } from "@/domain/areas";
import { cityDate, type IsoDate } from "@/domain/dates";
import type { Session } from "../auth";
import type { CrewData, MyVisits } from "../crew";
import { cards, type StationCard } from "./cards";
import { inCity } from "./city";

/* Your passport: stamps for the buildings you have been to. */

export interface PassportView {
  /** Stamps, progress and area badges are for this city; milestones count every city. */
  city: CityKey;
  stamps: { station: StationCard; firstVisit: IsoDate }[];
  notYet: StationCard[];
  crewVisited: number;
  total: number;
  /** Earned first, then the closest to earning. */
  badges: Badge[];
  streak: { weeks: number; thisWeek: boolean };
}

export async function passportView(
  crew: CrewData,
  session: Session,
  now: Date,
  city: CityKey,
  myVisits: MyVisits,
): Promise<PassportView> {
  const me = session.member.id;
  // Your stamps, badges and streak count your visits in every crew; the crew's own visits add
  // what the crew has been to (each visit once).
  const byId = new Map(
    [...crew.reviews, ...crew.checkins, ...myVisits.reviews, ...myVisits.checkins].map((v) => [
      v.id,
      v,
    ]),
  );
  const visits = [...byId.values()];
  const { cards: everywhere } = cards(crew, session.member.id);
  const all = everywhere.filter((c) => cityOf(c.area) === city);
  const bySlug = new Map(all.map((c) => [c.slug, c]));
  const p = passportFor(session.member.id, inCity(crew, city).stations, visits);
  // "All of <area>" badges for this city's areas only; the rest count everywhere.
  const shown = (b: Badge) => {
    const area = b.key.startsWith("area-") ? b.key.slice(5) : null;
    return !area || (isArea(area) && cityOf(area) === city);
  };
  const stamped = new Set(p.stamps.map((s) => s.stationSlug));
  return {
    city,
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
    badges: badgesFor(me, crew.stations, visits, crew.reviews)
      .filter(shown)
      .sort(
        (a, b) =>
          Number(b.earned) - Number(a.earned) ||
          b.progress.have / b.progress.need - a.progress.have / a.progress.need,
      ),
    streak: weekStreak(me, visits, cityDate(now)),
  };
}
