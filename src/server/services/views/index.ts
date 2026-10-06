/*
 * View models: exactly what each screen shows, as plain serializable data. Pages stay dumb;
 * the rules stay in domain/. One file per screen.
 */
export type { StationCard } from "./cards";
export { crewView, type CrewView } from "./crew";
export { exploreView, type AreaTile, type ExploreView, type FeedEntry } from "./explore";
export { passportView, type PassportView } from "./passport";
export { ranksView, type RanksView } from "./ranks";
export { rateView, type RateView } from "./rate";
export { stationView, type ReviewView, type StationView } from "./station";
