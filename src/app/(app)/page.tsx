import { loadExplore } from "@/server/pages";
import { Explore } from "./explore";

export default async function ExplorePage() {
  const view = await loadExplore();
  // A new city resets the filters and the map's bounds.
  return view && <Explore key={view.city} view={view} />;
}
