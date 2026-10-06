import type { Metadata } from "next";
import { loadCrew } from "@/server/pages";
import { Avatar } from "@/ui/Avatar";
import { Empty } from "@/ui/Empty";
import { plural } from "@/ui/format";
import { Page, Section } from "@/ui/Page";
import { ThemeSwitch } from "@/ui/ThemeSwitch";
import { InviteFriends, RecoveryLinks, Rename, SetPassword, SignOutPhone } from "./crew-controls";
import styles from "./crew.module.css";

export const metadata: Metadata = { title: "Crew" };

/** "Phone booths" → "phone booths" mid-sentence, but "Wi-Fi" stays as it is. */
const midSentence = (label: string) =>
  label
    .split(" ")
    .map((w) => (/[A-Z].*[A-Z]/.test(w) ? w : w.toLowerCase()))
    .join(" ");

const lastSeen = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default async function CrewPage() {
  const view = await loadCrew();
  if (!view) return null;
  const { me, devices, leaderboard, members, taste } = view;
  const top = leaderboard[0]?.stations;

  return (
    <Page title="Crew">
      <div className={styles.me}>
        <Avatar name={me.name} seed={me.id} />
        <div>
          <b>{me.name}</b>
          <div className={styles.sub}>
            {me.isOwner ? "Runs this crew." : "Card-carrying member."}
          </div>
        </div>
      </div>

      <Section title="Invite friends">
        <InviteFriends />
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
                <span className={`${styles.count} ${m.stations === top ? styles.first : ""}`}>
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

      <Section title="Taste match" note="from reviews you both wrote">
        {taste.length ? (
          <ul className={styles.taste}>
            {taste.map((t) => (
              <li key={t.memberId}>
                <Avatar name={t.name} seed={t.memberId} />
                <div className={styles.who}>
                  <b>{t.name}</b>
                  <span className={styles.sub}>
                    Most in sync on {midSentence(t.closest)}
                    {t.furthest && `, at war over ${midSentence(t.furthest.label)}`}
                    {` · ${plural(t.shared, "building")} in common`}
                  </span>
                </div>
                <span className={styles.match}>
                  {t.agreement}%<small>match</small>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No overlap yet.">
            Review a building a friend has reviewed and you&apos;ll see how your taste compares.
          </Empty>
        )}
      </Section>

      <Section title="You">
        <Rename name={me.name} />
      </Section>

      <Section title="Password">
        <SetPassword hasPassword={me.hasPassword} />
      </Section>

      <Section title="Signed in on" note={devices.length}>
        <ul className={styles.devices}>
          {devices.map((d) => (
            <li key={d.id}>
              <span>
                {d.current ? "This device" : d.label || "Another device"}
                <span className={styles.sub}>
                  {" "}
                  · {d.current ? "signed in now" : `last seen ${lastSeen(d.lastSeenAt)}`}
                </span>
              </span>
              <SignOutPhone deviceId={d.id} current={d.current} />
            </li>
          ))}
        </ul>
      </Section>

      {me.isOwner && members.length > 0 && (
        <Section title="Forgot password help">
          <RecoveryLinks members={members} />
        </Section>
      )}

      <Section title="Appearance">
        <ThemeSwitch />
      </Section>
    </Page>
  );
}
