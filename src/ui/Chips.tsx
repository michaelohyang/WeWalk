import Link from "next/link";
import styles from "./Chips.module.css";

/** A horizontally scrolling row of chips. */
export function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.row} role="group" aria-label={label}>
      {children}
    </div>
  );
}

type ChipProps = { pressed: boolean; color?: string; children: React.ReactNode };

/** A toggle chip. Pass `href` for a link (URL-driven filters) or `onClick` for local state. */
export function Chip({
  pressed,
  color,
  children,
  ...target
}: ChipProps & ({ href: string } | { onClick: () => void })) {
  const body = (
    <>
      {color && <span className={styles.dot} style={{ background: color }} aria-hidden="true" />}
      {children}
    </>
  );
  return "href" in target ? (
    <Link
      href={target.href}
      className={styles.chip}
      aria-current={pressed ? "true" : undefined}
      scroll={false}
      replace
    >
      {body}
    </Link>
  ) : (
    <button type="button" className={styles.chip} aria-pressed={pressed} onClick={target.onClick}>
      {body}
    </button>
  );
}

/** Two or three mutually exclusive options. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className={styles.seg} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
