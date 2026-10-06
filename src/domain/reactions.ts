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
