"use client";

import * as ToggleGroup from "@radix-ui/react-toggle-group";
import styles from "./rate.module.css";

/**
 * "Also post to": your other crews, as chips. Your review goes to the crew you're looking at
 * anyway; ticked crews get it too (one review, shared).
 */
export function AlsoPost({
  crews,
  value,
  onChange,
}: {
  crews: { id: string; name: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  if (!crews.length) return null;
  return (
    <fieldset className={styles.tags}>
      <legend id="also-post-label">Also post to</legend>
      <ToggleGroup.Root
        type="multiple"
        className={styles.tagList}
        aria-labelledby="also-post-label"
        value={value}
        onValueChange={onChange}
      >
        {crews.map((c) => (
          <ToggleGroup.Item key={c.id} value={c.id}>
            {c.name}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    </fieldset>
  );
}
