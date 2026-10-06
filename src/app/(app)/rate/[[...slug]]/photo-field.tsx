"use client";

import { useRef, useState } from "react";
import { shrinkPhoto, uploadPhoto } from "@/client/photo";
import styles from "./rate.module.css";

/** Add, replace or remove the review's photo. It uploads as soon as it's picked. */
export function PhotoField({
  url,
  onChange,
}: {
  url: string | null;
  onChange: (url: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const result = await uploadPhoto(await shrinkPhoto(file));
      if (result.ok) onChange(result.url);
      else setError(result.message);
    } catch {
      setError("Couldn't read that photo. Try another one.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className={styles.field}>
      <span>Photo</span>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element -- already resized on upload
        <img src={url} alt="Your photo" className={styles.photo} />
      )}
      <div className={styles.photoActions}>
        <label className={styles.photoPick} aria-disabled={busy}>
          <input
            ref={input}
            type="file"
            accept="image/*"
            className={styles.fileInput}
            disabled={busy}
            onChange={(e) => pick(e.target.files?.[0])}
          />
          {busy ? "Uploading…" : url ? "Change photo" : "Add a photo"}
        </label>
        {url && !busy && (
          <button type="button" className={styles.link} onClick={() => onChange(null)}>
            Remove
          </button>
        )}
      </div>
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
