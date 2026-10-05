"use client";

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

/**
 * A filter chip: always a real link, so a tap works even before the page's JavaScript loads.
 * With `onSelect`, a loaded page handles the tap itself (instant, no navigation).
 */
export function Chip({
  href,
  current,
  color,
  onSelect,
  children,
}: {
  href: string;
  current: boolean;
  color?: string;
  onSelect?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={styles.chip}
      aria-current={current ? "true" : undefined}
      scroll={false}
      replace
      onClick={
        onSelect &&
        ((e) => {
          e.preventDefault();
          onSelect();
        })
      }
    >
      {color && <span className={styles.dot} style={{ background: color }} aria-hidden="true" />}
      {children}
    </Link>
  );
}

/** Two or three mutually exclusive options, as links (same progressive behavior as Chip). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onSelect,
}: {
  label: string;
  options: readonly { value: T; label: string; href: string }[];
  value: T;
  onSelect?: (v: T) => void;
}) {
  return (
    <div className={styles.seg} role="group" aria-label={label}>
      {options.map((o) => (
        <Link
          key={o.value}
          href={o.href}
          aria-current={o.value === value ? "true" : undefined}
          scroll={false}
          replace
          onClick={
            onSelect &&
            ((e) => {
              e.preventDefault();
              onSelect(o.value);
            })
          }
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}

/** Segmented control for local settings (not URL state), e.g. the theme. */
export function SegmentedButtons<T extends string>({
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
