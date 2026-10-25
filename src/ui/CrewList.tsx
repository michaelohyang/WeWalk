"use client";

import { useState } from "react";
import { request } from "@/client/api";
import { CITIES, type CityKey } from "@/domain/areas";
import forms from "./forms.module.css";
import styles from "./CrewList.module.css";
import { plural } from "./format";

export interface CrewListItem {
  id: string;
  name: string;
  homeCity: CityKey;
  members: number;
  joined: boolean;
}

const cityName = (key: CityKey) => CITIES.find((c) => c.key === key)?.name ?? key;

/** Crews to join with one tap. `onJoined` runs after the server switched the phone to it. */
export function CrewList({
  crews,
  onJoined,
}: {
  crews: CrewListItem[];
  onJoined: (crew: { id: string; name: string }) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);

  async function join(crew: CrewListItem) {
    if (busy) return;
    setBusy(crew.id);
    setError(null);
    const res = await request<{ crew: { id: string; name: string } }>(
      "POST",
      `/api/crews/${crew.id}/join`,
    );
    setBusy(null);
    if (!res.ok) return setError({ id: crew.id, message: res.error.message });
    onJoined(res.data.crew);
  }

  if (!crews.length) return <p className={forms.lede}>No crews to join yet.</p>;
  return (
    <ul className={styles.list}>
      {crews.map((c) => (
        <li key={c.id} className={styles.crew}>
          <div className={styles.about}>
            <b className={styles.name}>{c.name}</b>
            <span className={styles.sub}>
              {cityName(c.homeCity)} · {plural(c.members, "member")}
            </span>
            {error?.id === c.id && (
              <span className={forms.error} role="alert">
                {error.message}
              </span>
            )}
          </div>
          {c.joined ? (
            <span className={styles.joined}>You&apos;re in</span>
          ) : (
            <button
              type="button"
              className={forms.secondary}
              disabled={!!busy}
              aria-label={busy === c.id ? `Joining ${c.name}…` : `Join ${c.name}`}
              onClick={() => void join(c)}
            >
              {busy === c.id ? "Joining…" : "Join"}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
