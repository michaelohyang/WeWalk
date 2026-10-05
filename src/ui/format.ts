import type { AreaKey } from "@/domain/areas";
import type { IsoDate } from "@/domain/dates";

/** Short label for a station tile/stamp: its street number, or initials ("Dumbo Heights" → "DH"). */
export function tileText(name: string): string {
  const number = name.match(/^\d+/);
  if (number) return number[0];
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export const areaColor = (area: AreaKey) => `var(--a-${area})`;

const AVATAR_COLORS = [
  "--a-midtown",
  "--a-flatiron",
  "--a-downtown",
  "--a-brooklyn",
  "--brand",
  "--a-uptown",
];

/** A stable color per person, from their id. */
export function avatarColor(seed: string): string {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return `var(${AVATAR_COLORS[(h >>> 0) % AVATAR_COLORS.length]})`;
}

export function formatDate(date: IsoDate): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const TIER_WORDS = { great: "Elite", good: "Solid", ok: "It's fine", bad: "Pray" } as const;
/** The one-word verdict for a score tier. */
export const tierWord = (tier: keyof typeof TIER_WORDS | null) =>
  tier ? TIER_WORDS[tier] : "Not rated";
