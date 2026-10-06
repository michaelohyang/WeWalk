import { AREAS, type AreaKey } from "./areas";
import {
  BROOKLYN,
  CENTRAL_PARK,
  FIFTH_AVENUE,
  COMPRESS_NORTH_OF,
  GOVERNORS_ISLAND,
  MANHATTAN,
  NEW_JERSEY,
  QUEENS,
  ROOSEVELT_ISLAND,
  type LatLng,
} from "./geo";
import type { LabelSide, MapGeometry, Pin } from "./map-types";
import { STATIONS } from "./stations";

export type { MapGeometry, Pin } from "./map-types";

/*
 * The schematic map: real positions, stood upright and squeezed where nothing happens.
 *
 * 1. lat/lng → meters around midtown (equirectangular is fine at city scale).
 * 2. Rotate 30° so Manhattan's avenues run straight up the screen.
 * 3. Compress everything north of ~63rd St to 30%, transit-map style, so Harlem fits.
 * 4. Frame the stations with river and shore around them, at a fixed width.
 */

export const MAP_WIDTH = 360;
const ORIGIN: LatLng = [40.75, -73.99];
const GRID_TILT = (30 * Math.PI) / 180;
const NORTH_SQUEEZE = 0.3;
const M_PER_DEG_LAT = 110_574;
const M_PER_DEG_LNG = 111_320 * Math.cos((ORIGIN[0] * Math.PI) / 180);

type Pt = { x: number; y: number };

/** Step 1: meters, east = +x, north = +y. */
function meters([lat, lng]: LatLng): Pt {
  return { x: (lng - ORIGIN[1]) * M_PER_DEG_LNG, y: (lat - ORIGIN[0]) * M_PER_DEG_LAT };
}

/** Turn a point in meters by `angle` radians, clockwise: what was `angle` east of north is up. */
function turn({ x, y }: Pt, angle: number): Pt {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: x * c - y * s, y: x * s + y * c };
}

/** Steps 1–2: meters, east = +x, "uptown" = +y. */
const rotated = (at: LatLng): Pt => turn(meters(at), GRID_TILT);

const SQUEEZE_FROM = rotated(COMPRESS_NORTH_OF).y;

/** Step 3. */
function squeezed(p: Pt): Pt {
  return p.y <= SQUEEZE_FROM
    ? p
    : { x: p.x, y: SQUEEZE_FROM + (p.y - SQUEEZE_FROM) * NORTH_SQUEEZE };
}

/** Frame the stations, plus enough river and shore on each side to read as NYC. */
const MARGIN_M = { x: 1100, top: 450, bottom: 700 };
const framePts = STATIONS.map((s) => squeezed(rotated([s.lat, s.lng])));
const BOX = {
  minX: Math.min(...framePts.map((p) => p.x)) - MARGIN_M.x,
  maxX: Math.max(...framePts.map((p) => p.x)) + MARGIN_M.x,
  minY: Math.min(...framePts.map((p) => p.y)) - MARGIN_M.bottom,
  maxY: Math.max(...framePts.map((p) => p.y)) + MARGIN_M.top,
};
const SCALE = MAP_WIDTH / (BOX.maxX - BOX.minX);

export const MAP_HEIGHT = Math.round((BOX.maxY - BOX.minY) * SCALE);

/** Step 4: SVG user units, origin top-left. */
export function project(at: LatLng): Pt {
  const p = squeezed(rotated(at));
  return { x: (p.x - BOX.minX) * SCALE, y: (BOX.maxY - p.y) * SCALE };
}

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

const round1 = (n: number) => Math.round(n * 10) / 10;

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

const PIN_GAP = 22; // pins are 32×20 bubbles: keep centers at least this far apart
/** Distance from a pin's center to its side label: past the 16px half-bubble, or the dot. */
export const LABEL_GAP = { lit: 19, dot: 8 } as const;
const LABEL_HEIGHT = 11;
/** Label widths per character, measured: 8.5px semibold for visited pins, 7.5px for the rest. */
const CHAR_WIDTH = { lit: 5.5, dot: 4.7 } as const;

