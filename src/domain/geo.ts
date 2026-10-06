/**
 * Rough NYC shorelines as [lat, lng] rings, enough for a schematic map, not navigation.
 * Rings that reach the edge of the map extend well past it; the map clips them.
 */
export type LatLng = readonly [lat: number, lng: number];

export const MANHATTAN: readonly LatLng[] = [
  // Battery, up the Hudson side
  [40.7003, -74.015],
  [40.706, -74.019],
  [40.7125, -74.016],
  [40.72, -74.013],
  [40.729, -74.011],
  [40.738, -74.01],
  [40.745, -74.009],
  [40.754, -74.008],
  [40.762, -74.001],
  [40.771, -73.994],
  [40.782, -73.987],
  [40.796, -73.977],
  [40.81, -73.965],
  [40.823, -73.956],
  [40.84, -73.947],
  // back down the Harlem River and East River side
  [40.84, -73.934],
  [40.824, -73.934],
  [40.815, -73.933],
  [40.807, -73.93],
  [40.798, -73.929],
  [40.79, -73.938],
  [40.784, -73.943],
  [40.771, -73.948],
  [40.761, -73.956],
  [40.754, -73.962],
  [40.748, -73.968],
  [40.744, -73.971],
  [40.736, -73.974],
  [40.729, -73.973],
  [40.719, -73.974],
  [40.711, -73.979],
  [40.708, -73.991],
  [40.706, -73.998],
  [40.703, -74.006],
  [40.701, -74.011],
];

export const BROOKLYN: readonly LatLng[] = [
  [40.739, -73.955], // Greenpoint, at Newtown Creek
  [40.73, -73.96],
  [40.722, -73.963],
  [40.715, -73.968],
  [40.708, -73.97],
  [40.704, -73.976],
  [40.702, -73.985],
  [40.704, -73.99],
  [40.703, -73.995],
  [40.696, -73.999],
  [40.688, -74.001],
  [40.68, -74.006],
  [40.675, -74.016],
  [40.64, -74.03],
  [40.64, -73.86],
  [40.72, -73.86],
];

export const QUEENS: readonly LatLng[] = [
  [40.74, -73.954],
  [40.747, -73.958],
  [40.756, -73.948],
  [40.765, -73.94],
  [40.775, -73.932],
  [40.784, -73.92],
  [40.86, -73.9],
  [40.86, -73.84],
  [40.72, -73.84],
];

export const NEW_JERSEY: readonly LatLng[] = [
  [40.66, -74.04],
  [40.7, -74.035],
  [40.715, -74.033],
  [40.73, -74.03],
  [40.74, -74.028],
  [40.75, -74.022],
  [40.765, -74.013],
  [40.78, -74.005],
  [40.795, -73.995],
  [40.81, -73.983],
  [40.83, -73.97],
  [40.86, -73.955],
  [40.86, -74.12],
  [40.66, -74.12],
];

export const ROOSEVELT_ISLAND: readonly LatLng[] = [
  [40.752, -73.96],
  [40.76, -73.952],
  [40.77, -73.944],
  [40.772, -73.946],
  [40.762, -73.954],
  [40.753, -73.962],
];

export const GOVERNORS_ISLAND: readonly LatLng[] = [
  [40.695, -74.018],
  [40.693, -74.013],
  [40.687, -74.012],
  [40.685, -74.018],
  [40.689, -74.023],
];

/** A point on Manhattan's grid near E 63rd St: the map compresses everything north of it. */
export const COMPRESS_NORTH_OF: LatLng = [40.7655, -73.9675];

/** Broadway, Bowling Green to 125th St: the one avenue that cuts across the grid. */
export const BROADWAY: readonly LatLng[] = [
  [40.7049, -74.0137],
  [40.7128, -74.006],
  [40.719, -74.002],
  [40.7253, -73.997],
  [40.7359, -73.9906],
  [40.7411, -73.9897],
  [40.7497, -73.9877],
  [40.757, -73.986],
  [40.7681, -73.9819],
  [40.7788, -73.9819],
  [40.7937, -73.9722],
  [40.8076, -73.964],
  [40.8148, -73.959],
];

/**
 * Street-grid patches: each neighborhood's grid runs at its own angle, so lines meet at slight
 * kinks along Houston St, Chambers St and the Brooklyn neighborhoods, the way the real city does.
 * `tilt` is the avenues' bearing in degrees east of north; `avenue` and `street` are the line
 * spacings in meters (about every block across, every few blocks along). Each `area` is a rough
 * outline that may run into the water: the map clips the lines to the shore.
 */
export interface GridPatch {
  name: string;
  borough: "manhattan" | "brooklyn";
  tilt: number;
  avenue: number;
  street: number;
  area: readonly LatLng[];
}

/** The Commissioners' grid's bearing. The map is turned by this much, so its avenues run upright. */
export const GRID_TILT_DEG = 30;

export const STREET_GRIDS: readonly GridPatch[] = [
  {
    name: "Midtown and up, plus the East Village",
    borough: "manhattan",
    tilt: GRID_TILT_DEG,
    avenue: 270,
    street: 400,
    area: [
      [40.7425, -74.03], // 14th St at the Hudson
      [40.7375, -73.9965], // 14th St & 6th Ave
      [40.7287, -74.0025], // Houston & 6th Ave
      [40.7243, -73.9925], // Houston & Bowery
      [40.716, -73.965], // Houston at the East River
      [40.86, -73.9],
      [40.86, -74.0],
    ],
  },
  {
    name: "West Village",
    borough: "manhattan",
    tilt: 8,
    avenue: 200,
    street: 260,
    area: [
      [40.7425, -74.03],
      [40.7375, -73.9965],
      [40.7287, -74.0025],
      [40.7265, -74.03],
    ],
  },
  {
    name: "SoHo, Tribeca and the Lower East Side",
    borough: "manhattan",
    tilt: 25,
    avenue: 180,
    street: 230,
    area: [
      [40.7265, -74.03],
      [40.7287, -74.0025],
      [40.7243, -73.9925],
      [40.716, -73.965],
      [40.709, -73.965],
      [40.711, -73.995], // Chinatown, under the bridges
      [40.7172, -74.03], // Chambers St at the Hudson
    ],
  },
  {
    name: "Financial District",
    borough: "manhattan",
    tilt: 52,
    avenue: 150,
    street: 190,
    area: [
      [40.7172, -74.03],
      [40.711, -73.995],
      [40.709, -73.965],
      [40.69, -73.965],
      [40.69, -74.03],
    ],
  },
  {
    name: "Williamsburg and Greenpoint",
    borough: "brooklyn",
    tilt: 32,
    avenue: 240,
    street: 300,
    area: [
      [40.706, -73.99],
      [40.75, -73.97],
      [40.75, -73.84],
      [40.69, -73.84],
      [40.698, -73.96],
    ],
  },
  {
    name: "DUMBO, Brooklyn Heights and Downtown Brooklyn",
    borough: "brooklyn",
    tilt: 18,
    avenue: 220,
    street: 280,
    area: [
      [40.706, -73.99],
      [40.698, -73.96],
      [40.69, -73.84],
      [40.62, -73.84],
      [40.62, -74.04],
      [40.706, -74.04],
    ],
  },
];
