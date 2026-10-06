import type { LabelSide, MapGeometry, Pin } from "../map-types";
import { MAP_HEIGHT, MAP_WIDTH, project, round1 } from "./projection";
import { MAP_GEOMETRY } from "./shapes";

/* Placing the pins: nudging overlapping ones apart, and finding room for every name. */

const PIN_GAP = 22; // pins are 32×20 bubbles: keep centers at least this far apart
/** Distance from a pin's center to its side label: past the 16px half-bubble, or the dot. */
const LABEL_GAP = { lit: 19, dot: 8 } as const;
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
  stations: readonly { slug: string; name: string; lat: number; lng: number }[],
  {
    priority = () => 0,
    lit = () => true,
  }: { priority?: (slug: string) => number; lit?: (slug: string) => boolean } = {},
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
      const [w, h] = lit(p.slug) ? [16, 10] : [7.5, 7.5];
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
    const boxes = labelBoxes(p, p.name, lit(p.slug));
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
  const placed = () => options.filter((o) => chosen.has(o.p.slug));
  const cost = (o: (typeof options)[number], side: LabelSide) =>
    o.fixed[side] +
    placed().reduce(
      (sum, other) =>
        other === o ? sum : sum + area(o.boxes[side], other.boxes[chosen.get(other.p.slug)!]),
      0,
    );
  const order = [...options].sort(
    (a, b) => priority(b.p.slug) - priority(a.p.slug) || a.p.y - b.p.y,
  );
  for (const o of order) {
    chosen.set(
      o.p.slug,
      o.sides.reduce((best, s) => (cost(o, s) < cost(o, best) ? s : best)),
    );
  }
  // ...then a few rounds of moving each label to its least-crowded spot, until nothing moves.
  for (let round = 0; round < 8; round++) {
    let moved = false;
    for (const o of order) {
      const now = chosen.get(o.p.slug)!;
      const best = o.sides.reduce((b, s) => (cost(o, s) < cost(o, b) - 0.01 ? s : b), now);
      if (best !== now) {
        chosen.set(o.p.slug, best);
        moved = true;
      }
    }
    if (!moved) break;
  }
  const labels = chosen;

  return pts.map((p) => ({
    slug: p.slug,
    x: round1(p.x),
    y: round1(p.y),
    label: labels.get(p.slug)!,
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