/**
 * Lays out pins. Overlapping pins (three buildings share a block at 41st & Broadway) are
 * pushed apart. Labels are placed greedily in `priority` order, wherever they first fit: right,
 * left, above, below, then the diagonals. Every pin gets a label; in the rare case none of those is free, the one
 * overlapping least wins. Visited pins are 32×20 bubbles; the rest are small dots.
 */
export function layoutPins(
  stations: readonly { id: string; name: string; lat: number; lng: number }[],
  {
    priority = () => 0,
    lit = () => true,
  }: { priority?: (id: string) => number; lit?: (id: string) => boolean } = {},
): Pin[] {
  const pts = stations.map((s) => ({ ...s, ...project([s.lat, s.lng]) }));

  for (let iter = 0; iter < 60; iter++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i]!;
        const b = pts[j]!;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d >= PIN_GAP) continue;
        // Identical spots: separate along a fixed, deterministic direction.
        if (d < 0.01) [dx, dy] = [0, 1];
        const push = (PIN_GAP - d) / 2 / (Math.hypot(dx, dy) || 1);
        a.x -= dx * push;
        a.y -= dy * push;
        b.x += dx * push;
        b.y += dy * push;
        moved = true;
      }
    }
    if (!moved) break;
  }

  type Box = { x1: number; y1: number; x2: number; y2: number };
  const taken: Box[] = [
    ...pts.map((p) => {
      const [w, h] = lit(p.id) ? [16, 10] : [7.5, 7.5];
      return { x1: p.x - w, y1: p.y - h, x2: p.x + w, y2: p.y + h };
    }),
    // Pin names never cover the river and borough names either.
    ...MAP_GEOMETRY.labels.map(geoLabelBox),
  ];
  const area = (a: Box, b: Box) =>
    Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1)) *
    Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  const offMap = (b: Box) => b.x1 < 2 || b.x2 > MAP_WIDTH - 2 || b.y1 < 2 || b.y2 > MAP_HEIGHT - 2;

  // Every side's box for every pin, and how much each overlaps the fixed things (pins other
  // than its own, river and borough names, the map's edge).
  const options = pts.map((p) => {
    const boxes = labelBoxes(p, p.name, lit(p.id));
    const sides = Object.keys(boxes) as LabelSide[];
    const own = taken[pts.indexOf(p)]!;
    const fixed = Object.fromEntries(
      sides.map((s) => [
        s,
        (offMap(boxes[s]) ? 1e6 : 0) +
          taken.reduce((sum, t) => (t === own ? sum : sum + area(boxes[s], t)), 0),
      ]),
    ) as Record<LabelSide, number>;
    return { p, boxes, sides, fixed };
  });

  // Greedy first (priority pins, then top to bottom): the first side clear of everything...
  const chosen = new Map<string, LabelSide>();
  const placed = () => options.filter((o) => chosen.has(o.p.id));
  const cost = (o: (typeof options)[number], side: LabelSide) =>
    o.fixed[side] +
    placed().reduce(
      (sum, other) =>
        other === o ? sum : sum + area(o.boxes[side], other.boxes[chosen.get(other.p.id)!]),
      0,
    );
  const order = [...options].sort((a, b) => priority(b.p.id) - priority(a.p.id) || a.p.y - b.p.y);
  for (const o of order) {
    chosen.set(
      o.p.id,
      o.sides.reduce((best, s) => (cost(o, s) < cost(o, best) ? s : best)),
    );
  }
  // ...then a few rounds of moving each label to its least-crowded spot, until nothing moves.
  for (let round = 0; round < 8; round++) {
    let moved = false;
    for (const o of order) {
      const now = chosen.get(o.p.id)!;
      const best = o.sides.reduce((b, s) => (cost(o, s) < cost(o, b) - 0.01 ? s : b), now);
      if (best !== now) {
        chosen.set(o.p.id, best);
        moved = true;
      }
    }
    if (!moved) break;
  }
  const labels = chosen;

  return pts.map((p) => ({
    id: p.id,
    x: round1(p.x),
    y: round1(p.y),
    label: labels.get(p.id)!,
  }));
}

