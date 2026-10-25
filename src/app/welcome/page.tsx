import type { Metadata } from "next";
import { loadWelcome } from "@/server/pages";
import { Page } from "@/ui/Page";
import { WelcomeSteps } from "./steps";

export const metadata: Metadata = { title: "Welcome" };

/**
 * The welcome steps for someone new (city, crew, first rating), or just the crew step for
 * someone in no crew (they left their last one).
 */
export default async function WelcomePage() {
  const view = await loadWelcome();
  return (
    <Page
      title={view.onboarded ? `Hi, ${view.name}` : `Welcome, ${view.name}`}
      subtitle={view.onboarded ? "You're not in a crew right now." : "Let's get you set up."}
    >
      <WelcomeSteps
        onboarded={view.onboarded}
        crew={view.crew}
        city={view.city}
        canStartCrew={view.canStartCrew}
        deviceId={view.deviceId}
        directory={view.directory}
      />
    </Page>
  );
}
