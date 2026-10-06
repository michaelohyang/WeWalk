/** One-tap reactions to a review. Order here is display order. */
export const REACTIONS = [
  { key: "fire", emoji: "🔥", label: "Fire" },
  { key: "hundred", emoji: "💯", label: "So true" },
  { key: "laugh", emoji: "😂", label: "LOL" },
  { key: "disagree", emoji: "🙅", label: "Hard disagree" },
] as const;

export type ReactionKey = (typeof REACTIONS)[number]["key"];

export const REACTION_KEYS: readonly ReactionKey[] = REACTIONS.map((r) => r.key);

export interface ReactionRecord {
  reviewId: string;
  memberId: string;
  kind: ReactionKey;
}

/** A reaction kind on one review, as the screen shows it. */
export interface ReactionSummary {
  key: ReactionKey;
  emoji: string;
  label: string;
  count: number;
  /** You reacted this way. */
  mine: boolean;
  /** Who did, for the tooltip. */
  by: string[];
}

/** Every kind, in display order (so buttons render even at zero), for one review. */
export function summarizeReactions(
  reactions: readonly ReactionRecord[],
  reviewId: string,
  me: string,
  nameOf: (memberId: string) => string,
): ReactionSummary[] {
  return REACTIONS.map((kind) => {
    const these = reactions.filter((x) => x.reviewId === reviewId && x.kind === kind.key);
    return {
      ...kind,
      count: these.length,
      mine: these.some((x) => x.memberId === me),
      by: these.map((x) => nameOf(x.memberId)),
    };
  });
}
