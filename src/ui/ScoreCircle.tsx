import { formatScore, tierOf } from "@/domain/scoring";
import styles from "./ScoreCircle.module.css";

/** A score out of 5 in a colored ring. Empty (dashed) when there's no score yet. */
export function ScoreCircle({
  value,
  size = "md",
}: {
  value: number | null;
  size?: "sm" | "md" | "lg";
}) {
  const tier = tierOf(value);
  return (
    <span
      className={`${styles.circle} ${styles[size]} ${tier ? styles[tier] : styles.none}`}
      role="img"
      aria-label={value === null ? "Not rated yet" : `${formatScore(value)} out of 5`}
    >
      {formatScore(value)}
    </span>
  );
}
