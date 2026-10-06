"use client";

import Link from "next/link";
import { CITY_TIME_ZONE } from "@/domain/dates";
import type { FeedEntry } from "@/server/services/views";
import { Avatar } from "@/ui/Avatar";
import { areaColor } from "@/ui/format";
import { ReactionBar } from "@/ui/ReactionBar";
import { ScoreCircle } from "@/ui/ScoreCircle";
import styles from "./feed.module.css";

// The same on the server and in the browser (New York time), so the first render matches.
const when = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: CITY_TIME_ZONE,
});

const name = (e: FeedEntry) => (e.mine ? "You" : e.by);

/** The crew's latest: reviews as cards (photo, score, hot take, reactions), check-ins as rows. */
export function Feed({ entries }: { entries: FeedEntry[] }) {
  return (
    <ol className={styles.feed} aria-label="Latest from the crew">
      {entries.map((e) =>
        e.kind === "review" ? (
          <li key={`r-${e.id}`} className={styles.card}>
            <div className={styles.head}>
              <Avatar name={e.by} seed={e.memberId} />
              <p className={styles.line}>
                <b>{name(e)}</b> reviewed{" "}
                <Link
                  href={`/stations/${e.station.slug}`}
                  className={styles.place}
                  style={{ "--c": areaColor(e.station.area) } as React.CSSProperties}
                >
                  {e.station.name}
                </Link>
                <time dateTime={e.at} className={styles.when}>
                  {when.format(new Date(e.at))}
                </time>
              </p>
              <ScoreCircle value={e.overall} size="sm" />
            </div>
            {e.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- resized on upload
              <img
                src={e.photoUrl}
                alt={`${e.by}'s photo of ${e.station.name}`}
                className={styles.photo}
                loading="lazy"
              />
            )}
            {e.hotTake && <p className={styles.take}>“{e.hotTake}”</p>}
            <ReactionBar reviewId={e.id} reactions={e.reactions} own={e.mine} />
          </li>
        ) : (
          <li key={`c-${e.id}`} className={styles.row}>
            <Avatar name={e.by} seed={e.memberId} />
            <p className={styles.line}>
              <b>{name(e)}</b> checked in at{" "}
              <Link
                href={`/stations/${e.station.slug}`}
                className={styles.place}
                style={{ "--c": areaColor(e.station.area) } as React.CSSProperties}
              >
                {e.station.name}
              </Link>
              <time dateTime={e.at} className={styles.when}>
                {when.format(new Date(e.at))}
              </time>
              {e.note && <span className={styles.note}>{e.note}</span>}
            </p>
          </li>
        ),
      )}
    </ol>
  );
}
