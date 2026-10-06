import "server-only";
import { stationOfMonth } from "@/domain/activity";
import type { AreaKey } from "@/domain/areas";
import { monthOf, utcDate } from "@/domain/dates";
import { rankStations, type RankKey } from "@/domain/ranking";
import { mostDivisive } from "@/domain/taste";
import type { Session } from "../auth";
import type { CrewData } from "../crew";
import { cards, type StationCard } from "./cards";

/* The Ranks screen, with Station of the Month. */

export interface RanksView {
  key: RankKey;
  area: AreaKey | null;
  month: string;
  stationOfMonth: { station: StationCard; fresh: boolean } | null;
  rows: { rank: number; value: number; station: StationCard }[];
  unrated: number;
  /** The buildings that split the crew most (crew-wide, like Station of the Month). */
  divisive: {
    station: StationCard;
    spread: number;
    high: { name: string; score: number };
    low: { name: string; score: number };
  }[];
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
    divisive: mostDivisive(crew.reviews).map((d) => {
      const name = (id: string) => crew.members.find((m) => m.id === id)?.name ?? "someone";
      return {
        station: bySlug.get(d.stationSlug)!,
        spread: d.spread,
        high: { name: name(d.high.memberId), score: d.high.score },
        low: { name: name(d.low.memberId), score: d.low.score },
      };
    }),
  };
}
