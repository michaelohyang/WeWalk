/* Readable names for buildings (kept out of domain/stations.ts, whose seed list stays on the server). */

/**
 * A name to show when you pick or open a building. Most are named by their street address
 * ("8 W 126th St"), which says nothing on its own, so those read "WeWork Harlem" (with the
 * address shown alongside); real building names ("Dumbo Heights", "Coda") stay as they are.
 */
export function placeName(station: { name: string; neighborhood: string }): string {
  return /^\d/.test(station.name) ? `WeWork ${station.neighborhood}` : station.name;
}

/** "WeWork Financial District · 85 Broad St": a place name that's unique, for compact spots. */
export function placeNameWithStreet(station: { name: string; neighborhood: string }): string {
  const place = placeName(station);
  return place === station.name ? place : `${place} · ${station.name}`;
}
