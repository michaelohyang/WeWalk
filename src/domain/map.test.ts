import { describe, expect, it } from "vitest";
import { BROOKLYN, MANHATTAN, type LatLng } from "./geo";
import {
  geoLabelBox,
  geoLabelPoints,
  isOnLand,
  labelBoxes,
  layoutPins,
  MAP_GEOMETRY,
  MAP_HEIGHT,
  MAP_WIDTH,
  project,
} from "./map";
import { STATIONS } from "./stations";

/** Ray-casting point-in-polygon, in projected map units. */
function inside(at: LatLng, ring: readonly LatLng[]): boolean {
  const p = project(at);
  const poly = ring.map(project);
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      hit = !hit;
  }
  return hit;
}

describe("project", () => {
  it("stands Manhattan upright: two points on Fifth Ave share an x", () => {
    const at34th = project([40.7484, -73.9857]);
    const at59th = project([40.7644, -73.9734]);
    expect(Math.abs(at34th.x - at59th.x)).toBeLessThan(3);
    expect(at59th.y).toBeLessThan(at34th.y); // uptown is up
  });

  it("fits a phone: fixed width and a height between 1.5 and 3 screens wide", () => {
    expect(MAP_WIDTH).toBe(360);
    expect(MAP_HEIGHT).toBeGreaterThan(MAP_WIDTH * 1.5);
    expect(MAP_HEIGHT).toBeLessThan(MAP_WIDTH * 3);
  });

  it("puts every station on the map, on the right island", () => {
    for (const s of STATIONS) {
      const p = project([s.lat, s.lng]);
      expect(p.x, s.slug).toBeGreaterThan(10);
      expect(p.x, s.slug).toBeLessThan(MAP_WIDTH - 10);
      expect(p.y, s.slug).toBeGreaterThan(10);
      expect(p.y, s.slug).toBeLessThan(MAP_HEIGHT - 10);
      const island = s.area === "brooklyn" ? BROOKLYN : MANHATTAN;
      expect(inside([s.lat, s.lng], island), s.slug).toBe(true);
    }
  });
});

describe("layoutPins", () => {
  const pins = layoutPins(STATIONS);

  it("keeps every pin apart, including the three on one block at 41st & Broadway", () => {
    for (let i = 0; i < pins.length; i++)
      for (let j = i + 1; j < pins.length; j++) {
        const d = Math.hypot(pins[i]!.x - pins[j]!.x, pins[i]!.y - pins[j]!.y);
        expect(d, `${pins[i]!.slug} ↔ ${pins[j]!.slug}`).toBeGreaterThanOrEqual(21.9);
      }
  });

  it("nudges pins only a little", () => {
    for (const s of STATIONS) {
      const pin = pins.find((p) => p.slug === s.slug)!;
      const at = project([s.lat, s.lng]);
      expect(Math.hypot(pin.x - at.x, pin.y - at.y), s.slug).toBeLessThan(25);
    }
  });

  it("labels every pin with its short name, with no two labels overlapping", () => {
    for (const lit of [() => false, () => true, (id: string) => id === "33-irving-pl"]) {
      const laid = layoutPins(
        STATIONS.map((s) => ({ ...s, name: s.short })),
        { lit },
      );
      const boxes = laid.map((p) => {
        const name = STATIONS.find((s) => s.slug === p.slug)!.short;
        return labelBoxes(p, name, lit(p.slug))[p.label];
      });
      boxes.forEach((a, i) =>
        boxes.slice(i + 1).forEach((b) => {
          const overlaps = a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
          expect(overlaps, `${laid[i]!.slug} label`).toBe(false);
        }),
      );
      for (const b of boxes) {
        expect(b.x1).toBeGreaterThanOrEqual(2);
        expect(b.x2).toBeLessThanOrEqual(MAP_WIDTH - 2);
      }
    }
  });

  it("labels every visited pin when only a few are visited (grey dots leave room)", () => {
    const visited = new Set([
      "1450-broadway",
      "1460-broadway",
      "135-w-41st-st",
      "575-fifth-ave",
      "450-lexington-ave",
      "18-w-18th-st",
    ]);
    const laid = layoutPins(
      STATIONS.map((s) => ({ ...s, name: s.short })),
      { priority: (id) => (visited.has(id) ? 1 : 0), lit: (id) => visited.has(id) },
    );
    for (const id of visited) expect(laid.find((p) => p.slug === id)!.label, id).not.toBeNull();
  });

  it("knows land from water (every station is on land)", () => {
    for (const s of STATIONS) expect(isOnLand(project([s.lat, s.lng])), s.slug).toBe(true);
  });

  it("is deterministic", () => {
    expect(layoutPins(STATIONS)).toEqual(pins);
  });
});

describe("map labels", () => {
  type Box = { x1: number; y1: number; x2: number; y2: number };
  const hit = (a: Box, b: Box) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
  const labelBox = geoLabelBox;
  // Worst case: every station visited, so every pin is a bubble with a label.
  const pins = layoutPins(
    STATIONS.map((s) => ({ ...s, name: s.short })),
    { priority: () => 1, lit: () => true },
  );
  const taken: Box[] = pins.flatMap((p) => {
    const name = STATIONS.find((s) => s.slug === p.slug)!.short;
    return [
      { x1: p.x - 16, y1: p.y - 10, x2: p.x + 16, y2: p.y + 10 },
      labelBoxes(p, name, true)[p.label],
    ];
  });

  it.each(MAP_GEOMETRY.labels.map((l) => [l.text, l] as const))(
    "%s fits and stays clear",
    (_, l) => {
      const b = labelBox(l);
      expect(b.x1).toBeGreaterThanOrEqual(2);
      expect(b.x2).toBeLessThanOrEqual(MAP_GEOMETRY.width - 2);
      expect(b.y1).toBeGreaterThanOrEqual(2);
      expect(b.y2).toBeLessThanOrEqual(MAP_GEOMETRY.height - 2);
      for (const t of taken) expect(hit(b, t)).toBe(false);
      // River names sit in the water, every letter of them.
      if (l.water) {
        for (const p of geoLabelPoints(l))
          expect(isOnLand(p), `${l.text} at ${p.x},${p.y}`).toBe(false);
      }
      for (const other of MAP_GEOMETRY.labels)
        if (other !== l) expect(hit(b, labelBox(other))).toBe(false);
    },
  );
});

describe("area zones", () => {
  const zones = MAP_GEOMETRY.zones.manhattan.areas;
  /** Ray-casting point-in-polygon on a zone's path ("Mx yLx y…Z"). */
  const inZone = (d: string, p: { x: number; y: number }) => {
    const ring = d
      .slice(1, -1)
      .split("L")
      .map((xy) => xy.split(" ").map(Number) as [number, number]);
    let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[i]!;
      const [bx, by] = ring[j]!;
      if (ay > p.y !== by > p.y && p.x < ((bx - ax) * (p.y - ay)) / (by - ay) + ax) hit = !hit;
    }
    return hit;
  };

  it("has one zone per Manhattan area, north first", () => {
    expect(zones.map((z) => z.area)).toEqual(["uptown", "midtown", "flatiron", "downtown"]);
  });

  // The tint under a station should match its filter chip.
  it.each(STATIONS.filter((s) => s.area !== "brooklyn").map((s) => [s.short, s] as const))(
    "%s sits in its own area's zone, and only that one",
    (_, s) => {
      const p = project([s.lat, s.lng]);
      expect(zones.filter((z) => inZone(z.d, p)).map((z) => z.area)).toEqual([s.area]);
    },
  );
});
