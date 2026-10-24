"use client";

import { useRouter } from "next/navigation";
import { useId } from "react";
import { CREW_COOKIE } from "@/client/crew";
import styles from "./CitySwitch.module.css";
import { Select } from "./Select";

/**
 * Which crew you're looking at, for people in more than one. Remembered on this phone (a cookie
 * the server reads and validates); posts made while looking at a crew go to that crew.
 */
export function CrewSwitch({
  crew,
  crews,
}: {
  crew: string;
  crews: { id: string; name: string }[];
}) {
  const router = useRouter();
  const id = useId();
  if (crews.length < 2) return null;
  return (
    <div className={styles.picker}>
      <label htmlFor={id} className={styles.label}>
        Crew
      </label>
      <Select
        id={id}
        className={styles.trigger}
        value={crew}
        onValueChange={(next) => {
          if (next === crew) return;
          const secure = location.protocol === "https:" ? "; secure" : "";
          document.cookie = `${CREW_COOKIE}=${next}; path=/; max-age=34560000; samesite=lax${secure}`;
          router.refresh();
        }}
        groups={[{ label: "", options: crews.map((c) => ({ value: c.id, label: c.name })) }]}
      />
    </div>
  );
}
