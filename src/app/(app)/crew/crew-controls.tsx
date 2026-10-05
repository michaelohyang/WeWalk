"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { fieldErrors, request } from "@/client/api";
import styles from "@/ui/forms.module.css";
import { useToast } from "@/ui/Toast";

/** A link with Copy (and Share, where the phone has it). */
function ShareLink({ url, title }: { url: string; title: string }) {
  const toast = useToast();
  const ref = useRef<HTMLDivElement>(null);
  const [canShare, setCanShare] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- feature check after mount
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied.");
    } catch {
      // No clipboard access: select the text so a long-press copies it.
      const range = document.createRange();
      range.selectNodeContents(ref.current!);
      getSelection()?.removeAllRanges();
      getSelection()?.addRange(range);
      toast("Selected. Long-press to copy.");
    }
  }

  return (
    <div className={styles.row}>
      <div ref={ref} className={styles.link}>
        {url}
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <button type="button" className={styles.secondary} onClick={copy}>
          Copy
        </button>
        {canShare && (
          <button
            type="button"
            className={styles.secondary}
            onClick={() => navigator.share({ title, url }).catch(() => {})}
          >
            Share
          </button>
        )}
      </div>
    </div>
  );
}

export function InviteFriends() {
  const [origin, setOrigin] = useState("");
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the public origin is only known in the browser
  useEffect(() => setOrigin(location.origin), []);
  return (
    <div className={styles.card}>
      <p className={styles.lede}>
        Send this to people you&apos;d share a phone booth with. They pick a username and password,
        and they&apos;re in.
      </p>
      {origin && <ShareLink url={`${origin}/signup`} title="Join me on WeWalk" />}
    </div>
  );
}

export function Rename({ name }: { name: string }) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (value.trim() === name) return;
    setBusy(true);
    const res = await request("PATCH", "/api/me", { name: value });
    setBusy(false);
    if (!res.ok) {
      setError(fieldErrors(res.error).name ?? res.error.message);
      return;
    }
    toast("Username updated everywhere. Log in with the new one.");
    router.refresh();
  }

  return (
    <form className={styles.row} onSubmit={submit} noValidate>
      <label className={styles.field}>
        <span>Username</span>
        <input
          className={styles.input}
          value={value}
          maxLength={30}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          aria-invalid={!!error}
          aria-describedby={error ? "rename-error" : undefined}
        />
        {error && (
          <span id="rename-error" className={styles.error} role="alert">
            {error}
          </span>
        )}
      </label>
      <button
        type="submit"
        className={styles.secondary}
        disabled={busy || value.trim() === name}
        style={{ alignSelf: "end" }}
      >
        Save
      </button>
    </form>
  );
}

/** Set your first password, or change it (which needs the current one). */
export function SetPassword({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setErrors({ password: "At least 8 characters. A short phrase works." });
      return;
    }
    setBusy(true);
    const res = await request("PUT", "/api/me/password", {
      ...(hasPassword && { current }),
      password,
    });
    setBusy(false);
    if (!res.ok) {
      const byField = fieldErrors(res.error);
      setErrors(Object.keys(byField).length ? byField : { form: res.error.message });
      return;
    }
    setCurrent("");
    setPassword("");
    setErrors({});
    toast(hasPassword ? "Password changed." : "Password set. Log in anywhere with it.");
    router.refresh();
  }

  return (
    <form className={styles.card} onSubmit={submit} noValidate>
      {!hasPassword && (
        <p className={styles.lede}>
          You don&apos;t have a password yet. Set one to log in on another phone or laptop.
        </p>
      )}
      {hasPassword && (
        <label className={styles.field}>
          <span>Current password</span>
          <input
            type="password"
            className={styles.input}
            value={current}
            autoComplete="current-password"
            onChange={(e) => setCurrent(e.target.value)}
            aria-invalid={!!errors.current}
          />
          {errors.current && <span className={styles.error}>{errors.current}</span>}
        </label>
      )}
      <label className={styles.field}>
        <span>{hasPassword ? "New password" : "Password"}</span>
        <input
          type="password"
          className={styles.input}
          value={password}
          autoComplete="new-password"
          placeholder="8+ characters"
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!errors.password}
        />
        {errors.password && <span className={styles.error}>{errors.password}</span>}
      </label>
      {errors.form && (
        <p className={styles.error} role="alert">
          {errors.form}
        </p>
      )}
      <button type="submit" className={styles.secondary} disabled={busy}>
        {busy ? "Saving…" : hasPassword ? "Change password" : "Set password"}
      </button>
    </form>
  );
}

export function SignOutPhone({ deviceId, current }: { deviceId: string; current: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);

  async function signOut() {
    const res = await request("DELETE", `/api/me/devices/${deviceId}`);
    if (!res.ok) {
      toast(res.error.message);
      return;
    }
    toast(current ? "Signed out. See you around." : "That phone is signed out.");
    router.refresh();
  }

  if (!confirming) {
    return (
      <button type="button" className={styles.textBtn} onClick={() => setConfirming(true)}>
        Sign out
      </button>
    );
  }
  return (
    <span
      role="group"
      aria-label="Sign out this phone?"
      style={{ display: "inline-flex", gap: 12, alignItems: "center" }}
    >
      <button type="button" className={`${styles.textBtn} ${styles.danger}`} onClick={signOut}>
        {current ? "Sign out here" : "Yes, sign out"}
      </button>
      <button type="button" className={styles.textBtn} onClick={() => setConfirming(false)}>
        Cancel
      </button>
    </span>
  );
}

export function RecoveryLinks({ members }: { members: { id: string; name: string }[] }) {
  const [memberId, setMemberId] = useState("");
  const [link, setLink] = useState<{ name: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function make(e: React.FormEvent) {
    e.preventDefault();
    const member = members.find((m) => m.id === memberId);
    if (!member) return;
    const res = await request<{ url: string }>("POST", "/api/admin/recovery-links", { memberId });
    setError(res.ok ? null : res.error.message);
    setLink(res.ok ? { name: member.name, url: res.data.url } : null);
  }

  return (
    <form className={styles.card} onSubmit={make}>
      <p className={styles.lede}>
        Someone forgot their password? Make them a one-time sign-in link (good for 24 hours) and
        send it to them directly. It logs them in once, and they pick a new password.
      </p>
      <div className={styles.row}>
        <label className={styles.field}>
          <span>Crew member</span>
          <select
            className={styles.input}
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
          >
            <option value="">Pick someone…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className={styles.secondary}
          disabled={!memberId}
          style={{ alignSelf: "end" }}
        >
          Make link
        </button>
      </div>
      {link && (
        <>
          <p className={styles.lede}>Recovery link for {link.name}:</p>
          <ShareLink url={link.url} title="Your WeWalk sign-in link" />
        </>
      )}
      {error && <p className={styles.error}>{error}</p>}
    </form>
  );
}
