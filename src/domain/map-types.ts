/*
 * Types for drawing the map, with no runtime code: browser components import these, while the
 * projection, shoreline and station data (domain/map, geo, stations) stay on the server.
 */

/** Everything static the map needs to draw, as plain data. */
export interface MapGeometry {
  width: number;
  height: number;
  land: readonly { name: string; far: boolean; d: string }[];
  /**
   * Street texture: each borough's grid lines (`major` every few, drawn bolder), faded out at its
   * `shore`, and Broadway.
   */
  streets: {
    manhattan: BoroughStreets;
    brooklyn: BoroughStreets;
    broadway: string;
  };
  /** Water and borough names, with a rotation for the rivers. */
  labels: readonly { text: string; x: number; y: number; rotate: number; water: boolean }[];
}

export interface BoroughStreets {
  minor: string;
  major: string;
  shore: string;
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
