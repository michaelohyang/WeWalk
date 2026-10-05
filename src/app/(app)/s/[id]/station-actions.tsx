"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { localToday, newId } from "@/client/ids";
import { send } from "@/client/outbox";
import { useToast } from "@/ui/Toast";
import styles from "./actions.module.css";

/** Rate / Check in buttons. Check-in is one tap; a note can be added after. */
export function StationActions({
  stationId,
  name,
  reviewed,
  myCheckins,
  firstVisit,
}: {
  stationId: string;
  name: string;
  reviewed: boolean;
  myCheckins: { id: string; visitedOn: string; note: string }[];
  firstVisit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const today = useMemo(() => localToday(), []);
  const existing = myCheckins.find((c) => c.visitedOn === today);
  const [checkin, setCheckin] = useState(existing ?? null);
  const [busy, setBusy] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(existing?.note ?? "");

  async function put(id: string, body: { note: string }, label: string) {
    setBusy(true);
    const result = await send({
      key: `checkin:${id}`,
      method: "PUT",
      url: `/api/checkins/${id}`,
      body: { stationId, visitedOn: today, ...body },
      label,
    });
    setBusy(false);
    return result;
  }

  async function checkIn() {
    const id = newId();
    const result = await put(id, { note: "" }, `Your check-in at ${name}`);
    if (result.status === "rejected") {
      if (result.httpStatus === 409) {
        toast("You already checked in here today.");
        router.refresh();
      } else toast(result.error.message);
      return;
    }
    setCheckin({ id, visitedOn: today, note: "" });
    if (result.status === "queued") {
      toast("Saved. It'll check in when you're back online.");
      return;
    }
    toast(firstVisit ? `Checked in. New passport stamp: ${name}!` : `Checked in at ${name}.`);
    router.refresh();
  }

  async function saveNote(e: React.FormEvent) {
    e.preventDefault();
    if (!checkin) return;
    const result = await put(checkin.id, { note }, `Your note at ${name}`);
    if (result.status === "rejected") {
      toast(result.error.message);
      return;
    }
    setCheckin({ ...checkin, note });
    setNoteOpen(false);
    toast(
      result.status === "queued"
        ? "Note saved. It'll post when you're back online."
        : "Note added.",
    );
    if (result.status === "sent") router.refresh();
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.actions}>
        <Link href={`/rate/${stationId}`} className={`${styles.btn} ${styles.primary}`}>
          {reviewed ? "Edit your rating" : "Rate it"}
        </Link>
        {checkin ? (
          <button
            type="button"
            className={styles.btn}
            onClick={() => setNoteOpen((o) => !o)}
            aria-expanded={noteOpen}
          >
            {checkin.note ? "Edit today's note" : "Checked in · add note"}
          </button>
        ) : (
          <button type="button" className={styles.btn} onClick={checkIn} disabled={busy}>
            {busy ? "Checking in…" : "Check in"}
          </button>
        )}
      </div>
      {checkin && noteOpen && (
        <form className={styles.note} onSubmit={saveNote}>
          <label htmlFor="checkin-note">Today&apos;s note</label>
          <textarea
            id="checkin-note"
            rows={2}
            maxLength={400}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="4th floor was dead quiet till the 11am all-hands. Oat milk was out again."
          />
          <button type="submit" className={`${styles.btn} ${styles.dark}`} disabled={busy}>
            Save note
          </button>
        </form>
      )}
    </div>
  );
}

/** Edit / Delete on your own review. Delete asks first. */
export function ReviewActions({ reviewId, stationId }: { reviewId: string; stationId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    const result = await send({
      key: `delete-review:${reviewId}`,
      method: "DELETE",
      url: `/api/reviews/${reviewId}`,
      label: "Deleting your review",
    });
    setBusy(false);
    setConfirming(false);
    if (result.status === "rejected") toast(result.error.message);
    else if (result.status === "queued")
      toast("Deleted on this phone. It'll sync when you're back online.");
    else {
      toast("Review deleted.");
      router.refresh();
    }
  }

  return (
    <div className={styles.reviewActions}>
      <Link href={`/rate/${stationId}`} className={styles.textBtn}>
        Edit
      </Link>
      {confirming ? (
        <span className={styles.confirm} role="group" aria-label="Delete this review?">
          <span>Delete for good?</span>
          <button
            type="button"
            className={`${styles.textBtn} ${styles.danger}`}
            onClick={remove}
            disabled={busy}
          >
            Delete
          </button>
          <button type="button" className={styles.textBtn} onClick={() => setConfirming(false)}>
            Keep it
          </button>
        </span>
      ) : (
        <button type="button" className={styles.textBtn} onClick={() => setConfirming(true)}>
          Delete
        </button>
      )}
    </div>
  );
}

/** After posting, a toast ("New passport stamp!") then a clean URL. */
export function PostedToast({ name }: { name: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const toast = useToast();
  const posted = params.get("posted");
  useEffect(() => {
    if (!posted) return;
    toast(
      posted === "stamp"
        ? `Posted. New passport stamp: ${name}!`
        : "Posted. The crew can see it now.",
    );
    router.replace(path, { scroll: false });
  }, [posted, name, path, router, toast]);
  return null;
}
