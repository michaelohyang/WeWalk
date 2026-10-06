import "server-only";
import { CATEGORY_KEYS, type CategoryKey } from "@/domain/categories";
import type { IsoDate } from "@/domain/dates";
import { REACTIONS, type ReactionKey } from "@/domain/reactions";
import type { ReviewRecord } from "@/domain/records";
import { personOverall, scoreStation } from "@/domain/scoring";
import type { Tag } from "@/domain/tags";
import type { Session } from "../auth";
import type { CrewData } from "../crew";
import { cards, type StationCard } from "./cards";

/* A station's page: its scores, the crew's reviews (yours first) and the visit log. */

export interface ReviewView {
  id: string;
  memberId: string;
  by: string;
  visitedOn: IsoDate;
  overall: number | null;
  hotTake: string;
  body: string;
  tags: Tag[];
  mine: boolean;
  /** Every kind, in display order, so the buttons render even at zero. */
  reactions: {
    key: ReactionKey;
    emoji: string;
    label: string;
    count: number;
    /** You reacted this way. */
    mine: boolean;
    /** Who did, for the tooltip. */
    by: string[];
  }[];
}

export interface StationView {
  station: StationCard;
  /** Your check-ins here (newest first), so the page knows if you're checked in today. */
  myCheckins: { id: string; visitedOn: IsoDate; note: string }[];
  categories: { key: CategoryKey; value: number | null }[];
  reviews: ReviewView[];
  /** Check-ins and reviews, newest first. */
  log: { date: IsoDate; by: string; mine: boolean; kind: "checkin" | "review"; note: string }[];
}

export async function stationView(
  crew: CrewData,
  session: Session,
  slug: string,
): Promise<StationView | null> {
  const station = cards(crew, session.member.id).cards.find((c) => c.slug === slug);
  if (!station) return null;
  const names = new Map(crew.members.map((m) => [m.id, m.name]));
  const by = (memberId: string) => names.get(memberId) ?? "someone";
  const me = session.member.id;
  const reviews = crew.reviews.filter((r) => r.stationSlug === slug);
  const score = scoreStation(reviews);
  const latestFirst = (a: ReviewRecord, b: ReviewRecord) =>
    b.visitedOn.localeCompare(a.visitedOn) || b.updatedAt.localeCompare(a.updatedAt);

  return {
    station,
    myCheckins: crew.checkins
      .filter((c) => c.stationSlug === slug && c.memberId === session.member.id)
      .sort((a, b) => b.visitedOn.localeCompare(a.visitedOn))
      .map(({ id, visitedOn, note }) => ({ id, visitedOn, note })),
    categories: CATEGORY_KEYS.map((key) => ({ key, value: score.categories[key] })),
    // Yours first: after posting you land here and should see it without scrolling.
    reviews: [...reviews]
      .sort((a, b) => Number(b.memberId === me) - Number(a.memberId === me) || latestFirst(a, b))
      .map((r) => ({
        id: r.id,
        memberId: r.memberId,
        by: by(r.memberId),
        visitedOn: r.visitedOn,
        overall: personOverall(r.scores),
        hotTake: r.hotTake,
        body: r.body,
        tags: r.tags,
        mine: r.memberId === session.member.id,
        reactions: REACTIONS.map((kind) => {
          const these = crew.reactions.filter((x) => x.reviewId === r.id && x.kind === kind.key);
          return {
            ...kind,
            count: these.length,
            mine: these.some((x) => x.memberId === me),
            by: these.map((x) => by(x.memberId)),
          };
        }),
      })),
    log: [
      ...crew.checkins
        .filter((c) => c.stationSlug === slug)
        .map((c) => ({
          date: c.visitedOn,
          by: by(c.memberId),
          mine: c.memberId === me,
          kind: "checkin" as const,
          note: c.note,
        })),
      ...reviews.map((r) => ({
        date: r.visitedOn,
        by: by(r.memberId),
        mine: r.memberId === me,
        kind: "review" as const,
        note: "",
      })),
    ].sort((a, b) => b.date.localeCompare(a.date)),
  };
}
