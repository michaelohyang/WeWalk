import type { Metadata } from "next";
import { loadStationAdmin } from "@/server/pages";
import { Empty } from "@/ui/Empty";
import { plural } from "@/ui/format";
import { Page, Section } from "@/ui/Page";
import styles from "./admin.module.css";
import { AddStation, EditStation } from "./station-forms";

export const metadata: Metadata = { title: "Buildings" };

export default async function StationAdminPage() {
  const view = await loadStationAdmin();
  if (view === undefined) return null; // signed out: the layout explains
  if (view === null) {
    return (
      <Page title="Owner only" back="/crew">
        <Empty title="This page is for the crew owner.">
          Only the owner can add, edit or hide buildings.
        </Empty>
      </Page>
    );
  }

  return (
    <Page
      title="Buildings"
      subtitle="Add, edit and hide WeWorks. Changes show up right away."
      back="/crew"
    >
      <Section title="Add a building">
        <AddStation />
      </Section>

      {view.cities.map((city) => (
        <Section key={city.key} title={city.name} note={plural(city.count, "building")}>
          {city.areas.map((area) => (
            <div key={area.key} className={styles.area}>
              <h3>{area.label}</h3>
              <ul className={styles.list}>
                {area.stations.map((s) => (
                  <li key={s.slug}>
                    <EditStation station={s} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Section>
      ))}
    </Page>
  );
}
