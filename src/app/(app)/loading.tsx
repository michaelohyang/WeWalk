import styles from "./loading.module.css";

/** Shown the instant you tap, while the next screen loads: never a frozen screen. */
export default function Loading() {
  return (
    <main className={styles.wrap} aria-busy="true" aria-label="Loading">
      <div className={`${styles.block} ${styles.title}`} />
      <div className={`${styles.block} ${styles.hero}`} />
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className={`${styles.block} ${styles.row}`} />
      ))}
    </main>
  );
}
