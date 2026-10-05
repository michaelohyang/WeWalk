import { loadExplore } from "@/server/pages";
import { Explore } from "./explore";

export default async function ExplorePage() {
  const view = await loadExplore();
  return view && <Explore view={view} />;
}
