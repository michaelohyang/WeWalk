"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { sendCheckin } from "@/client/checkin";
import { localToday, newId } from "@/client/ids";
import { CITY_TIME_ZONE } from "@/domain/dates";
import type { ExploreView } from "@/server/services/views";
import { Avatar } from "@/ui/Avatar";
import { useToast } from "@/ui/Toast";
import styles from "./here-today.module.css";

type Here = ExploreView["hereToday"][number];

// The same on the server and in the browser, so the first render matches (New York time).
const clock = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: CITY_TIME_ZONE,
});

/**
 * Who in the crew checked in where today, with a one-tap "Join" that checks you in at the same
 * building. Hidden when nobody's out yet.
 */
export function HereToday({ here }: { here: Here[] }) {
  const router = useRouter();
  const toast = useToast();
  const [joined, setJoined] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mine = useMemo(() => here.find((h) => h.mine)?.stationSlug ?? joined, [here, joined]);

  if (!here.length) return null;

  async function join(h: Here) {
    setBusy(true);
    const result = await sendCheckin(
      newId(),
      { stationSlug: h.stationSlug, visitedOn: localToday(), note: "" },
      `Your check-in at ${h.stationName}`,
    );
    setBusy(false);
    if (result.status === "rejected") {
      toast(
        result.httpStatus === 409 ? "You already checked in there today." : result.error.message,
      );
      return;
    }
    setJoined(h.stationSlug);
    if (result.status === "queued") {
      toast("Saved. It'll check in when you're back online.");
      return;
    }
    toast(`Checked in at ${h.stationName}. Say hi to ${h.name}.`);
    router.refresh();
  }

  return (
    <section className={styles.card} aria-labelledby="here-today">
      <h2 id="here-today" className={styles.title}>
        <span className={styles.live} aria-hidden="true" />
        Here today
      </h2>
      <ul className={styles.list}>
        {here.map((h) => (
          <li key={h.memberId} className={styles.row}>
            <Avatar name={h.name} seed={h.memberId} />
            <p className={styles.text}>
              <b>{h.mine ? "You" : h.name}</b> {h.mine ? "are" : "is"} at{" "}
              <Link href={`/stations/${h.stationSlug}`}>{h.stationName}</Link>
              <span className={styles.since}>since {clock.format(new Date(h.since))}</span>
            </p>
            {!h.mine && mine !== h.stationSlug && (
              <button
                type="button"
                className={styles.join}
                onClick={() => join(h)}
                disabled={busy}
                aria-label={`Join ${h.name} at ${h.stationName}`}
              >
                Join
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
