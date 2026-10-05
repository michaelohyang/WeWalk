import { describe, expect, it } from "vitest";
import { BROOKLYN, MANHATTAN, type LatLng } from "./geo";
import { layoutPins, MAP_GEOMETRY, MAP_HEIGHT, MAP_WIDTH, project, SQUEEZE_LINE_Y } from "./map";
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
    expect(SQUEEZE_LINE_Y).toBeGreaterThan(0);
  });

  it("puts every station on the map, on the right island", () => {
    for (const s of STATIONS) {
      const p = project([s.lat, s.lng]);
      expect(p.x, s.id).toBeGreaterThan(10);
      expect(p.x, s.id).toBeLessThan(MAP_WIDTH - 10);
      expect(p.y, s.id).toBeGreaterThan(10);
      expect(p.y, s.id).toBeLessThan(MAP_HEIGHT - 10);
      const island = s.area === "brooklyn" ? BROOKLYN : MANHATTAN;
      expect(inside([s.lat, s.lng], island), s.id).toBe(true);
    }
  });
});

describe("layoutPins", () => {
  const pins = layoutPins(STATIONS);

  it("keeps every pin apart, including the three on one block at 41st & Broadway", () => {
    for (let i = 0; i < pins.length; i++)
      for (let j = i + 1; j < pins.length; j++) {
        const d = Math.hypot(pins[i]!.x - pins[j]!.x, pins[i]!.y - pins[j]!.y);
        expect(d, `${pins[i]!.id} ↔ ${pins[j]!.id}`).toBeGreaterThanOrEqual(21.9);
      }
  });

  it("nudges pins only a little", () => {
    for (const s of STATIONS) {
      const pin = pins.find((p) => p.id === s.id)!;
      const at = project([s.lat, s.lng]);
      expect(Math.hypot(pin.x - at.x, pin.y - at.y), s.id).toBeLessThan(25);
    }
  });

  it("labels most pins, and gives the top-priority pin a label", () => {
    expect(pins.filter((p) => p.label).length).toBeGreaterThanOrEqual(STATIONS.length / 2);
    const top = layoutPins(STATIONS, { priority: (id) => (id === "135-w-41st-st" ? 1 : 0) });
    expect(top.find((p) => p.id === "135-w-41st-st")!.label).not.toBeNull();
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
    for (const id of visited) expect(laid.find((p) => p.id === id)!.label, id).not.toBeNull();
  });

  it("is deterministic", () => {
    expect(layoutPins(STATIONS)).toEqual(pins);
  });
});

describe("map labels", () => {
  type Box = { x1: number; y1: number; x2: number; y2: number };
  const hit = (a: Box, b: Box) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
  // 8px uppercase with letter-spacing: ~6.2 units per character; rotated labels run vertically.
  const labelBox = (l: (typeof MAP_GEOMETRY.labels)[number]): Box => {
    const long = l.text.length * 6.2;
    return l.rotate === 0
      ? { x1: l.x - long / 2, y1: l.y - 5, x2: l.x + long / 2, y2: l.y + 5 }
      : { x1: l.x - 5, y1: l.y - long / 2, x2: l.x + 5, y2: l.y + long / 2 };
  };
  // Worst case: every station visited, so every pin is a bubble with a label.
  const pins = layoutPins(
    STATIONS.map((s) => ({ ...s, name: s.short })),
    { priority: () => 1, lit: () => true },
  );
  const taken: Box[] = pins.flatMap((p) => {
    const w = STATIONS.find((s) => s.id === p.id)!.short.length * 4.9;
    const boxes = [{ x1: p.x - 16, y1: p.y - 10, x2: p.x + 16, y2: p.y + 10 }];
    if (p.label === "right")
      boxes.push({ x1: p.x + 19, y1: p.y - 6, x2: p.x + 19 + w, y2: p.y + 6 });
    if (p.label === "left")
      boxes.push({ x1: p.x - 19 - w, y1: p.y - 6, x2: p.x - 19, y2: p.y + 6 });
    return boxes;
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
      // Not on the "Uptown, not to scale" marker (right-aligned, just above the squeeze line).
      expect(
        hit(b, { x1: 230, y1: MAP_GEOMETRY.squeezeY - 14, x2: 360, y2: MAP_GEOMETRY.squeezeY + 2 }),
      ).toBe(false);
      for (const other of MAP_GEOMETRY.labels)
        if (other !== l) expect(hit(b, labelBox(other))).toBe(false);
    },
  );
});
