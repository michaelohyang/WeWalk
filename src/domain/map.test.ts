import { describe, expect, it } from "vitest";
import { BROOKLYN, MANHATTAN, type LatLng } from "./geo";
import { layoutPins, MAP_HEIGHT, MAP_WIDTH, project, SQUEEZE_LINE_Y } from "./map";
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
    const top = layoutPins(STATIONS, (id) => (id === "135-w-41st-st" ? 1 : 0));
    expect(top.find((p) => p.id === "135-w-41st-st")!.label).not.toBeNull();
  });

  it("is deterministic", () => {
    expect(layoutPins(STATIONS)).toEqual(pins);
  });
});
