/** Calendar dates are plain "YYYY-MM-DD" strings in the visitor's local time. */
export type IsoDate = string;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const EARLIEST = "2020-01-01";

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

/** The UTC calendar date of an instant. */
export function utcDate(now: Date): IsoDate {
  return now.toISOString().slice(0, 10);
}

/**
 * A visit date must be a real date, not before 2020, and not in the future. "Future" allows one
 * day of slack because the visitor's local date can be ahead of UTC.
 */
export function isPlausibleVisitDate(value: IsoDate, now: Date): boolean {
  if (!isIsoDate(value) || value < EARLIEST) return false;
  const tomorrow = utcDate(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  return value <= tomorrow;
}

/** "YYYY-MM" of a date. */
export function monthOf(date: IsoDate): string {
  return date.slice(0, 7);
}

/** The crew's city: "today" for crew-wide things (who's here today) is New York's date. */
export const CITY_TIME_ZONE = "America/New_York";

/** The calendar date in New York at an instant. */
export function cityDate(now: Date): IsoDate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: CITY_TIME_ZONE }).format(now);
}
