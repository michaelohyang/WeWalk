"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId } from "react";
import { rememberCity } from "@/client/city";
import { CITIES, type CityKey } from "@/domain/areas";
import styles from "./CitySwitch.module.css";
import { Select } from "./Select";

/**
 * The city picker: a compact dropdown (it grows with the city list, unlike a row of buttons).
 * Remembered on this phone (a cookie the pages read), and shared by Home, Map, Ranks and
 * Passport. Switching drops the area filter (an area from another city would show nothing),
 * keeps the rest (e.g. Ranks' sort) and reloads the page's data.
 */
export function CitySwitch({ city }: { city: CityKey }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const id = useId();
  return (
    <div className={styles.picker}>
      <label htmlFor={id} className={styles.label}>
        City
      </label>
      <Select
        id={id}
        className={styles.trigger}
        value={city}
        onValueChange={(next) => {
          if (next === city) return;
          rememberCity(next as CityKey);
          const kept = new URLSearchParams(params);
          kept.delete("area");
          const query = kept.toString();
          router.replace(query ? `${path}?${query}` : path, { scroll: false });
          router.refresh();
        }}
        groups={[{ label: "", options: CITIES.map((c) => ({ value: c.key, label: c.name })) }]}
      />
    </div>
  );
}
