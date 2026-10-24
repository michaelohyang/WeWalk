"use client";

import * as ToggleGroup from "@radix-ui/react-toggle-group";
import type { Ref } from "react";
import { CATEGORIES, type Score } from "@/domain/categories";
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

/** The toggle group's value back to a score: "" means the score was cleared. */
const toScore = (v: string): Score | undefined => (v ? (Number(v) as Score) : undefined);

/**
 * One row of 1–5 radio tokens per category. Tap a score again to clear it. Each row is one Tab
 * stop; arrow keys move within it, and Space or Enter picks.
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
            <ToggleGroup.Root
              type="single"
              className={styles.tokens}
              aria-labelledby={`cat-${c.key}`}
              value={value ? String(value) : ""}
              onValueChange={(v) => onChange({ ...scores, [c.key]: toScore(v) })}
            >
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <ToggleGroup.Item
                  key={n}
                  value={String(n)}
                  aria-label={`${n} out of 5`}
                  className={value === n ? styles.on : undefined}
                  style={value === n ? { background: SCORE_COLOR[n] } : undefined}
                >
                  {n}
                </ToggleGroup.Item>
              ))}
            </ToggleGroup.Root>
          </div>
        );
      })}
    </div>
  );
}
