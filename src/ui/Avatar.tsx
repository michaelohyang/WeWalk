import { avatarColor } from "./format";
import styles from "./kit.module.css";

/** A colored initial. `seed` (a member id) keeps the color stable across renames. */
export function Avatar({ name, seed }: { name: string; seed: string }) {
  const initial = [...name.trim()][0]?.toUpperCase() ?? "?";
  return (
    <span
      className={styles.avatar}
      style={{ "--c": avatarColor(seed) } as React.CSSProperties}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
