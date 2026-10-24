"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { request } from "@/client/api";
import { CITY_TIME_ZONE } from "@/domain/dates";
import { photoSize } from "@/domain/photos";
import type { ReportView } from "@/server/services/views";
import { ConfirmDialog } from "@/ui/ConfirmDialog";
import forms from "@/ui/forms.module.css";
import { useToast } from "@/ui/Toast";
import styles from "./crew.module.css";

const day = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: CITY_TIME_ZONE,
});

type Action = "hide" | "remove" | "dismiss";

/** The owner's (or admin's) list of reported posts, each with hide, remove and dismiss. */
export function ReportQueue({ reports }: { reports: ReportView[] }) {
  return (
    <ul className={styles.reports}>
      {reports.map((r) => (
        <Report key={r.id} report={r} />
      ))}
    </ul>
  );
}

function Report({ report: r }: { report: ReportView }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const what = r.kind === "review" ? "review" : "check-in";

  async function act(action: Action) {
    if (busy) return;
    setBusy(true);
    const res = await request("POST", `/api/reports/${r.id}`, { action });
    setBusy(false);
    if (!res.ok) {
      toast(res.error.message);
      router.refresh();
      return;
    }
    toast(
      action === "hide"
        ? `${r.author}'s ${what} is out of the crew.`
        : action === "remove"
          ? `${r.author} is out. Make a new invite link so they can't rejoin with a new account.`
          : "Report dismissed.",
    );
    router.refresh();
  }

  return (
    <li className={styles.report}>
      <p className={styles.reportHead}>
        <b>
          {r.author}&apos;s {what}
        </b>{" "}
        at {r.place}
        <span className={styles.sub}>
          reported by {r.reporter ?? "someone who has since left"} on {day.format(new Date(r.at))}
          {r.otherCrew && ` in ${r.otherCrew}`}
        </span>
      </p>
      <blockquote className={styles.reported}>
        {r.hotTake && <p className={styles.reportedTake}>“{r.hotTake}”</p>}
        {r.body && <p>{r.body}</p>}
        {r.note && <p>{r.note}</p>}
        {r.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- resized on upload
          <img
            src={r.photoUrl}
            {...photoSize(r.photoUrl)}
            alt={`${r.author}'s photo`}
            className={styles.reportedPhoto}
            loading="lazy"
          />
        )}
        {!r.hotTake && !r.body && !r.note && !r.photoUrl && (
          <p className={styles.sub}>Scores only, no words or photo.</p>
        )}
      </blockquote>
      {r.reason && <p className={styles.reason}>Why: {r.reason}</p>}
      <div className={styles.reportActions}>
        <ConfirmDialog
          trigger={
            <button type="button" className={forms.secondary} disabled={busy}>
              Hide from crew
            </button>
          }
          title={`Take this ${what} out of ${r.otherCrew ?? "the crew"}?`}
          description={`Nobody in ${r.otherCrew ?? "the crew"} will see it again, and ${r.author} can't share it back. It stays in their other crews.`}
          confirmLabel="Hide it"
          onConfirm={() => void act("hide")}
        />
        {!r.authorIsOwner && (
          <ConfirmDialog
            trigger={
              <button type="button" className={forms.textBtn} disabled={busy}>
                Remove {r.author}
              </button>
            }
            title={`Remove ${r.author} from the crew?`}
            description={`Their posts come out of the crew and they can't rejoin with an invite link. Make a new invite link afterwards, so they can't come back with a new account.`}
            confirmLabel={`Remove ${r.author}`}
            onConfirm={() => void act("remove")}
          />
        )}
        <button
          type="button"
          className={forms.textBtn}
          disabled={busy}
          onClick={() => void act("dismiss")}
        >
          Dismiss
        </button>
      </div>
    </li>
  );
}
