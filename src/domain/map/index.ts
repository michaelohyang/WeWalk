/*
 * The schematic map, computed on the server: projection (lat/lng → map units), the shapes
 * drawn under the pins, and pin placement. Browser code imports only the types (map-types).
 */
export type { MapGeometry, Pin } from "../map-types";
export { MAP_HEIGHT, MAP_WIDTH, project } from "./projection";
export { geoLabelBox, geoLabelPoints, labelBoxes, layoutPins } from "./pins";
export { isOnLand, MAP_GEOMETRY } from "./shapes";
