"use client";

import * as ToggleGroup from "@radix-ui/react-toggle-group";
import styles from "./Chips.module.css";

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
    <ToggleGroup.Root
      type="single"
      className={styles.seg}
      aria-label={label}
      value={value}
      // A segmented control always has a choice: ignore the tap that would clear it.
      onValueChange={(v) => v && onChange(v as T)}
    >
      {options.map((o) => (
        <ToggleGroup.Item key={o.value} value={o.value}>
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
