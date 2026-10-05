"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { fieldErrors } from "@/client/api";
import { clearDraft, lastStation, loadDraft, saveDraft } from "@/client/draft";
import { localToday, newId } from "@/client/ids";
import { send } from "@/client/outbox";
import { CATEGORIES, type CategoryKey, type Score } from "@/domain/categories";
import { TAGS, type Tag } from "@/domain/tags";
import type { RateView } from "@/server/services/views";
import { Icon } from "@/ui/Icon";
import { Page } from "@/ui/Page";
import { useToast } from "@/ui/Toast";
import styles from "./rate.module.css";

type Scores = Partial<Record<CategoryKey, Score>>;

interface Draft {
  id: string;
  scores: Scores;
  hotTake: string;
  body: string;
  tags: Tag[];
  visitedOn: string;
}

const SCORE_COLOR: Record<Score, string> = {
  1: "var(--s-bad)",
  2: "var(--s-ok)",
  3: "var(--s-ok)",
  4: "var(--s-good)",
  5: "var(--s-great)",
};

export function RateForm({ view }: { view: RateView }) {
  const router = useRouter();
  const toast = useToast();
  const station = view.stations.find((s) => s.id === view.stationId) ?? null;
  const draftKey = station ? `review:${station.id}` : null;
  const today = useMemo(() => localToday(), []);

  const initial = (): Draft => {
    const saved = draftKey ? loadDraft<Draft>(draftKey) : null;
    const base: Draft = view.existing
      ? { ...view.existing, scores: { ...view.existing.scores }, tags: [...view.existing.tags] }
      : { id: newId(), scores: {}, hotTake: "", body: "", tags: [], visitedOn: today };
    // A draft is your latest typing; it wins, but an existing review keeps its id.
    return saved ? { ...base, ...saved, id: view.existing?.id ?? saved.id } : base;
  };
  const [draft, setDraft] = useState<Draft>(initial);
  const [restored] = useState(() => !!(draftKey && loadDraft(draftKey)));
  const [moreOpen, setMoreOpen] = useState(
    () => !!(draft.hotTake || draft.body || draft.tags.length),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "saving" | "queued">("idle");
  const stationRef = useRef<HTMLSelectElement>(null);
  const scoresRef = useRef<HTMLDivElement>(null);

  // No station in the URL: start from the last one you rated.
  useEffect(() => {
    if (station) return;
    const last = lastStation.get();
    if (last && view.stations.some((s) => s.id === last)) router.replace(`/rate/${last}`);
  }, [station, view.stations, router]);

  const update = (patch: Partial<Draft>) =>
    setDraft((d) => {
      const next = { ...d, ...patch };
      if (draftKey) saveDraft(draftKey, next);
      return next;
    });

  const setScore = (key: CategoryKey, score: Score) => {
    update({ scores: { ...draft.scores, [key]: draft.scores[key] === score ? undefined : score } });
    setErrors((e) => {
      const next = { ...e };
      delete next.scores;
      return next;
    });
  };

  const discardDraft = () => {
    if (draftKey) clearDraft(draftKey);
    location.reload();
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problems: Record<string, string> = {};
    if (!station) problems.stationId = "Pick a building first.";
    const scores = Object.fromEntries(
      Object.entries(draft.scores).filter(([, v]) => v !== undefined),
    );
    if (!Object.keys(scores).length)
      problems.scores = "Rate at least one thing. Even just the vibe.";
    if (!draft.visitedOn || draft.visitedOn > today)
      problems.visitedOn = "Pick the day you went (not a future one).";
    setErrors(problems);
    if (Object.keys(problems).length || !station) {
      (problems.stationId
        ? stationRef
        : problems.scores
          ? scoresRef
          : null
      )?.current?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
      if (problems.visitedOn) setMoreOpen(true);
      return;
    }

    setState("saving");
    lastStation.set(station.id);
    const firstVisit = !view.visitedIds.includes(station.id);
    const result = await send({
      key: `review:${draft.id}`,
      method: "PUT",
      url: `/api/reviews/${draft.id}`,
      body: {
        stationId: station.id,
        visitedOn: draft.visitedOn,
        scores,
        hotTake: draft.hotTake,
        body: draft.body,
        tags: draft.tags,
      },
      label: `Your review of ${station.name}`,
    });

    if (result.status === "sent") {
      if (draftKey) clearDraft(draftKey);
      router.push(`/s/${station.id}?posted=${firstVisit ? "stamp" : "review"}`);
      return;
    }
    if (result.status === "queued") {
      if (draftKey) clearDraft(draftKey);
      setState("queued");
      return;
    }
    setState("idle");
    const { error, httpStatus } = result;
    if (httpStatus === 409 && error.details?.existingId) {
      // You reviewed this building on another phone: open that review, keeping what you typed.
      toast("You already reviewed this one. Opening it so you can edit.");
      router.refresh();
      return;
    }
    if (httpStatus === 401) {
      setErrors({
        form: "This phone is signed out. Open your crew's invite link or a pairing link.",
      });
      return;
    }
    const byField = fieldErrors(error);
    setErrors(Object.keys(byField).length ? byField : { form: error.message });
    if (byField.visitedOn || byField.hotTake || byField.body || byField.tags) setMoreOpen(true);
  }

  if (state === "queued") {
    return (
      <Page title="Saved." back={station ? `/s/${station.id}` : "/"}>
        <div className={styles.saved} role="status">
          <b>Saved on your phone. It&apos;ll post when you&apos;re back online.</b>
          No signal in the lobby? Classic. Leave the app open or come back later, and it goes out on
          its own.
        </div>
      </Page>
    );
  }

  return (
    <Page
      title={view.existing ? "Edit your rating" : "Rate a station"}
      back={station ? `/s/${station.id}` : "/"}
    >
      <form className={styles.form} onSubmit={submit} noValidate>
        <label className={styles.field}>
          <span>Station</span>
          <select
            ref={stationRef}
            className={styles.input}
            value={station?.id ?? ""}
            onChange={(e) => e.target.value && router.replace(`/rate/${e.target.value}`)}
            aria-invalid={!!errors.stationId}
            aria-describedby={errors.stationId ? "err-station" : undefined}
          >
            <option value="">Pick a building…</option>
            {view.stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.neighborhood}
              </option>
            ))}
          </select>
          {errors.stationId && (
            <span id="err-station" className={styles.error}>
              {errors.stationId}
            </span>
          )}
        </label>

        {restored && (
          <p className={styles.restored}>
            Picked up where you left off.{" "}
            <button type="button" className={styles.link} onClick={discardDraft}>
              Start over
            </button>
          </p>
        )}

        <div
          ref={scoresRef}
          className={styles.scores}
          role="group"
          aria-label="Scores"
          aria-describedby="scores-hint"
        >
          <p id="scores-hint" className={styles.hint}>
            Tap 1–5 for anything you tried. Skip the rest. Tap again to clear.
          </p>
          {errors.scores && <p className={styles.error}>{errors.scores}</p>}
          {CATEGORIES.map((c) => {
            const value = draft.scores[c.key];
            return (
              <div key={c.key} className={styles.tap}>
                <span className={styles.ic}>
                  <Icon name={c.key} size={20} />
                </span>
                <div className={styles.tapHead}>
                  <b id={`cat-${c.key}`}>{c.label}</b>
                  <span className={value ? styles.quipOn : styles.quip} aria-live="polite">
                    {value ? c.quips[value - 1] : c.hint}
                  </span>
                </div>
                <div className={styles.tokens} role="radiogroup" aria-labelledby={`cat-${c.key}`}>
                  {([1, 2, 3, 4, 5] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={value === n}
                      aria-label={`${n} out of 5`}
                      className={value === n ? styles.on : undefined}
                      style={value === n ? { background: SCORE_COLOR[n] } : undefined}
                      onClick={() => setScore(c.key, n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className={styles.more}
          aria-expanded={moreOpen}
          aria-controls="more"
          onClick={() => setMoreOpen((o) => !o)}
        >
          {moreOpen ? "Fewer details" : "Add more: hot take, review, tags, date"}
        </button>

        <div id="more" className={styles.moreBody} hidden={!moreOpen}>
          <label className={styles.field}>
            <span>Hot take</span>
            <input
              className={styles.input}
              maxLength={120}
              value={draft.hotTake}
              onChange={(e) => update({ hotTake: e.target.value })}
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
              onChange={(e) => update({ body: e.target.value })}
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
                    update({ tags: on ? draft.tags.filter((x) => x !== t) : [...draft.tags, t] })
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
              onChange={(e) => update({ visitedOn: e.target.value })}
              aria-invalid={!!errors.visitedOn}
            />
            {errors.visitedOn && <span className={styles.error}>{errors.visitedOn}</span>}
          </label>
        </div>

        <div className={styles.submitBar}>
          {errors.form && (
            <p className={styles.error} role="alert">
              {errors.form}
            </p>
          )}
          <button type="submit" className={styles.submit} disabled={state === "saving"}>
            {state === "saving" ? "Posting…" : view.existing ? "Save changes" : "Post review"}
          </button>
        </div>
      </form>
    </Page>
  );
}
