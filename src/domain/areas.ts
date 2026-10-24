/*
 * Cities and their areas. Every area belongs to exactly one city, so a station's city follows
 * from its area (no separate column). Area keys are unique across cities; labels can repeat
 * ("Downtown", "Midtown"). Order here is chip order.
 */

export const CITIES = [
  { key: "nyc", label: "NYC", name: "New York" },
  { key: "boston", label: "Boston", name: "Boston" },
  { key: "atlanta", label: "Atlanta", name: "Atlanta" },
] as const;

export type CityKey = (typeof CITIES)[number]["key"];

/** The cookie holding the city a phone is looking at. */
export const CITY_COOKIE = "ww_city";

/** Where everyone starts (and where the crew began). */
export const DEFAULT_CITY: CityKey = "nyc";

export function isCity(value: unknown): value is CityKey {
  return typeof value === "string" && CITIES.some((c) => c.key === value);
}

export const AREAS = [
  { key: "uptown", label: "Uptown", city: "nyc" },
  { key: "midtown", label: "Midtown", city: "nyc" },
  { key: "flatiron", label: "Flatiron", city: "nyc" },
  { key: "downtown", label: "Downtown", city: "nyc" },
  { key: "brooklyn", label: "Brooklyn", city: "nyc" },
  { key: "back-bay", label: "Back Bay", city: "boston" },
  { key: "boston-downtown", label: "Downtown", city: "boston" },
  { key: "seaport", label: "Seaport", city: "boston" },
  { key: "north-station", label: "North Station", city: "boston" },
  { key: "cambridge", label: "Cambridge", city: "boston" },
  { key: "atl-midtown", label: "Midtown", city: "atlanta" },
  { key: "buckhead", label: "Buckhead", city: "atlanta" },
  { key: "perimeter", label: "Perimeter", city: "atlanta" },
  { key: "decatur", label: "Decatur", city: "atlanta" },
] as const satisfies readonly { key: string; label: string; city: CityKey }[];

export type AreaKey = (typeof AREAS)[number]["key"];

export const AREA_KEYS: readonly AreaKey[] = AREAS.map((a) => a.key);

export function isArea(value: unknown): value is AreaKey {
  return typeof value === "string" && (AREA_KEYS as readonly string[]).includes(value);
}

const CITY_OF = new Map<string, CityKey>(AREAS.map((a) => [a.key, a.city]));

/** The city an area is in. */
export const cityOf = (area: AreaKey): CityKey => CITY_OF.get(area)!;

/** A city's areas, in chip order. */
export const areasIn = (city: CityKey) => AREAS.filter((a) => a.city === city);

/** An area from the URL, if it's real and in this city (a link from another city is ignored). */
export const areaIn = (city: CityKey, value: unknown): AreaKey | null =>
  isArea(value) && cityOf(value) === city ? value : null;
