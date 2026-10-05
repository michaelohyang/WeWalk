"use client";

import { Empty } from "@/ui/Empty";
import { Page } from "@/ui/Page";
import styles from "@/ui/forms.module.css";

/** A server hiccup shows up as a message with a way out, never as a frozen screen. */
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Page title="Hmm.">
      <Empty title="That didn't load.">
        Something broke on our end, not yours. Give it another go.
        <span style={{ display: "block", marginTop: 14 }}>
          <button type="button" className={styles.primary} onClick={reset}>
            Try again
          </button>
        </span>
      </Empty>
    </Page>
  );
}
