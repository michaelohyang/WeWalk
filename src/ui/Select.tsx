"use client";

import * as RadixSelect from "@radix-ui/react-select";
import styles from "./Select.module.css";

export interface SelectGroup {
  /** Shown above the group's options; leave empty for a plain list. */
  label: string;
  options: { value: string; label: string }[];
}

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
        <RadixSelect.Value placeholder={placeholder} />
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
                    <RadixSelect.ItemText>{o.label}</RadixSelect.ItemText>
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
