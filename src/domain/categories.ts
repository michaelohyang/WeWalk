/**
 * The nine things we rate. Each is tapped 1–5; `quips` are the one-liners shown for each score
 * (index 0 = score 1). Order here is display order everywhere.
 */
export const CATEGORIES = [
  {
    key: "coffee",
    label: "Coffee",
    hint: "5 = worth the commute",
    quips: [
      "Brown water. Tragic.",
      "Drinkable if desperate",
      "It's coffee. Fine.",
      "Actually good",
      "I'd walk 20 blocks",
    ],
  },
  {
    key: "wifi",
    label: "Wi-Fi",
    hint: "5 = 4K Zoom, no lag",
    quips: [
      "Tethering to my phone",
      "Drops every Zoom",
      "Gets the job done",
      "Fast. Reliable.",
      "Faster than my apartment",
    ],
  },
  {
    key: "booths",
    label: "Phone booths",
    hint: "5 = always one free",
    quips: [
      "Took my call in a stairwell",
      "Waitlist energy",
      "Can usually snag one",
      "Plenty, mostly clean",
      "A booth for every mood",
    ],
  },
  {
    key: "light",
    label: "Natural light",
    hint: "5 = plant-thriving",
    quips: [
      "Basically a bunker",
      "One window, far away",
      "Decent by the windows",
      "Bright and lovely",
      "Vitamin D included",
    ],
  },
  {
    key: "noise",
    label: "Noise level",
    hint: "5 = library quiet",
    quips: [
      "Sales team on speaker",
      "Loud but survivable",
      "Normal office hum",
      "Pretty chill",
      "Could hear a pin drop",
    ],
  },
  {
    key: "seating",
    label: "Seating comfort",
    hint: "5 = my back is happy",
    quips: [
      "Bench of regret",
      "Stools. Just stools.",
      "Mixed bag",
      "Good chairs, good desks",
      "Ergonomic heaven",
    ],
  },
  {
    key: "bathrooms",
    label: "Bathrooms",
    hint: "5 = hotel lobby",
    quips: [
      "Bring hand sanitizer",
      "Always a line",
      "Clean enough",
      "Nice, honestly",
      "Spa-level. I lingered.",
    ],
  },
  {
    key: "lunch",
    label: "Lunch nearby",
    hint: "5 = embarrassment of riches",
    quips: [
      "Sad desk salad only",
      "A Pret and a prayer",
      "Some solid options",
      "Great block for lunch",
      "Food heaven, can't pick",
    ],
  },
  {
    key: "vibe",
    label: "Overall vibe",
    hint: "5 = I'd move in",
    quips: ["Never again", "Meh", "Would come back", "Big fan", "My new home base"],
  },
] as const satisfies readonly Category[];

export interface Category {
  key: string;
  label: string;
  hint: string;
  quips: readonly [string, string, string, string, string];
}

export type CategoryKey = (typeof CATEGORIES)[number]["key"];

export const CATEGORY_KEYS: readonly CategoryKey[] = CATEGORIES.map((c) => c.key);

/** A single tap rating. */
export type Score = 1 | 2 | 3 | 4 | 5;

export function isScore(value: unknown): value is Score {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

export function quipFor(key: CategoryKey, score: Score): string {
  const category = CATEGORIES.find((c) => c.key === key);
  if (!category) throw new Error(`Unknown category: ${key}`);
  return category.quips[score - 1]!;
}
