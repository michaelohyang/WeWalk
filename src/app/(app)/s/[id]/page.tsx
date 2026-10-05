import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATEGORIES } from "@/domain/categories";
import { formatScore, tierOf } from "@/domain/scoring";
import { loadStation } from "@/server/pages";
import { Avatar } from "@/ui/Avatar";
import { ButtonLink } from "@/ui/Button";
import { Empty } from "@/ui/Empty";
import { areaColor, formatDate, plural, tierWord } from "@/ui/format";
import { Icon } from "@/ui/Icon";
import { Page, Section } from "@/ui/Page";
import { ScoreCircle } from "@/ui/ScoreCircle";
import styles from "./station.module.css";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const view = await loadStation((await params).id);
  return { title: view?.station.name ?? "Station" };
}

export default async function StationPage({ params }: Props) {
  const view = await loadStation((await params).id);
  if (view === undefined) return null; // signed out: the layout explains
  if (view === null) notFound();
  const { station, categories, reviews, log } = view;
  const tier = tierOf(station.overall);
  const mine = reviews.find((r) => r.mine);

  return (
    <Page back="/">
      <header className={styles.hero}>
        <span
          className={styles.hood}
          style={{ "--c": areaColor(station.area) } as React.CSSProperties}
        >
          {station.neighborhood}
        </span>
        <h1>{station.name}</h1>
        <p className={styles.addr}>{station.address}</p>
      </header>

      <div className={styles.scorebox}>
        <ScoreCircle value={station.overall} size="lg" />
        <div>
          <div className={styles.verdict}>{tierWord(tier)}</div>
          <div className={styles.sub}>
            {station.reviewCount
              ? `Crew score from ${plural(station.reviewCount, "review")}`
              : "No ratings yet"}
          </div>
          <div className={styles.sub}>
            {station.lastVisit
              ? `Last visit ${formatDate(station.lastVisit)}`
              : "Never visited (yet)"}
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <ButtonLink href={`/rate/${station.id}`} variant="primary">
          {mine ? "Edit your rating" : "Rate it"}
        </ButtonLink>
        <ButtonLink href={`/rate/${station.id}?checkin=1`}>Check in</ButtonLink>
      </div>

      {station.hotTake && (
        <figure className={styles.hot}>
          <figcaption>Hot take</figcaption>
          <blockquote>{station.hotTake.text}</blockquote>
          <span>— {station.hotTake.by}</span>
        </figure>
      )}

      <Section title="Scorecard" note={station.reviewCount ? "out of 5" : undefined}>
        {station.reviewCount ? (
          <ul className={styles.rates}>
            {CATEGORIES.map((c) => {
              const value = categories.find((x) => x.key === c.key)?.value ?? null;
              const t = tierOf(value);
              return (
                <li
                  key={c.key}
                  className={styles.rate}
                  style={
                    {
                      "--c": t ? `var(--s-${t})` : "var(--muted)",
                      "--ink": t ? `var(--s-${t}-ink)` : "var(--muted)",
                    } as React.CSSProperties
                  }
                >
                  <span className={styles.ic}>
                    <Icon name={c.key} size={20} />
                  </span>
                  <span className={styles.label}>
                    {c.label}
                    <small>{c.hint}</small>
                  </span>
                  <span className={styles.bar} aria-hidden="true">
                    <i style={{ width: `${value === null ? 0 : (value / 5) * 100}%` }} />
                  </span>
                  <span
                    className={styles.value}
                    aria-label={value === null ? "not rated" : `${formatScore(value)} out of 5`}
                  >
                    {formatScore(value)}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty title="Unrated.">
            The coffee is unjudged and the phone booths are unaccounted for.
          </Empty>
        )}
      </Section>

      {station.tags.length > 0 && (
        <Section title="Known for">
          <ul className={styles.tags}>
            {station.tags.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Reviews" note={reviews.length || undefined}>
        {reviews.length ? (
          <ul className={styles.posts}>
            {reviews.map((r) => (
              <li key={r.id} className={styles.post}>
                <div className={styles.postHead}>
                  <Avatar name={r.by} seed={r.memberId} />
                  <div>
                    <div className={styles.who}>{r.mine ? `${r.by} (you)` : r.by}</div>
                    <div className={styles.sub}>{formatDate(r.visitedOn)}</div>
                  </div>
                  <ScoreCircle value={r.overall} size="sm" />
                </div>
                {r.hotTake && <p className={styles.postHot}>“{r.hotTake}”</p>}
                {r.body && <p className={styles.body}>{r.body}</p>}
                {r.tags.length > 0 && (
                  <ul className={styles.tags}>
                    {r.tags.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="Crickets.">First review gets to set the narrative.</Empty>
        )}
      </Section>

      <Section title="Visit log">
        {log.length ? (
          <ol className={styles.log}>
            {log.map((l, i) => (
              <li key={i}>
                <div>
                  <b>{formatDate(l.date)}</b> <span className={styles.sub}>· {l.by}</span>
                  <p>{l.text}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.sub}>Nobody&apos;s checked in yet.</p>
        )}
      </Section>
    </Page>
  );
}
