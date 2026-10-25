"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { request } from "@/client/api";
import { rememberCity } from "@/client/city";
import { CITIES, type CityKey } from "@/domain/areas";
import styles from "@/ui/forms.module.css";
import { CrewList, type CrewListItem } from "@/ui/CrewList";
import { Select } from "@/ui/Select";
import { JoinOrStart } from "./join-or-start";
import welcome from "./welcome.module.css";

type Step = "city" | "crew" | "first";

/**
 * The welcome steps for someone new: pick a city, join or start a crew (skipped if they came
 * from an invite link), then rate a first building. Someone who left their last crew only gets
 * the crew step.
 */
export function WelcomeSteps({
  onboarded,
  crew,
  city: initialCity,
  canStartCrew,
  deviceId,
  directory,
}: {
  onboarded: boolean;
  crew: { name: string } | null;
  city: CityKey;
  canStartCrew: boolean;
  deviceId: string;
  /** Crews to pick from (for someone in none). */
  directory: CrewListItem[];
}) {
  const router = useRouter();
  const cityId = useId();
  const steps: Step[] = [
    ...(onboarded ? [] : (["city"] as const)),
    ...(crew ? [] : (["crew"] as const)),
    ...(onboarded ? [] : (["first"] as const)),
  ];
  const [at, setAt] = useState(0);
  const [city, setCity] = useState(initialCity);
  const [crewName, setCrewName] = useState(crew?.name ?? null);
  const [busy, setBusy] = useState(false);
  // Shown here, not as a toast: this page sits outside the app's layout (no toasts).
  const [error, setError] = useState<string | null>(null);
  const step = steps[at]!;

  // Each step's heading takes focus, so a screen reader hears where they are.
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus();
  }, [at]);

  function next() {
    if (at + 1 < steps.length) setAt(at + 1);
    else {
      // Only the crew step (they left their last crew): straight to Home.
      router.replace("/");
      router.refresh();
    }
  }

  async function finish(to: "/rate" | "/") {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await request("POST", "/api/me/onboarded");
    if (!res.ok) {
      setBusy(false);
      setError(res.error.message);
      return;
    }
    router.replace(to);
    router.refresh();
  }

  async function signOut() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await request("DELETE", `/api/me/devices/${deviceId}`);
    if (!res.ok) {
      setBusy(false);
      setError(res.error.message);
      return;
    }
    // A full load, so nothing of the session stays in memory.
    location.replace("/login");
  }

  return (
    <section className={welcome.step} aria-labelledby="step-title">
      {steps.length > 1 && (
        <p className={welcome.progress}>
          Step {at + 1} of {steps.length}
        </p>
      )}
      {step === "city" && (
        <>
          <h2 id="step-title" ref={heading} tabIndex={-1} className={welcome.title}>
            Where do you work?
          </h2>
          <p className={styles.lede}>
            We&apos;ll show you that city&apos;s buildings first. You can switch any time.
          </p>
          <div className={styles.card}>
            <label className={styles.field} htmlFor={cityId}>
              <span>City</span>
            </label>
            <Select
              id={cityId}
              className={styles.input}
              value={city}
              onValueChange={(v) => setCity(v as CityKey)}
              groups={[
                { label: "", options: CITIES.map((c) => ({ value: c.key, label: c.name })) },
              ]}
            />
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                rememberCity(city);
                next();
              }}
            >
              Next
            </button>
          </div>
        </>
      )}
      {step === "crew" && (
        <>
          <h2 id="step-title" ref={heading} tabIndex={-1} className={welcome.title}>
            Pick a crew
          </h2>
          <p className={styles.lede}>
            A crew is the people you rate buildings with: one feed, one leaderboard. Join one
            {canStartCrew ? ", or start your own." : "."} You can join more later.
          </p>
          <CrewList
            // The city they just picked first (the server sorted by the one it knew).
            crews={[...directory].sort((a, b) => +(a.homeCity !== city) - +(b.homeCity !== city))}
            onJoined={(c) => {
              setCrewName(c.name);
              next();
            }}
          />
          <JoinOrStart
            canStartCrew={canStartCrew}
            defaultCity={city}
            onJoined={(name) => {
              setCrewName(name);
              next();
            }}
          />
        </>
      )}
      {step === "first" && (
        <>
          <h2 id="step-title" ref={heading} tabIndex={-1} className={welcome.title}>
            {crewName ? `You're in ${crewName}` : "You're in"}
          </h2>
          <p className={styles.lede}>
            Rate the building you&apos;re in today, or one you know well. It takes a minute, and it
            puts you on the leaderboard.
          </p>
          <div className={welcome.actions}>
            <button
              type="button"
              className={styles.primary}
              disabled={busy}
              onClick={() => void finish("/rate")}
            >
              Rate a building
            </button>
            <button
              type="button"
              className={styles.textBtn}
              disabled={busy}
              onClick={() => void finish("/")}
            >
              Look around first
            </button>
          </div>
        </>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <p className={welcome.signOut}>
        Not {step === "crew" ? "ready yet" : "you"}?{" "}
        <button
          type="button"
          className={styles.textBtn}
          disabled={busy}
          onClick={() => void signOut()}
        >
          Sign out
        </button>
      </p>
    </section>
  );
}
