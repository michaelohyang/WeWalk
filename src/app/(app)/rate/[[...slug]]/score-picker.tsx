"use client";

import type { Ref } from "react";
import { CATEGORIES, type CategoryKey, type Score } from "@/domain/categories";
import { Icon } from "@/ui/Icon";
import type { Scores } from "./rate-form";
import styles from "./rate.module.css";

const SCORE_COLOR: Record<Score, string> = {
  1: "var(--s-bad)",
  2: "var(--s-ok)",
  3: "var(--s-ok)",
  4: "var(--s-good)",
  5: "var(--s-great)",
};

/**
 * One row of 1–5 radio tokens per category. Tap a score again to clear it; arrow keys move
 * within a row (the radio pattern), so each category is one Tab stop.
 */
export function ScorePicker({
  ref,
  scores,
  error,
  onChange,
}: {
  ref: Ref<HTMLDivElement>;
  scores: Scores;
  error?: string;
  onChange: (scores: Scores) => void;
}) {
  const arrowKeys = (e: React.KeyboardEvent, key: CategoryKey, value: Score | undefined) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = ((((value ?? (step > 0 ? 0 : 6)) + step - 1 + 5) % 5) + 1) as Score;
    onChange({ ...scores, [key]: next });
    const radios = e.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]");
    radios[next - 1]?.focus();
  };

  return (
    <div
      ref={ref}
      className={styles.scores}
      role="group"
      aria-label="Scores"
      aria-describedby="scores-hint"
    >
      <p id="scores-hint" className={styles.hint}>
        Rate what you tried. Skip the rest. Tap again to clear.
      </p>
      {error && <p className={styles.error}>{error}</p>}
      {CATEGORIES.map((c) => {
        const value = scores[c.key];
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
                  onClick={() => onChange({ ...scores, [c.key]: value === n ? undefined : n })}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
