import type { Metadata } from "next";
import { loadCrew } from "@/server/pages";
import { Avatar } from "@/ui/Avatar";
import { Empty } from "@/ui/Empty";
import { plural } from "@/ui/format";
import { Page, Section } from "@/ui/Page";
import { ThemeSwitch } from "@/ui/ThemeSwitch";
import styles from "./crew.module.css";

export const metadata: Metadata = { title: "Crew" };

const lastSeen = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default async function CrewPage() {
  const view = await loadCrew();
  if (!view) return null;
  const { me, devices, leaderboard } = view;

  return (
    <Page title="Crew">
      <div className={styles.me}>
        <Avatar name={me.name} seed={me.id} />
        <div>
          <b>{me.name}</b>
          <div className={styles.sub}>
            {me.isOwner ? "Runs this crew." : "Card-carrying member."} No passwords, ever.
          </div>
        </div>
      </div>

      <Section title="Your phones" note={devices.length}>
        <ul className={styles.devices}>
          {devices.map((d) => (
            <li key={d.id}>
              <span>{d.current ? "This phone" : d.label || "Another phone"}</span>
              <span className={styles.sub}>
                {d.current ? "signed in now" : `last seen ${lastSeen(d.lastSeenAt)}`}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Leaderboard" note="by stations visited">
        {leaderboard.length ? (
          <ol className={styles.board}>
            {leaderboard.map((m) => (
              <li key={m.memberId}>
                <Avatar name={m.name} seed={m.memberId} />
                <div className={styles.who}>
                  <b>{m.memberId === me.id ? `${m.name} (you)` : m.name}</b>
                  <span className={styles.sub}>
                    {plural(m.reviews, "review")} · {plural(m.checkins, "check-in")}
                  </span>
                  {m.hotTake && <span className={styles.take}>“{m.hotTake}”</span>}
                </div>
                <span
                  className={`${styles.count} ${m.stations === leaderboard[0]!.stations ? styles.first : ""}`}
                >
                  {m.stations}
                  <small>{m.stations === 1 ? "station" : "stations"}</small>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <Empty title="Leaderboard's empty.">
            Post one review and you&apos;re number one. Easiest win in New York.
          </Empty>
        )}
      </Section>

      <Section title="Appearance">
        <ThemeSwitch />
      </Section>
    </Page>
  );
}
