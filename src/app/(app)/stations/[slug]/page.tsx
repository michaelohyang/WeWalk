import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CATEGORIES } from "@/domain/categories";
import { formatScore, tierOf } from "@/domain/scoring";
import { loadStation } from "@/server/pages";
import { Avatar } from "@/ui/Avatar";
import { Empty } from "@/ui/Empty";
import { areaColor, formatDate, plural, tierWord } from "@/ui/format";
import { Icon } from "@/ui/Icon";
import { Page, Section } from "@/ui/Page";
import { ScoreCircle } from "@/ui/ScoreCircle";
import { ReactionBar } from "./reaction-bar";
import { PostedToast, ReviewActions, StationActions } from "./station-actions";
import styles from "./station.module.css";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const view = await loadStation((await params).slug);
  return { title: view?.station.name ?? "Station" };
}

export default async function StationPage({ params }: Props) {
  const view = await loadStation((await params).slug);
  if (view === undefined) return null; // signed out: the layout explains
  if (view === null) notFound();
  const { station, categories, reviews, log } = view;
  const tier = tierOf(station.overall);
  const mine = reviews.find((r) => r.mine);

  return (
    <Page home>
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
              : "Nobody's been. Be the first."}
          </div>
        </div>
      </div>

      <StationActions
        stationSlug={station.slug}
        name={station.short}
        reviewed={!!mine}
        myCheckins={view.myCheckins}
        firstVisit={!station.mine}
      />
      <Suspense>
        <PostedToast name={station.short} color={areaColor(station.area)} />
      </Suspense>

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
              <li key={r.id} id={r.mine ? "my-review" : undefined} className={styles.post}>
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
                {r.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- resized on upload
                  <img
                    src={r.photoUrl}
                    alt={`${r.by}'s photo of ${station.name}`}
                    className={styles.photo}
                    loading="lazy"
                  />
                )}
                {r.mine && <ReviewActions reviewId={r.id} stationSlug={station.slug} />}
                {r.tags.length > 0 && (
                  <ul className={styles.tags}>
                    {r.tags.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                )}
                <ReactionBar reviewId={r.id} reactions={r.reactions} own={r.mine} />
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
                  <b>{formatDate(l.date)}</b>{" "}
                  <span className={styles.sub}>
                    · {l.mine ? `${l.by} (you)` : l.by} ·{" "}
                    {l.kind === "checkin" ? "checked in" : "reviewed"}
                  </span>
                  {l.note && <p>{l.note}</p>}
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
