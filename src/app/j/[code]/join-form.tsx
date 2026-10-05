"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fieldErrors, request } from "@/client/api";
import styles from "@/ui/forms.module.css";

/** Pick a name, once. That's the whole sign-up. */
export function JoinForm({ code }: { code: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Pick a name so the crew knows who's talking.");
      return;
    }
    setBusy(true);
    const res = await request("POST", "/api/join", { code, name });
    setBusy(false);
    if (res.ok) {
      router.replace("/");
      router.refresh();
      return;
    }
    setError(fieldErrors(res.error).name ?? res.error.message);
  }

  return (
    <form className={styles.card} onSubmit={submit} noValidate>
      <p className={styles.lede}>
        No passwords, no email. Pick the name your crew knows you by, and you&apos;re in on this
        phone.
      </p>
      <label className={styles.field}>
        <span>Your name</span>
        <input
          className={styles.input}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          maxLength={30}
          autoComplete="nickname"
          autoCapitalize="words"
          placeholder="Sal from accounting"
          aria-invalid={!!error}
          aria-describedby={error ? "join-error" : undefined}
          autoFocus
        />
        {error && (
          <span id="join-error" className={styles.error} role="alert">
            {error}
          </span>
        )}
      </label>
      <button type="submit" className={styles.primary} disabled={busy}>
        {busy ? "Joining…" : "Join"}
      </button>
    </form>
  );
}
