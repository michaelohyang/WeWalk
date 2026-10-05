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

export function InviteFriends({ invitePath }: { invitePath: string | null }) {
  const [origin, setOrigin] = useState("");
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the public origin is only known in the browser
  useEffect(() => setOrigin(location.origin), []);
  if (!invitePath) {
    return (
      <p className={styles.lede}>Joining is switched off right now (no invite code is set up).</p>
    );
  }
  return (
    <div className={styles.card}>
      <p className={styles.lede}>
        Anyone with this link can join the crew and post. Send it to people you&apos;d share a phone
        booth with.
      </p>
      {origin && <ShareLink url={`${origin}${invitePath}`} title="Join our WeWalk crew" />}
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
    toast("Name updated everywhere.");
    router.refresh();
  }

  return (
    <form className={styles.row} onSubmit={submit} noValidate>
      <label className={styles.field}>
        <span>Display name</span>
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

export function AddPhone() {
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function make() {
    setBusy(true);
    const res = await request<{ url: string }>("POST", "/api/me/pair-links");
    setBusy(false);
    if (res.ok) setLink(res.data.url);
    else setError(res.error.message);
  }

  return (
    <div className={styles.card}>
      <p className={styles.lede}>
        Open this link on your other phone to sign in there as you. It works once, for 15 minutes.
      </p>
      {link ? (
        <ShareLink url={link} title="Sign in to WeWalk" />
      ) : (
        <button type="button" className={styles.secondary} onClick={make} disabled={busy}>
          {busy ? "Making a link…" : "Add a phone"}
        </button>
      )}
      {error && <p className={styles.error}>{error}</p>}
    </div>
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
        Someone lost every phone? Make them a one-time sign-in link (good for 24 hours) and send it
        to them directly.
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
