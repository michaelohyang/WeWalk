import type { Metadata } from "next";
import { loadMap } from "@/server/pages";
import { plural } from "@/ui/format";
import { Page } from "@/ui/Page";
import { StationMap } from "@/ui/StationMap";

export const metadata: Metadata = { title: "Map" };

export default async function MapPage() {
  const view = await loadMap();
  if (!view) return null;
  return (
    <Page
      title="Map"
      subtitle={`${plural(view.stations.length, "station")}, colored by crew score`}
      back="/"
    >
      <StationMap pins={view.stations} />
    </Page>
  );
}
