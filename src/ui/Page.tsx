import { BackLink } from "./BackLink";
import styles from "./Page.module.css";

/** The phone-width column every screen sits in, with an optional header. */
export function Page({
  title,
  subtitle,
  back,
  action,
  children,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Shows a back button; goes here when there is no in-app history. */
  back?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className={styles.page}>
      {back && (
        <div className={styles.nav}>
          <BackLink fallback={back} className={styles.round} />
        </div>
      )}
      {(title || action) && (
        <header className={styles.top}>
          <div>
            {title && <h1 className={styles.title}>{title}</h1>}
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </main>
  );
}

/** A section heading with an optional note on the right. */
export function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.section} aria-label={title}>
      <div className={styles.sectionHead}>
        <h2>{title}</h2>
        {note && <span className={styles.note}>{note}</span>}
      </div>
      {children}
    </section>
  );
}
