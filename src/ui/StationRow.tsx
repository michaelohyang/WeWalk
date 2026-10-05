import Link from "next/link";
import { areaColor, plural, tileText } from "./format";
import styles from "./kit.module.css";
import { ScoreCircle } from "./ScoreCircle";

export interface StationRowData {
  id: string;
  name: string;
  neighborhood: string;
  area: Parameters<typeof areaColor>[0];
  overall: number | null;
  reviewCount: number;
  /** Anyone in the crew has been. */
  visited: boolean;
  /** You have been. */
  mine: boolean;
}

/** One station in a list: tile (or rank), name, neighborhood · status, score. */
export function StationRow({
  station,
  lead,
  value,
}: {
  station: StationRowData;
  /** Replaces the tile, e.g. a rank number. */
  lead?: React.ReactNode;
  /** The score to show; defaults to the overall. */
  value?: number | null;
}) {
  const color = { "--c": areaColor(station.area) } as React.CSSProperties;
  return (
    <Link href={`/s/${station.id}`} className={styles.row}>
      {lead ?? (
        <span className={styles.tile} style={color} aria-hidden="true">
          {tileText(station.name)}
        </span>
      )}
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{station.name}</span>
        <span className={styles.rowMeta}>
          <span className={styles.hood} style={color}>
            {station.neighborhood}
          </span>
          <span aria-hidden="true">·</span>
          {station.mine ? (
            <span className={styles.been}>You&apos;ve been</span>
          ) : station.visited ? (
            <span>Crew&apos;s been</span>
          ) : (
            <span>Not yet</span>
          )}
          {station.reviewCount > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>{plural(station.reviewCount, "review")}</span>
            </>
          )}
        </span>
      </span>
      <ScoreCircle value={value === undefined ? station.overall : value} />
    </Link>
  );
}
