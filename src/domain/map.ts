import {
  BROOKLYN,
  COMPRESS_NORTH_OF,
  GOVERNORS_ISLAND,
  MANHATTAN,
  NEW_JERSEY,
  QUEENS,
  ROOSEVELT_ISLAND,
  type LatLng,
} from "./geo";
import type { MapGeometry, Pin } from "./map-types";
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

/** Steps 1–2: meters, east = +x, "uptown" = +y. */
function rotated([lat, lng]: LatLng): Pt {
  const x = (lng - ORIGIN[1]) * M_PER_DEG_LNG;
  const y = (lat - ORIGIN[0]) * M_PER_DEG_LAT;
  const c = Math.cos(GRID_TILT);
  const s = Math.sin(GRID_TILT);
  return { x: x * c - y * s, y: x * s + y * c };
}

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

/** Where the squeeze starts, for drawing a "compressed" marker. */
export const SQUEEZE_LINE_Y = (BOX.maxY - SQUEEZE_FROM) * SCALE;

const toPath = (ring: readonly LatLng[]) =>
  ring
    .map((ll, i) => {
      const { x, y } = project(ll);
      return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join("") + "Z";

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

export const MAP_GEOMETRY: MapGeometry = {
  width: MAP_WIDTH,
  height: MAP_HEIGHT,
  squeezeY: SQUEEZE_LINE_Y,
  land: LAND,
  // Placed by hand in map units (checked by map.test.ts: inside the map, clear of every pin,
  // pin label and each other at 390px).
  labels: [
    { text: "Hudson", x: 32, y: 430, rotate: -90, water: true },
    { text: "East River", x: 230, y: 320, rotate: -70, water: true },
    { text: "New Jersey · no comment", x: 9, y: 380, rotate: -90, water: false },
    { text: "Brooklyn", x: 300, y: 500, rotate: 0, water: false },
    { text: "Queens", x: 300, y: 150, rotate: 0, water: false },
  ],
};

const PIN_GAP = 22; // pins are 32×20 bubbles: keep centers at least this far apart
const LABEL_HEIGHT = 11;
const CHAR_WIDTH = 4.9; // ~8.5px Figtree semibold

/**
 * Lays out pins. Overlapping pins (three buildings share a block at 41st & Broadway) are
 * pushed apart. Labels are placed greedily in `priority` order: right if it fits, else left,
 * else hidden (the name shows on tap). Visited pins are 32×20 bubbles; the rest are small dots,
 * so labels may pass close to a dot but never over a bubble or another label.
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
  const taken: Box[] = pts.map((p) => {
    const [w, h] = lit(p.id) ? [16, 10] : [6, 6];
    return { x1: p.x - w, y1: p.y - h, x2: p.x + w, y2: p.y + h };
  });
  const hits = (b: Box) =>
    b.x1 < 2 ||
    b.x2 > MAP_WIDTH - 2 ||
    taken.some((t) => b.x1 < t.x2 && b.x2 > t.x1 && b.y1 < t.y2 && b.y2 > t.y1);

  const labels = new Map<string, Pin["label"]>();
  const byPriority = [...pts].sort((a, b) => priority(b.id) - priority(a.id) || a.y - b.y);
  for (const p of byPriority) {
    const w = p.name.length * CHAR_WIDTH;
    const y1 = p.y - LABEL_HEIGHT / 2;
    const gap = lit(p.id) ? 19 : 8;
    const right = { x1: p.x + gap, y1, x2: p.x + gap + w, y2: y1 + LABEL_HEIGHT };
    const left = { x1: p.x - gap - w, y1, x2: p.x - gap, y2: y1 + LABEL_HEIGHT };
    const side = !hits(right) ? "right" : !hits(left) ? "left" : null;
    if (side) taken.push(side === "right" ? right : left);
    labels.set(p.id, side);
  }

  return pts.map((p) => ({
    id: p.id,
    x: round1(p.x),
    y: round1(p.y),
    label: labels.get(p.id) ?? null,
  }));
}
