/*
 * Types for drawing the map, with no runtime code: browser components import these, while the
 * projection, shoreline and station data (domain/map, geo, stations) stay on the server.
 */
import type { AreaKey } from "./areas";

/** Everything static the map needs to draw, as plain data. */
export interface MapGeometry {
  width: number;
  height: number;
  land: readonly { name: string; far: boolean; d: string }[];
  /**
   * Area tints, in the filter chips' colors: Manhattan as soft-edged zones down the island
   * (clipped to its `shore`), Brooklyn whole, and Central Park.
   */
  zones: {
    manhattan: { shore: string; areas: readonly { area: AreaKey; d: string }[] };
    brooklyn: string;
    park: { x: number; y: number; width: number; height: number };
  };
  /** Water and borough names, with a rotation for the rivers. */
  labels: readonly { text: string; x: number; y: number; rotate: number; water: boolean }[];
}

export type LabelSide =
  "left" | "right" | "above" | "below" | "upRight" | "downRight" | "upLeft" | "downLeft";

/** Placed pins for the screen: positions nudged apart, labels placed where they fit. */
export interface Pin {
  id: string;
  x: number;
  y: number;
  /** Where the name goes: beside, above or below the pin, wherever it fits. */
  label: LabelSide;
}
