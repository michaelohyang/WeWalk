"use client";

import * as RadixSelect from "@radix-ui/react-select";
import styles from "./Select.module.css";

export interface SelectGroup {
  /** Shown above the group's options; leave empty for a plain list. */
  label: string;
  /**
   * `detail` is a second line in the list (e.g. an address); the closed dropdown shows
   * `selected` (when the label alone wouldn't be unique) or the label.
   */
  options: { value: string; label: string; detail?: string; selected?: string }[];
}

/** What the closed dropdown shows: the option's `selected` text if it has one, else its label. */
const selectedText = (groups: SelectGroup[], value: string) => {
  for (const g of groups) {
    const o = g.options.find((x) => x.value === value);
    if (o) return o.selected ?? o.label;
  }
  return undefined;
};

/**
 * A dropdown on Radix Select, styled to match the app. `className` styles the trigger (the
 * button that replaced a native <select>). Option values must be unique and non-empty: the
 * empty value shows the placeholder.
 */
export function Select({
  id,
  triggerRef,
  className,
  value,
  onValueChange,
  placeholder,
  groups,
  invalid,
  describedBy,
}: {
  id?: string;
  triggerRef?: React.Ref<HTMLButtonElement>;
  className?: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  groups: SelectGroup[];
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange}>
      <RadixSelect.Trigger
        id={id}
        ref={triggerRef}
        className={`${styles.trigger} ${className ?? ""}`}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
      >
        <RadixSelect.Value placeholder={placeholder}>
          {selectedText(groups, value)}
        </RadixSelect.Value>
        <RadixSelect.Icon className={styles.icon}>
          <svg width="12" height="8" viewBox="0 0 12 8" aria-hidden="true">
            <path
              d="M1 1.5l5 5 5-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content className={styles.content} position="popper" sideOffset={6}>
          <RadixSelect.Viewport className={styles.viewport}>
            {groups.map((g, i) => (
              <RadixSelect.Group key={g.label || i}>
                {g.label && (
                  <RadixSelect.Label className={styles.label}>{g.label}</RadixSelect.Label>
                )}
                {g.options.map((o) => (
                  <RadixSelect.Item key={o.value} value={o.value} className={styles.item}>
                    <span className={styles.itemText}>
                      <RadixSelect.ItemText>{o.label}</RadixSelect.ItemText>
                      {o.detail && <span className={styles.detail}>{o.detail}</span>}
                    </span>
                    <RadixSelect.ItemIndicator className={styles.check}>
                      ✓
                    </RadixSelect.ItemIndicator>
                  </RadixSelect.Item>
                ))}
              </RadixSelect.Group>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
