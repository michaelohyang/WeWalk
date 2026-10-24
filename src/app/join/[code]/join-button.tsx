"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { request } from "@/client/api";
import styles from "@/ui/forms.module.css";

export function JoinButton({ code }: { code: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className={styles.card}>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className={styles.primary}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await request("POST", "/api/crews/join", { code });
          setBusy(false);
          if (!res.ok) {
            setError(res.error.message);
            return;
          }
          router.replace("/");
          router.refresh();
        }}
      >
        {busy ? "Joining…" : "Join the crew"}
      </button>
    </div>
  );
}
