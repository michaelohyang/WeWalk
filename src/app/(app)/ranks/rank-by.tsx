"use client";

import { useRouter } from "next/navigation";
import styles from "./ranks.module.css";

/**
 * "Rank by" as a dropdown: ten options are too many for a row of chips. A plain GET form, so it
 * works before JavaScript loads (with the Show button); afterwards picking an option navigates.
 */
export function RankBy({
  options,
  current,
  area,
}: {
  options: { key: string; label: string; href: string }[];
  current: string;
  area: string | null;
}) {
  const router = useRouter();
  return (
    <form className={styles.rankBy} action="/ranks" method="get">
      <label htmlFor="rank-by">Rank by</label>
      <select
        id="rank-by"
        name="by"
        value={current}
        onChange={(e) => {
          const next = options.find((o) => o.key === e.target.value);
          if (next) router.push(next.href, { scroll: false });
        }}
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
      {area && <input type="hidden" name="area" value={area} />}
      <noscript>
        <button type="submit">Show</button>
      </noscript>
    </form>
  );
}
