import "server-only";
import { AREAS, type AreaKey } from "@/domain/areas";
import { cityDate } from "@/domain/dates";
import { crewFeed } from "@/domain/feed";
import { summarizeReactions, type ReactionSummary } from "@/domain/reactions";
import { rankStations } from "@/domain/ranking";
import { personOverall } from "@/domain/scoring";
import type { Tag } from "@/domain/tags";
import { hereToday } from "@/domain/today";
import type { Session } from "../auth";
import type { CrewData } from "../crew";
import { cards, type StationCard } from "./cards";

/* The home screen: who's out today, the areas at a glance, and what the crew's been up to. */

interface Who {
  memberId: string;
  by: string;
  mine: boolean;
}
type FeedStation = { slug: string; name: string; area: AreaKey };

export type FeedEntry =
  | (Who & {
      kind: "review";
      id: string;
      /** ISO timestamp: when it was last written. */
      at: string;
      station: FeedStation;
      overall: number | null;
      hotTake: string;
      photoUrl: string | null;
      reactions: ReactionSummary[];
    })
  | (Who & { kind: "checkin"; id: string; at: string; station: FeedStation; note: string });

export interface AreaTile {
  key: AreaKey;
  label: string;
  /** Buildings in the area. */
  total: number;
  /** How many of them you've been to. */
  mine: number;
  /** Its best-scored building, if anything there is rated. */
  best: { slug: string; name: string; overall: number } | null;
}

export interface ExploreView {
  stations: StationCard[];
  /** Tags someone has used, most common first. */
  tags: Tag[];
  /** Who in the crew is where today (New York's date), latest check-in first. */
  hereToday: {
    memberId: string;
    name: string;
    mine: boolean;
    stationSlug: string;
    stationName: string;
    /** ISO timestamp of the check-in. */
    since: string;
  }[];
  areas: AreaTile[];
  /** The crew's latest reviews and check-ins, newest first. */
  feed: FeedEntry[];
}

export async function exploreView(
  crew: CrewData,
  session: Session,
  now: Date,
): Promise<ExploreView> {
  const me = session.member.id;
  const { cards: stations, summaries } = cards(crew, me);
  const bySlug = new Map(stations.map((s) => [s.slug, s]));
  const names = new Map(crew.members.map((m) => [m.id, m.name]));
  const nameOf = (id: string) => names.get(id) ?? "someone";
  const who = (memberId: string): Who => ({
    memberId,
    by: nameOf(memberId),
    mine: memberId === me,
  });
  const place = (slug: string): FeedStation => {
    const s = bySlug.get(slug)!;
    return { slug, name: s.short, area: s.area };
  };
  const scores = new Map([...summaries].map(([slug, s]) => [slug, s.score]));

  const tagCounts = new Map<Tag, number>();
  for (const s of summaries.values())
    for (const t of s.tags) tagCounts.set(t.tag, (tagCounts.get(t.tag) ?? 0) + t.count);

  return {
    stations,
    tags: [...tagCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t),
    hereToday: hereToday(crew.checkins, cityDate(now)).flatMap((h) => {
      const card = bySlug.get(h.stationSlug);
      if (!card) return [];
      return [
        {
          memberId: h.memberId,
          name: nameOf(h.memberId),
          mine: h.memberId === me,
          stationSlug: h.stationSlug,
          stationName: card.short,
          since: h.since,
        },
      ];
    }),
    areas: AREAS.map((a) => {
      const here = crew.stations.filter((s) => s.area === a.key);
      const top = rankStations(here, scores, "overall")[0];
      const best = top && bySlug.get(top.stationSlug)!;
      return {
        key: a.key,
        label: a.label,
        total: here.length,
        mine: here.filter((s) => bySlug.get(s.slug)!.mine).length,
        best: best ? { slug: best.slug, name: best.short, overall: best.overall! } : null,
      };
    }).filter((a) => a.total > 0),
    feed: crewFeed(crew.reviews, crew.checkins).map((item): FeedEntry => {
      if (item.kind === "review") {
        const r = item.review;
        return {
          kind: "review",
          id: r.id,
          at: item.at,
          ...who(r.memberId),
          station: place(r.stationSlug),
          overall: personOverall(r.scores),
          hotTake: r.hotTake,
          photoUrl: r.photoUrl,
          reactions: summarizeReactions(crew.reactions, r.id, me, nameOf),
        };
      }
      const c = item.checkin;
      return {
        kind: "checkin",
        id: c.id,
        at: item.at,
        ...who(c.memberId),
        station: place(c.stationSlug),
        note: c.note,
      };
    }),
  };
}
