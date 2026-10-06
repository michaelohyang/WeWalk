"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { request } from "@/client/api";
import styles from "@/ui/forms.module.css";

export function RecoverForm({
  token,
  link,
  signedInAs,
}: {
  token: string;
  link: { name: string } | null;
  signedInAs: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function recover() {
    setBusy(true);
    const res = await request<{ member: { name: string } }>("POST", "/api/recover", { token });
    setBusy(false);
    if (res.ok) {
      // A recovery link clears the old password: go straight to setting a new one.
      router.replace("/crew");
      router.refresh();
      return;
    }
    setError(res.error.message);
  }

  if (!link) {
    return (
      <div className={styles.card}>
        <p className={styles.lede}>
          That link expired or was already used. Ask whoever runs the crew for a new one, or{" "}
          <a href="/login">log in</a> if you remember your password.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <p className={styles.lede}>
        You&apos;re about to log in as <b>{link.name}</b>. The link works once, and then you pick a
        new password.
        {signedInAs &&
          signedInAs !== link.name &&
          ` Right now this phone is ${signedInAs}; this switches it.`}
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <button type="button" className={styles.primary} onClick={recover} disabled={busy}>
        {busy ? "Signing in…" : `Sign in as ${link.name}`}
      </button>
    </div>
  );
}
