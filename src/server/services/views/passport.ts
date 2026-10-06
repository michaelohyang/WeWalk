import "server-only";
import { passportFor } from "@/domain/activity";
import type { IsoDate } from "@/domain/dates";
import type { Session } from "../auth";
import type { CrewData } from "../crew";
import { cards, type StationCard } from "./cards";

/* Your passport: stamps for the buildings you have been to. */

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
