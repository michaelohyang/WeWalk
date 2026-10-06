"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { fieldErrors } from "@/client/api";
import { clearDraft, loadDraft, saveDraft } from "@/client/draft";
import { localToday, newId } from "@/client/ids";
import { outcome, pending, send, subscribe } from "@/client/outbox";
import type { CategoryKey, Score } from "@/domain/categories";
import type { Tag } from "@/domain/tags";
import type { RateView } from "@/server/services/views";
import { ButtonLink } from "@/ui/Button";
import { Page } from "@/ui/Page";
import { useToast } from "@/ui/Toast";
import { DetailsFields } from "./details-fields";
import styles from "./rate.module.css";
import { ScorePicker } from "./score-picker";

export type Scores = Partial<Record<CategoryKey, Score>>;

export interface Draft {
  id: string;
  scores: Scores;
  hotTake: string;
  body: string;
  tags: Tag[];
  visitedOn: string;
  /** Typed before a building was picked, then carried over: not a draft to "pick up". */
  carried?: boolean;
}

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

  const setScores = (scores: Scores) => {
    update({ scores });
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

        <ScorePicker
          ref={scoresRef}
          scores={draft.scores}
          error={errors.scores}
          onChange={setScores}
        />

        <button
          type="button"
          className={styles.more}
          aria-expanded={moreOpen}
          aria-controls="more"
          onClick={() => setMoreOpen((o) => !o)}
        >
          {moreOpen ? "Fewer details" : "Add more: hot take, review, tags, date"}
        </button>

        <DetailsFields
          open={moreOpen}
          draft={draft}
          errors={errors}
          today={today}
          onChange={update}
        />

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
