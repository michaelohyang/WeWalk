import { AREAS, type AreaKey } from "./areas";
import type { IsoDate } from "./dates";
import type { ReviewRecord, Visit } from "./records";

/*
 * Passport extras: badges you earn by going places, and a weekly streak. Everything is computed
 * from reviews and check-ins (a "visit" is either), so nothing new is stored.
 */

export interface Badge {
  key: string;
  emoji: string;
  title: string;
  /** What it takes, e.g. "Visit 10 buildings". */
  detail: string;
  earned: boolean;
  progress: { have: number; need: number };
}

const AREA_EMOJI: Record<AreaKey, string> = {
  uptown: "🌳",
  midtown: "🏙️",
  flatiron: "📐",
  downtown: "🗽",
  brooklyn: "🌉",
};

const MILESTONES = [
  { key: "first", emoji: "🗺️", title: "First stamp", need: 1 },
  { key: "regular", emoji: "☕", title: "Regular", need: 5 },
  { key: "explorer", emoji: "🧭", title: "Explorer", need: 10 },
] as const;

/** Visits in one Monday–Sunday week for "Busy week". */
const BUSY_WEEK = 5;

/** Monday of the week a date is in (weeks run Monday–Sunday). */
export function weekOf(date: IsoDate): IsoDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

const weeksBefore = (monday: IsoDate, n: number) => {
  const d = new Date(`${monday}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7 * n);
  return d.toISOString().slice(0, 10);
};

export function badgesFor(
  memberId: string,
  stations: readonly { slug: string; area: string }[],
  visits: readonly Visit[],
  reviews: readonly ReviewRecord[],
): Badge[] {
  const mine = visits.filter((v) => v.memberId === memberId);
  const been = new Set(mine.map((v) => v.stationSlug));
  const onMap = stations.filter((s) => been.has(s.slug)).length;
  const badge = (b: Omit<Badge, "earned">): Badge => ({
    ...b,
    earned: b.progress.have >= b.progress.need,
    progress: { ...b.progress, have: Math.min(b.progress.have, b.progress.need) },
  });

  const milestones = MILESTONES.map((m) =>
    badge({
      key: m.key,
      emoji: m.emoji,
      title: m.title,
      detail: m.need === 1 ? "Visit your first building" : `Visit ${m.need} buildings`,
      progress: { have: onMap, need: m.need },
    }),
  );
  const completionist = badge({
    key: "completionist",
    emoji: "🏆",
    title: "Completionist",
    detail: `Visit all ${stations.length} buildings`,
    progress: { have: onMap, need: stations.length },
  });
  const areas = AREAS.map((a) => {
    const here = stations.filter((s) => s.area === a.key);
    return badge({
      key: `area-${a.key}`,
      emoji: AREA_EMOJI[a.key],
      title: `All of ${a.label}`,
      detail: `Visit every ${a.label} building`,
      progress: { have: here.filter((s) => been.has(s.slug)).length, need: here.length },
    });
  }).filter((b) => b.progress.need > 0);

  // Trailblazer: the crew's first review of a building is yours (earliest visit, then edit).
  const first = new Map<string, ReviewRecord>();
  for (const r of reviews) {
    const seen = first.get(r.stationSlug);
    if (
      !seen ||
      r.visitedOn < seen.visitedOn ||
      (r.visitedOn === seen.visitedOn && r.updatedAt < seen.updatedAt)
    )
      first.set(r.stationSlug, r);
  }
  const blazed = [...first.values()].filter((r) => r.memberId === memberId).length;
  const trailblazer = badge({
    key: "trailblazer",
    emoji: "🚩",
    title: "Trailblazer",
    detail: "Be the first in the crew to review a building",
    progress: { have: blazed, need: 1 },
  });

  // Busy week: the most visits (one per building per day) in any one week.
  const perWeek = new Map<IsoDate, Set<string>>();
  for (const v of mine) {
    const w = weekOf(v.visitedOn);
    perWeek.set(w, (perWeek.get(w) ?? new Set()).add(`${v.visitedOn}:${v.stationSlug}`));
  }
  const best = Math.max(0, ...[...perWeek.values()].map((s) => s.size));
  const busy = badge({
    key: "busy-week",
    emoji: "⚡",
    title: "Busy week",
    detail: `${BUSY_WEEK} visits in one week`,
    progress: { have: best, need: BUSY_WEEK },
  });

  return [...milestones, completionist, trailblazer, busy, ...areas];
}

/**
 * Weeks in a row with at least one visit, counting back from this week. A streak survives until
 * a whole week passes without one, so on Monday last week's streak still counts.
 */
export function weekStreak(
  memberId: string,
  visits: readonly Visit[],
  today: IsoDate,
): { weeks: number; thisWeek: boolean } {
  const weeks = new Set(
    visits.filter((v) => v.memberId === memberId).map((v) => weekOf(v.visitedOn)),
  );
  const now = weekOf(today);
  const thisWeek = weeks.has(now);
  let n = 0;
  for (let i = thisWeek ? 0 : 1; weeks.has(weeksBefore(now, i)); i++) n++;
  return { weeks: n, thisWeek };
}
