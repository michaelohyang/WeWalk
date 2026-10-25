import type { Metadata } from "next";
import { JoinOrStart } from "@/app/welcome/join-or-start";
import { loadCrewDirectory } from "@/server/pages";
import { Page } from "@/ui/Page";
import { CrewPicker } from "./crew-picker";
import styles from "./crews.module.css";

export const metadata: Metadata = { title: "Find a crew" };

/** Every crew you can join, the phone's city first, and starting your own. */
export default async function CrewsPage() {
  const view = await loadCrewDirectory();
  if (!view) return null;
  return (
    <Page title="Find a crew" subtitle="Join as many as you like. Switch between them on Crew.">
      <div className={styles.stack}>
        <CrewPicker crews={view.crews} />
        <JoinOrStart canStartCrew={view.canStartCrew} defaultCity={view.city} />
      </div>
    </Page>
  );
}
