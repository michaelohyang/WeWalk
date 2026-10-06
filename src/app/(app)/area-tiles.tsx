"use client";

import Link from "next/link";
import type { AreaKey } from "@/domain/areas";
import { formatScore } from "@/domain/scoring";
import type { AreaTile } from "@/server/services/views";
import { areaColor } from "@/ui/format";
import styles from "./area-tiles.module.css";

/** The five areas at a glance. A tile opens that area's buildings as a list. */
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
    <nav className={styles.grid} aria-label="Areas">
      {areas.map((a) => (
        <Link
          key={a.key}
          href={href(a.key)}
          scroll={false}
          className={styles.tile}
          style={{ "--c": areaColor(a.key) } as React.CSSProperties}
          onClick={(e) => {
            e.preventDefault();
            onSelect(a.key);
          }}
        >
          <span className={styles.name}>{a.label}</span>
          <span className={styles.count}>
            {a.total} {a.total === 1 ? "building" : "buildings"}
          </span>
          <span className={styles.best}>
            {a.best ? (
              <>
                Best: <b>{a.best.name}</b> {formatScore(a.best.overall)}
              </>
            ) : (
              "Nothing rated yet"
            )}
          </span>
          <span className={styles.progress} aria-label={`You've been to ${a.mine} of ${a.total}`}>
            <span className={styles.bar} aria-hidden="true">
              <span style={{ width: `${(100 * a.mine) / a.total}%` }} />
            </span>
            <span className={styles.mine}>
              {a.mine}/{a.total}
            </span>
          </span>
        </Link>
      ))}
    </nav>
  );
}
