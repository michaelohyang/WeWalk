import type { Metadata } from "next";
import { loadWelcome } from "@/server/pages";
import { Page } from "@/ui/Page";
import { JoinOrStart } from "./join-or-start";

export const metadata: Metadata = { title: "Welcome" };

/** For someone in no crew (they left their last one): join a crew by its link, or start one. */
export default async function WelcomePage() {
  const view = await loadWelcome();
  return (
    <Page title={`Hi, ${view.name}`} subtitle="You're not in a crew right now.">
      <JoinOrStart canStartCrew={view.canStartCrew} />
    </Page>
  );
}
