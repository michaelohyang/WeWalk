import styles from "./page.module.css";

/** Placeholder home until Phase 2 ports Explore. */
export default function HomePage() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>
        We<span>Walk</span>
      </h1>
      <p className={styles.sub}>NYC WeWorks, rated by people who care too much</p>
      <div className={styles.card}>
        <b>Under construction.</b>
        The lobby is open, the coffee isn&apos;t. Ratings land soon.
      </div>
    </main>
  );
}
