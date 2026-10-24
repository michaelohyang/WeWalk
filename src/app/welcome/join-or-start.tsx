"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { fieldErrors, request } from "@/client/api";
import { CITIES, type CityKey } from "@/domain/areas";
import styles from "@/ui/forms.module.css";
import { Select } from "@/ui/Select";

/** "https://…/join/abc123" or just "abc123" → "abc123". */
const inviteCodeFrom = (text: string) => text.trim().split("/join/").pop()!.split(/[?#]/)[0]!;

/**
 * Join a crew by its invite link, or start one. `onJoined` gets the crew's name; without it the
 * phone goes to Home.
 */
export function JoinOrStart({
  canStartCrew,
  onJoined,
  defaultCity = "nyc",
}: {
  canStartCrew: boolean;
  onJoined?: (crewName: string) => void;
  /** The new crew's home city to start with (the one they just picked). */
  defaultCity?: CityKey;
}) {
  const router = useRouter();
  const cityId = useId();
  const [link, setLink] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState<CityKey>(defaultCity);
  const [error, setError] = useState<{ join?: string; start?: string }>({});
  const [busy, setBusy] = useState(false);

  async function done(
    res: Awaited<ReturnType<typeof request<{ crew: { name: string } }>>>,
    which: "join" | "start",
  ) {
    setBusy(false);
    if (!res.ok) {
      setError({ [which]: fieldErrors(res.error).name ?? res.error.message });
      return;
    }
    if (onJoined) return onJoined(res.data.crew.name);
    router.replace("/");
    router.refresh();
  }

  return (
    <>
      <form
        className={styles.card}
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          await done(
            await request<{ crew: { name: string } }>("POST", "/api/crews/join", {
              code: inviteCodeFrom(link),
            }),
            "join",
          );
        }}
      >
        <label className={styles.field}>
          <span>Got an invite link? Paste it here</span>
          <input
            className={styles.input}
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://…/join/…"
            aria-invalid={!!error.join}
            aria-describedby={error.join ? "join-error" : undefined}
          />
          {error.join && (
            <span id="join-error" className={styles.error} role="alert">
              {error.join}
            </span>
          )}
        </label>
        <button type="submit" className={styles.primary} disabled={busy || !link.trim()}>
          Join the crew
        </button>
      </form>

      {canStartCrew && (
        <form
          className={styles.card}
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            await done(
              await request<{ crew: { name: string } }>("POST", "/api/crews", {
                name,
                homeCity: city,
              }),
              "start",
            );
          }}
        >
          <label className={styles.field}>
            <span>Or start your own crew</span>
            <input
              className={styles.input}
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              placeholder="The Flatiron regulars"
              aria-invalid={!!error.start}
              aria-describedby={error.start ? "start-error" : undefined}
            />
            {error.start && (
              <span id="start-error" className={styles.error} role="alert">
                {error.start}
              </span>
            )}
          </label>
          <label className={styles.field} htmlFor={cityId}>
            <span>Home city</span>
          </label>
          <Select
            id={cityId}
            className={styles.input}
            value={city}
            onValueChange={(v) => setCity(v as CityKey)}
            groups={[{ label: "", options: CITIES.map((c) => ({ value: c.key, label: c.name })) }]}
          />
          <button type="submit" className={styles.primary} disabled={busy || !name.trim()}>
            Start the crew
          </button>
        </form>
      )}
    </>
  );
}