/** Where a pin's name would sit on each side (map units). Shared with the drawing code's tests. */
export function labelBoxes(at: { x: number; y: number }, name: string, lit: boolean) {
  const w = name.length * (lit ? CHAR_WIDTH.lit : CHAR_WIDTH.dot);
  const y1 = at.y - LABEL_HEIGHT / 2;
  const gap = lit ? LABEL_GAP.lit : LABEL_GAP.dot;
  const vgap = lit ? 12 : 7;
  return {
    right: { x1: at.x + gap, y1, x2: at.x + gap + w, y2: y1 + LABEL_HEIGHT },
    left: { x1: at.x - gap - w, y1, x2: at.x - gap, y2: y1 + LABEL_HEIGHT },
    above: { x1: at.x - w / 2, y1: at.y - vgap - LABEL_HEIGHT, x2: at.x + w / 2, y2: at.y - vgap },
    below: { x1: at.x - w / 2, y1: at.y + vgap, x2: at.x + w / 2, y2: at.y + vgap + LABEL_HEIGHT },
    // Diagonals, for the dense blocks (Midtown, SoHo) where nothing straight-on is free.
    upRight: { x1: at.x + gap - 3, y1: y1 - LABEL_HEIGHT, x2: at.x + gap - 3 + w, y2: y1 },
    downRight: {
      x1: at.x + gap - 3,
      y1: y1 + LABEL_HEIGHT,
      x2: at.x + gap - 3 + w,
      y2: y1 + 2 * LABEL_HEIGHT,
    },
    upLeft: { x1: at.x - gap + 3 - w, y1: y1 - LABEL_HEIGHT, x2: at.x - gap + 3, y2: y1 },
    downLeft: {
      x1: at.x - gap + 3 - w,
      y1: y1 + LABEL_HEIGHT,
      x2: at.x - gap + 3,
      y2: y1 + 2 * LABEL_HEIGHT,
    },
  } satisfies Record<LabelSide, { x1: number; y1: number; x2: number; y2: number }>;
}

/** The area a water or borough name covers (7.5px uppercase, letter-spaced; rivers run vertical). */
export function geoLabelBox(l: MapGeometry["labels"][number]) {
  const long = l.text.length * 6.2;
  return l.rotate === 0
    ? { x1: l.x - long / 2, y1: l.y - 5, x2: l.x + long / 2, y2: l.y + 5 }
    : { x1: l.x - 5, y1: l.y - long / 2, x2: l.x + 5, y2: l.y + long / 2 };
}

const LAND_RINGS = [
  MANHATTAN,
  BROOKLYN,
  QUEENS,
  NEW_JERSEY,
  ROOSEVELT_ISLAND,
  GOVERNORS_ISLAND,
].map((ring) => ring.map(project));

/** Whether a map point is on land (ray casting against the shorelines). */
export function isOnLand(pt: { x: number; y: number }): boolean {
  return LAND_RINGS.some((ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i]!;
      const b = ring[j]!;
      if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) {
        inside = !inside;
      }
    }
    return inside;
  });
}

/** Points along a place name's text (its center line, plus a margin either side), map units. */
export function geoLabelPoints(l: MapGeometry["labels"][number]) {
  const half = (l.text.length * 6.2) / 2;
  const rad = (l.rotate * Math.PI) / 180;
  const [dx, dy] = [Math.cos(rad), Math.sin(rad)];
  const pts: { x: number; y: number }[] = [];
  for (let t = -half; t <= half; t += 4) {
    for (const off of [-5, 0, 5])
      pts.push({ x: l.x + dx * t - dy * off, y: l.y + dy * t + dx * off });
  }
  return pts;
}
