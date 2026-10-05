"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { request } from "@/client/api";
import styles from "@/ui/forms.module.css";

export function PairForm({
  token,
  link,
  signedInAs,
}: {
  token: string;
  link: { name: string; purpose: "pair" | "recover" } | null;
  signedInAs: string | null;
}) {
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

  if (!link) {
    return (
      <div className={styles.card}>
        <p className={styles.lede}>
          That link expired or was already used. On a phone that&apos;s signed in, open Crew and
          make a new one. Lost every phone? Ask whoever runs the crew for a recovery link.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <p className={styles.lede}>
        You&apos;re about to be <b>{link.name}</b> on this phone. The link works once
        {link.purpose === "pair" ? " and dies 15 minutes after it was made" : ""}.
        {signedInAs &&
          signedInAs !== link.name &&
          ` Right now this phone is ${signedInAs}; this switches it.`}
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <button type="button" className={styles.primary} onClick={pair} disabled={busy}>
        {busy ? "Signing in…" : `Sign in as ${link.name}`}
      </button>
    </div>
  );
}
