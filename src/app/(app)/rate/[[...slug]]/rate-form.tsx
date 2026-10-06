"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { fieldErrors } from "@/client/api";
import { clearDraft, loadDraft, saveDraft } from "@/client/draft";
import { localToday, newId } from "@/client/ids";
import { outcome, pending, send, subscribe } from "@/client/outbox";
import { CATEGORIES, type CategoryKey, type Score } from "@/domain/categories";
import { TAGS, type Tag } from "@/domain/tags";
import type { RateView } from "@/server/services/views";
import { ButtonLink } from "@/ui/Button";
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
  /** Typed before a building was picked, then carried over: not a draft to "pick up". */
  carried?: boolean;
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
  const station = view.stations.find((s) => s.slug === view.stationSlug) ?? null;
  const draftKey = station ? `review:${station.slug}` : null;
  const today = useMemo(() => localToday(), []);
  const suggested = view.toReview.flatMap(
    ({ stationSlug }) => view.stations.find((s) => s.slug === stationSlug) ?? [],
  );

  const initial = (): Draft => {
    const saved = draftKey ? loadDraft<Draft>(draftKey) : null;
    const base: Draft = view.existing
      ? { ...view.existing, scores: { ...view.existing.scores }, tags: [...view.existing.tags] }
      : { id: newId(), scores: {}, hotTake: "", body: "", tags: [], visitedOn: today };
    // A draft is your latest typing; it wins, but an existing review keeps its id.
    if (!saved) return base;
    return { ...base, ...saved, carried: undefined, id: view.existing?.id ?? saved.id };
  };
  const [draft, setDraft] = useState<Draft>(initial);
  const [restored] = useState(() => {
    const saved = draftKey ? loadDraft<Draft>(draftKey) : null;
    return !!saved && !saved.carried;
  });
  const [moreOpen, setMoreOpen] = useState(
    () => !!(draft.hotTake || draft.body || draft.tags.length),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "saving" | "queued">("idle");
  const [posted, setPosted] = useState<string | null>(null);
  const stationRef = useRef<HTMLSelectElement>(null);
  const scoresRef = useRef<HTMLDivElement>(null);

  // No station in the URL: if you checked in somewhere today and haven't reviewed it, that's
  // almost certainly the one. Otherwise you pick (never silently open an old review to edit).
  useEffect(() => {
    if (station) return;
    const latest = view.toReview[0];
    if (latest && latest.visitedOn === today) router.replace(`/rate/${latest.stationSlug}`);
  }, [station, view.toReview, today, router]);

  // Saved offline: once it goes out, move on to the station like a normal post.
  useEffect(() => {
    if (state !== "queued" || !posted || !station) return;
    const check = () => {
      if (pending().some((j) => j.key === posted)) return;
      router.push(
        outcome(posted) === "rejected"
          ? `/stations/${station.slug}`
          : `/stations/${station.slug}?posted=review`,
      );
    };
    check();
    return subscribe(check);
  }, [state, posted, station, router]);

  const pickStation = (slug: string) => {
    if (!slug) return;
    // Keep what you've tapped so far, unless that building has its own draft already.
    const typed = Object.values(draft.scores).some(Boolean) || draft.hotTake || draft.body;
    if (!station && typed && !loadDraft(`review:${slug}`)) {
      saveDraft(`review:${slug}`, { ...draft, carried: true });
    }
    router.replace(`/rate/${slug}`);
  };

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

  const arrowKeys = (e: React.KeyboardEvent, key: CategoryKey, value: Score | undefined) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = ((((value ?? (step > 0 ? 0 : 6)) + step - 1 + 5) % 5) + 1) as Score;
    update({ scores: { ...draft.scores, [key]: next } });
    const radios = e.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]");
    radios[next - 1]?.focus();
  };

  const discardDraft = () => {
    if (draftKey) clearDraft(draftKey);
    location.reload();
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problems: Record<string, string> = {};
    if (!station) problems.stationSlug = "Pick a building first.";
    const scores = Object.fromEntries(
      Object.entries(draft.scores).filter(([, v]) => v !== undefined),
    );
    if (!Object.keys(scores).length)
      problems.scores = "Rate at least one thing. Even just the vibe.";
    if (!draft.visitedOn || draft.visitedOn > today)
      problems.visitedOn = "Pick the day you went (not a future one).";
    setErrors(problems);
    if (Object.keys(problems).length || !station) {
      (problems.stationSlug
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
    const firstVisit = !view.visitedSlugs.includes(station.slug);
    const key = `review:${draft.id}`;
    setPosted(key);
    const result = await send({
      key,
      method: "PUT",
      url: `/api/reviews/${draft.id}`,
      body: {
        stationSlug: station.slug,
        visitedOn: draft.visitedOn,
        scores,
        hotTake: draft.hotTake,
        body: draft.body,
        tags: draft.tags,
      },
      label: `Your review of ${station.name}`,
      draft: draftKey ?? undefined,
    });

    if (result.status === "sent") {
      if (draftKey) clearDraft(draftKey);
      router.push(`/stations/${station.slug}?posted=${firstVisit ? "stamp" : "review"}`);
      return;
    }
    if (result.status === "queued") {
      // The draft stays until the server has it: if it's ever refused, nothing is lost.
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
    const byField = fieldErrors(error);
    setErrors(Object.keys(byField).length ? byField : { form: error.message });
    if (byField.visitedOn || byField.hotTake || byField.body || byField.tags) setMoreOpen(true);
  }

  if (state === "queued") {
    return (
      <Page title="In the outbox." back={station ? `/stations/${station.slug}` : "/"}>
        <div className={styles.saved} role="status">
          <b>It posts itself the second you get a bar.</b>
          No signal in the lobby? Classic. It&apos;s safe on this phone. Keep the app open or come
          back later; either way it goes out on its own.
        </div>
        {station && (
          <ButtonLink href={`/stations/${station.slug}`} variant="plain">
            Back to {station.name}
          </ButtonLink>
        )}
      </Page>
    );
  }

  return (
    <Page
      title={
        view.existing ? "Edit your rating" : station ? `Rate ${station.name}` : "Rate a building"
      }
      back={station ? `/stations/${station.slug}` : "/"}
    >
      <form className={styles.form} onSubmit={submit} noValidate>
        <label className={styles.field}>
          <span>Building</span>
          <select
            ref={stationRef}
            className={styles.input}
            value={station?.slug ?? ""}
            onChange={(e) => pickStation(e.target.value)}
            aria-invalid={!!errors.stationSlug}
            aria-describedby={errors.stationSlug ? "err-station" : undefined}
          >
            <option value="">Pick a building…</option>
            {suggested.length > 0 && (
              <optgroup label="Checked in lately">
                {suggested.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.name} · {s.neighborhood}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="All buildings">
              {view.stations.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name} · {s.neighborhood}
                </option>
              ))}
            </optgroup>
          </select>
          {errors.stationSlug && (
            <span id="err-station" className={styles.error}>
              {errors.stationSlug}
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
            Rate what you tried. Skip the rest. Tap again to clear.
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
                <div
                  className={styles.tokens}
                  role="radiogroup"
                  aria-labelledby={`cat-${c.key}`}
                  onKeyDown={(e) => arrowKeys(e, c.key, value)}
                >
                  {([1, 2, 3, 4, 5] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={value === n}
                      aria-label={`${n} out of 5`}
                      // One Tab stop per category; arrow keys move within it (the radio pattern).
                      tabIndex={(value ?? 1) === n ? 0 : -1}
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
