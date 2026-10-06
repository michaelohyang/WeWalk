"use client";

import { useState } from "react";
import { send } from "@/client/outbox";
import type { ReactionKey, ReactionSummary as Reaction } from "@/domain/reactions";
import styles from "./ReactionBar.module.css";
import { useToast } from "./Toast";

/**
 * 🔥 💯 😂 🙅 under a review. Tapping toggles your reaction right away; the write goes through
 * the outbox, so it also works offline. On your own review the counts are shown, not buttons.
 */
export function ReactionBar({
  reviewId,
  reactions,
  own,
}: {
  reviewId: string;
  reactions: Reaction[];
  own: boolean;
}) {
  const toast = useToast();
  const [state, setState] = useState(reactions);

  if (own) {
    const got = state.filter((r) => r.count > 0);
    if (!got.length) return null;
    return (
      <ul className={styles.bar} aria-label="Reactions">
        {got.map((r) => (
          <li key={r.key} className={styles.static} title={r.by.join(", ")}>
            <span aria-hidden="true">{r.emoji}</span>
            <span className={styles.count}>{r.count}</span>
            <span className={styles.sr}>
              {r.label}: {r.by.join(", ")}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  const flip = (key: ReactionKey, on: boolean) =>
    setState((all) =>
      all.map((r) => (r.key === key ? { ...r, mine: on, count: r.count + (on ? 1 : -1) } : r)),
    );

  async function toggle(r: Reaction) {
    const on = !r.mine;
    flip(r.key, on);
    const result = await send({
      // One key per review and kind: tapping again before it's sent replaces the queued write.
      key: `reaction:${reviewId}:${r.key}`,
      method: on ? "PUT" : "DELETE",
      url: `/api/reviews/${reviewId}/reactions/${r.key}`,
      label: `Your ${r.emoji} reaction`,
    });
    if (result.status === "rejected") {
      flip(r.key, !on);
      toast(result.error.message);
    }
  }

  return (
    <div className={styles.bar} role="group" aria-label="React to this review">
      {state.map((r) => (
        <button
          key={r.key}
          type="button"
          className={styles.reaction}
          aria-pressed={r.mine}
          aria-label={`${r.label}${r.count ? `, ${r.count}` : ""}`}
          title={r.by.length ? r.by.join(", ") : r.label}
          onClick={() => toggle(r)}
        >
          <span aria-hidden="true">{r.emoji}</span>
          {r.count > 0 && <span className={styles.count}>{r.count}</span>}
        </button>
      ))}
    </div>
  );
}
