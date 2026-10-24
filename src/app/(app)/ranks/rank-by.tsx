"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/ui/Select";
import styles from "./ranks.module.css";

/** "Rank by" as a dropdown: ten options are too many for a row of chips. Picking navigates. */
export function RankBy({
  options,
  current,
}: {
  options: { key: string; label: string; href: string }[];
  current: string;
}) {
  const router = useRouter();
  return (
    <div className={styles.rankBy}>
      <label htmlFor="rank-by">Rank by</label>
      <Select
        id="rank-by"
        className={styles.rankSelect}
        value={current}
        onValueChange={(key) => {
          const next = options.find((o) => o.key === key);
          if (next) router.push(next.href, { scroll: false });
        }}
        groups={[{ label: "", options: options.map((o) => ({ value: o.key, label: o.label })) }]}
      />
    </div>
  );
}
