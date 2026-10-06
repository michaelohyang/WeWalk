import "server-only";
import { passportFor } from "@/domain/activity";
import { badgesFor, weekStreak, type Badge } from "@/domain/badges";
import { cityDate, type IsoDate } from "@/domain/dates";
import type { Session } from "../auth";
import type { CrewData } from "../crew";
import { cards, type StationCard } from "./cards";

/* Your passport: stamps for the buildings you have been to. */

export interface PassportView {
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
): Promise<PassportView> {
  const me = session.member.id;
  const visits = [...crew.reviews, ...crew.checkins];
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
    badges: badgesFor(me, crew.stations, visits, crew.reviews).sort(
      (a, b) =>
        Number(b.earned) - Number(a.earned) ||
        b.progress.have / b.progress.need - a.progress.have / a.progress.need,
    ),
    streak: weekStreak(me, visits, cityDate(now)),
  };
}
