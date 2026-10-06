"use client";

import { TAGS } from "@/domain/tags";
import { PhotoField } from "./photo-field";
import type { Draft } from "./rate-form";
import styles from "./rate.module.css";

/** The optional part of a review: hot take, full review, tags and the visit date. */
export function DetailsFields({
  open,
  draft,
  errors,
  today,
  onChange,
}: {
  open: boolean;
  draft: Draft;
  errors: Record<string, string>;
  today: string;
  onChange: (patch: Partial<Draft>) => void;
}) {
  return (
    <div id="more" className={styles.moreBody} hidden={!open}>
      <PhotoField url={draft.photoUrl ?? null} onChange={(photoUrl) => onChange({ photoUrl })} />
      <label className={styles.field}>
        <span>Hot take</span>
        <input
          className={styles.input}
          maxLength={120}
          value={draft.hotTake}
          onChange={(e) => onChange({ hotTake: e.target.value })}
          placeholder="The phone booths here are a hostage situation."
          aria-invalid={!!errors.hotTake}
        />
        {errors.hotTake && <span className={styles.error}>{errors.hotTake}</span>}
      </label>
      <label className={styles.field}>
        <span>Review</span>
        <textarea
          className={styles.input}
          rows={4}
          maxLength={1200}
          value={draft.body}
          onChange={(e) => onChange({ body: e.target.value })}
          placeholder="Got here at 9:40 and every window seat was taken by a guy with three monitors. Cold brew's legit though."
          aria-invalid={!!errors.body}
        />
        {errors.body && <span className={styles.error}>{errors.body}</span>}
      </label>
      <fieldset className={styles.tags}>
        <legend>Tags</legend>
        {TAGS.map((t) => {
          const on = draft.tags.includes(t);
          return (
            <button
              key={t}
              type="button"
              aria-pressed={on}
              onClick={() =>
                onChange({ tags: on ? draft.tags.filter((x) => x !== t) : [...draft.tags, t] })
              }
            >
              {t}
            </button>
          );
        })}
      </fieldset>
      <label className={styles.field}>
        <span>Visited</span>
        <input
          type="date"
          className={styles.input}
          value={draft.visitedOn}
          max={today}
          onChange={(e) => onChange({ visitedOn: e.target.value })}
          aria-invalid={!!errors.visitedOn}
        />
        {errors.visitedOn && <span className={styles.error}>{errors.visitedOn}</span>}
      </label>
    </div>
  );
}
