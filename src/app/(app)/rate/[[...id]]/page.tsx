import type { Metadata } from "next";
import { getSession } from "@/server/session";
import { Empty } from "@/ui/Empty";
import { Page } from "@/ui/Page";

export const metadata: Metadata = { title: "Rate" };

/** Phase 3 builds the rate flow; until then this says so plainly. */
export default async function RatePage({ params }: { params: Promise<{ id?: string[] }> }) {
  if (!(await getSession())) return null;
  const station = (await params).id?.[0];
  return (
    <Page title="Rate a station" back={station ? `/s/${station}` : "/"}>
      <Empty title="Coming in the next update.">
        Rating and check-ins arrive with the next release. Hold that hot take.
      </Empty>
    </Page>
  );
}
