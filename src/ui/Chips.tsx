"use client";

import Link from "next/link";
import styles from "./Chips.module.css";

/** A wrapping row of chips. With `showLabel`, the row's name is printed in front of them. */
export function ChipRow({
  label,
  showLabel,
  children,
}: {
  label: string;
  showLabel?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.row} role="group" aria-label={label}>
      {showLabel && (
        <span className={styles.rowLabel} aria-hidden="true">
          {label}
        </span>
      )}
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
