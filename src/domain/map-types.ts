/*
 * Types for drawing the map, with no runtime code: browser components import these, while the
 * projection, shoreline and station data (domain/map, geo, stations) stay on the server.
 */

/** Everything static the map needs to draw, as plain data. */
export interface MapGeometry {
  width: number;
  height: number;
  squeezeY: number;
  land: readonly { name: string; far: boolean; d: string }[];
  /** Water and borough names, with a rotation for the rivers. */
  labels: readonly { text: string; x: number; y: number; rotate: number; water: boolean }[];
}

/** Placed pins for the screen: positions nudged apart, labels placed where they fit. */
export interface Pin {
  id: string;
  x: number;
  y: number;
  /** Which side the name goes on, or null when there's no room (shown on tap instead). */
  label: "left" | "right" | null;
}
