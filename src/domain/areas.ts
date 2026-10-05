/** Filter-chip groupings for neighborhoods. Order here is chip order. */
export const AREAS = [
  { key: "uptown", label: "Uptown" },
  { key: "midtown", label: "Midtown" },
  { key: "flatiron", label: "Flatiron" },
  { key: "downtown", label: "Downtown" },
  { key: "brooklyn", label: "Brooklyn" },
] as const;

export type AreaKey = (typeof AREAS)[number]["key"];

export const AREA_KEYS: readonly AreaKey[] = AREAS.map((a) => a.key);

export function isArea(value: unknown): value is AreaKey {
  return typeof value === "string" && (AREA_KEYS as readonly string[]).includes(value);
}
