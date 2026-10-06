import type { IsoDate } from "./dates";
import type { Scores } from "./scoring";
import type { Tag } from "./tags";

/** The shapes domain logic works on. The server maps database rows to these. */
export interface ReviewRecord {
  id: string;
  stationSlug: string;
  memberId: string;
  visitedOn: IsoDate;
  scores: Scores;
  hotTake: string;
  body: string;
  tags: Tag[];
  /** ISO timestamp */
  updatedAt: string;
}

export interface CheckinRecord {
  id: string;
  stationSlug: string;
  memberId: string;
  visitedOn: IsoDate;
  note: string;
}

export type Visit = Pick<ReviewRecord | CheckinRecord, "stationSlug" | "memberId" | "visitedOn">;
