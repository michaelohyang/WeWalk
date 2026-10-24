"use client";

import Link from "next/link";
import type { AreaKey } from "@/domain/areas";
import type { AreaTile } from "@/server/services/views";
import { areaColor } from "@/ui/format";
import styles from "./area-tiles.module.css";

/** The city's areas as slim chips: name and how many you've been to. A chip lists its buildings. */
export function AreaTiles({
  areas,
  href,
  onSelect,
}: {
  areas: AreaTile[];
  href: (area: AreaKey) => string;
  onSelect: (area: AreaKey) => void;
}) {
  return (
    <nav className={styles.row} aria-label="Areas">
      {areas.map((a) => (
        <Link
          key={a.key}
          href={href(a.key)}
          scroll={false}
          className={styles.chip}
          style={{ "--c": areaColor(a.key) } as React.CSSProperties}
          onClick={(e) => {
            e.preventDefault();
            onSelect(a.key);
          }}
        >
          <span className={styles.dot} aria-hidden="true" />
          {a.label}
          <span className={styles.count}>
            {a.mine}/{a.total}
          </span>
        </Link>
      ))}
    </nav>
  );
}
