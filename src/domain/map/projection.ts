import { COMPRESS_NORTH_OF, type LatLng } from "../geo";
import { STATIONS } from "../stations";

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

export type Pt = { x: number; y: number };

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

/** Whether a point is inside a ring of points (ray casting). */
export function insideRing(pt: Pt, ring: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

export const round1 = (n: number) => Math.round(n * 10) / 10;
