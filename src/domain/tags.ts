/** "Best for" tags a reviewer can pick. Order here is display order in the rate form. */
export const TAGS = [
  "good for deep work",
  "good for calls",
  "great rooftop",
  "crowded by 10am",
  "good coffee bar",
  "quiet floor",
  "good for meetings",
  "dog-friendly",
  "near the train",
  "booths always full",
  "AC set to arctic",
  "free snacks era",
] as const;

export type Tag = (typeof TAGS)[number];
