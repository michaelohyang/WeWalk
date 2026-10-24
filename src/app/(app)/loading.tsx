import { Page } from "@/ui/Page";
import styles from "./loading.module.css";

/**
 * Shown while a screen's data loads, e.g. the first tap after a write clears the crew cache.
 * Grey shapes where the header and cards will be, so the tap feels answered right away.
 */
export default function Loading() {
  return (
    <Page>
      <div className={styles.skeleton} role="status" aria-label="Loading">
        <div className={`${styles.block} ${styles.title}`} />
        <div className={`${styles.block} ${styles.line}`} />
        <div className={`${styles.block} ${styles.card}`} />
        <div className={`${styles.block} ${styles.card}`} />
        <div className={`${styles.block} ${styles.card}`} />
      </div>
    </Page>
  );
}
