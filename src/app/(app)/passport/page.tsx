import type { Metadata } from "next";
import Link from "next/link";
import { loadPassport } from "@/server/pages";
import { Empty } from "@/ui/Empty";
import { areaColor, formatDate, tileText } from "@/ui/format";
import { Page, Section } from "@/ui/Page";
import styles from "./passport.module.css";

export const metadata: Metadata = { title: "Passport" };

function streakLine({ weeks, thisWeek }: { weeks: number; thisWeek: boolean }) {
  if (!weeks) return "Visit any building this week to start a streak.";
  const run = `${weeks}-week streak`;
  return thisWeek ? `🔥 ${run}` : `🔥 ${run}. Visit this week to keep it going.`;
}

function quip(pct: number) {
  if (pct === 0) return "Fresh passport. Not a single stamp. Bold.";
  if (pct < 25) return "Barely out of the lobby. Keep going.";
  if (pct < 50) return "Respectable. Your MetroCard is sweating.";
  if (pct < 100) return "Seasoned. You have opinions about elevator banks.";
  return "Every single one. Touch grass, then go again.";
}

export default async function PassportPage() {
  const view = await loadPassport();
  if (!view) return null;
  const mine = view.stamps.length;
  const frac = view.total ? mine / view.total : 0;
  const pct = Math.round(frac * 100);
  const C = 2 * Math.PI * 40;

  return (
    <Page title="Passport">
      <div className={styles.summary}>
        <svg
          viewBox="0 0 100 100"
          className={styles.ring}
          role="img"
          aria-label={`${pct}% of stations visited`}
        >
          <circle cx="50" cy="50" r="40" className={styles.track} />
          <circle
            cx="50"
            cy="50"
            r="40"
            className={styles.progress}
            strokeDasharray={`${(C * frac).toFixed(1)} ${C.toFixed(1)}`}
            transform="rotate(-90 50 50)"
          />
          <text x="50" y="57" textAnchor="middle" className={styles.pct}>
            {pct}%
          </text>
        </svg>
        <div>
          <div className={styles.big}>
            {mine}
            <span> / {view.total} stations</span>
          </div>
          <p>{quip(pct)}</p>
          <p className={styles.crew}>
            Crew: {view.crewVisited} / {view.total}
          </p>
          <p className={styles.streak}>{streakLine(view.streak)}</p>
        </div>
      </div>

      <Section
        title="Badges"
        note={`${view.badges.filter((b) => b.earned).length} of ${view.badges.length}`}
      >
        <ul className={styles.badges}>
          {view.badges.map((b) => (
            <li key={b.key} className={b.earned ? styles.earned : styles.locked}>
              <span className={styles.badgeIcon} aria-hidden="true">
                {b.emoji}
              </span>
              <span className={styles.badgeText}>
                <b>{b.title}</b>
                <span>
                  {b.earned ? b.detail : `${b.detail} · ${b.progress.have} / ${b.progress.need}`}
                </span>
                {!b.earned && (
                  <span className={styles.bar} aria-hidden="true">
                    <span style={{ width: `${(100 * b.progress.have) / b.progress.need}%` }} />
                  </span>
                )}
              </span>
              <span className={styles.sr}>{b.earned ? "Earned" : "Not yet"}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Your stamps" note={mine || undefined}>
        {mine ? (
          <ul className={styles.stamps}>
            {view.stamps.map(({ station, firstVisit }) => (
              <li key={station.slug}>
                <Link
                  href={`/stations/${station.slug}`}
                  prefetch={false}
                  className={styles.stamp}
                  style={{ "--c": areaColor(station.area) } as React.CSSProperties}
                  aria-label={`${station.name}, first visit ${formatDate(firstVisit)}`}
                >
                  <span className={styles.seal} aria-hidden="true">
                    {tileText(station.name)}
                  </span>
                  <span className={styles.name}>{station.short}</span>
                  <span className={styles.date}>{formatDate(firstVisit)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No stamps yet.">Check in somewhere and one lands right here.</Empty>
        )}
      </Section>

      {view.notYet.length > 0 && (
        <Section title="Still out there" note={`${view.notYet.length} to go`}>
          <ul className={styles.stamps}>
            {view.notYet.map((station) => (
              <li key={station.slug}>
                <Link
                  href={`/stations/${station.slug}`}
                  prefetch={false}
                  className={`${styles.stamp} ${styles.slot}`}
                  aria-label={`${station.name}, not visited${station.visited ? ", the crew has been" : ""}`}
                >
                  <span className={styles.seal} aria-hidden="true">
                    ?
                  </span>
                  <span className={styles.name}>{station.short}</span>
                  {station.visited && <span className={styles.crewBeen}>Crew&apos;s been</span>}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </Page>
  );
}
