import styles from "./kit.module.css";

/** A friendly empty state: a bold one-liner, then what to do about it. */
export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className={styles.empty}>
      <b>{title}</b>
      {children}
    </div>
  );
}
