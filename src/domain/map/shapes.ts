import { AREAS, type AreaKey } from "../areas";
import {
  BROOKLYN,
  CENTRAL_PARK,
  FIFTH_AVENUE,
  GOVERNORS_ISLAND,
  MANHATTAN,
  NEW_JERSEY,
  QUEENS,
  ROOSEVELT_ISLAND,
  type LatLng,
} from "../geo";
import type { MapGeometry } from "../map-types";
import { STATIONS } from "../stations";
import { insideRing, MAP_HEIGHT, MAP_WIDTH, project, round1, type Pt } from "./projection";

/* What the map draws under the pins: land, area zones, Central Park and place names. */

/**
 * A closed, smooth outline through the shoreline points (Catmull-Rom as cubic Béziers): soft
 * coasts instead of a jagged polygon.
 */
const toPath = (ring: readonly LatLng[]) => {
  const p = ring.map(project);
  const at = (i: number) => p[(i + p.length) % p.length]!;
  const f = (n: number) => n.toFixed(1);
  let d = `M${f(p[0]!.x)} ${f(p[0]!.y)}`;
  for (let i = 0; i < p.length; i++) {
    const [a, b, c, e] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1 = { x: b.x + (c.x - a.x) / 6, y: b.y + (c.y - a.y) / 6 };
    const c2 = { x: c.x - (e.x - b.x) / 6, y: c.y - (e.y - b.y) / 6 };
    d += `C${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(c.x)} ${f(c.y)}`;
  }
  return d + "Z";
};

/** SVG paths for the land, in drawing order. `far` land is drawn lighter. */
export const LAND = [
  { name: "New Jersey", far: true, d: toPath(NEW_JERSEY) },
  { name: "Queens", far: true, d: toPath(QUEENS) },
  { name: "Brooklyn", far: false, d: toPath(BROOKLYN) },
  { name: "Manhattan", far: false, d: toPath(MANHATTAN) },
  { name: "Roosevelt Island", far: true, d: toPath(ROOSEVELT_ISLAND) },
  { name: "Governors Island", far: true, d: toPath(GOVERNORS_ISLAND) },
] as const;

/** Zones reach this far past the map's edges, so their blurred edges never show there. */
const ZONE_BLEED = 40;
/** Half the width (map units) of the slant where a boundary steps across Fifth Avenue. */
const ZONE_SLANT = 22;

/**
 * Manhattan's areas as zones down the island, north first, each a staircase that steps at Fifth
 * Avenue: west and east sides get their own boundaries, since neighborhoods don't end on the
 * same street on both sides (Midtown West runs further south than NoMad). Each boundary sits
 * halfway between the nearest stations on either side, so every station's tint matches its
 * filter chip.
 */
export function manhattanZones(): { area: AreaKey; d: string }[] {
  const order = AREAS.map((a) => a.key).filter((k) => k !== "brooklyn");
  const split = project(FIFTH_AVENUE).x;
  const sides = [(x: number) => x < split, (x: number) => x >= split];
  const pts = STATIONS.map((s) => ({ area: s.area, ...project([s.lat, s.lng]) }));
  const cut = (north: AreaKey, south: AreaKey, onSide: (x: number) => boolean) => {
    const pick = (k: AreaKey, side: boolean) =>
      pts.filter((p) => p.area === k && (!side || onSide(p.x))).map((p) => p.y);
    const n = pick(north, true).length ? pick(north, true) : pick(north, false);
    const s = pick(south, true).length ? pick(south, true) : pick(south, false);
    return round1((Math.max(...n) + Math.min(...s)) / 2);
  };
  // cuts[side][i]: the boundary between order[i] and order[i + 1] on that side.
  const cuts = sides.map((side) => order.slice(1).map((k, i) => cut(order[i]!, k, side)));
  const [left, right] = [-ZONE_BLEED, MAP_WIDTH + ZONE_BLEED];
  const edge = (side: 0 | 1, i: number) =>
    i < 0 ? -ZONE_BLEED : i >= order.length - 1 ? MAP_HEIGHT + ZONE_BLEED : cuts[side]![i]!;
  return order.map((area, i) => {
    const [wTop, eTop, wBottom, eBottom] = [edge(0, i - 1), edge(1, i - 1), edge(0, i), edge(1, i)];
    // The step from the west side's boundary to the east side's is a gentle slant, not a notch.
    const [w, e] = [split - ZONE_SLANT, split + ZONE_SLANT];
    const ring = [
      [left, wTop],
      [w, wTop],
      [e, eTop],
      [right, eTop],
      [right, eBottom],
      [e, eBottom],
      [w, wBottom],
      [left, wBottom],
    ];
    return { area, d: `M${ring.map(([x, y]) => `${round1(x!)} ${round1(y!)}`).join("L")}Z` };
  });
}

/** Central Park as a rectangle in map units (it lines up with the map's grid). */
function park() {
  const p = CENTRAL_PARK.map(project);
  const [x1, x2] = [Math.min(...p.map((q) => q.x)), Math.max(...p.map((q) => q.x))];
  const [y1, y2] = [Math.min(...p.map((q) => q.y)), Math.max(...p.map((q) => q.y))];
  return { x: round1(x1), y: round1(y1), width: round1(x2 - x1), height: round1(y2 - y1) };
}

export const MAP_GEOMETRY: MapGeometry = {
  width: MAP_WIDTH,
  height: MAP_HEIGHT,
  land: LAND,
  zones: {
    manhattan: { shore: toPath(MANHATTAN), areas: manhattanZones() },
    brooklyn: toPath(BROOKLYN),
    park: park(),
  },
  // Placed by hand in map units (checked by map.test.ts: inside the map, clear of every pin,
  // pin label and each other at 390px).
  labels: [
    { text: "Hudson", x: 32, y: 430, rotate: -90, water: true },
    { text: "East River", x: 256, y: 408, rotate: -70, water: true },
    { text: "New Jersey · no comment", x: 13, y: 380, rotate: -90, water: false },
    { text: "Brooklyn", x: 300, y: 500, rotate: 0, water: false },
    { text: "Queens", x: 300, y: 150, rotate: 0, water: false },
  ],
};

const LAND_RINGS = [
  MANHATTAN,
  BROOKLYN,
  QUEENS,
  NEW_JERSEY,
  ROOSEVELT_ISLAND,
  GOVERNORS_ISLAND,
].map((ring) => ring.map(project));

/** Whether a map point is on land (ray casting against the shorelines). */
export function isOnLand(pt: Pt): boolean {
  return LAND_RINGS.some((ring) => insideRing(pt, ring));
}
