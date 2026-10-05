"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { request } from "@/client/api";
import styles from "@/ui/forms.module.css";

export function PairForm({ token, signedInAs }: { token: string; signedInAs: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pair() {
    setBusy(true);
    const res = await request<{ member: { name: string } }>("POST", "/api/pair", { token });
    setBusy(false);
    if (res.ok) {
      router.replace("/");
      router.refresh();
      return;
    }
    setError(res.error.message);
  }

  return (
    <div className={styles.card}>
      <p className={styles.lede}>
        This link signs this phone in as you. It works once and expires 15 minutes after it was
        made.
        {signedInAs &&
          ` This phone is signed in as ${signedInAs} right now; using the link switches it.`}
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <button type="button" className={styles.primary} onClick={pair} disabled={busy}>
        {busy ? "Signing in…" : "Sign in on this phone"}
      </button>
    </div>
  );
}
