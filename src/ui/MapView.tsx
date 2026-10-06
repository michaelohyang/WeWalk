"use client";

import type { LabelSide, MapGeometry, Pin } from "@/domain/map-types";
import { formatScore, tierOf } from "@/domain/scoring";
import styles from "./MapView.module.css";

export interface MapStation {
  id: string;
  name: string;
  short: string;
  overall: number | null;
  visited: boolean;
}

/** Text position for a label on each side of a pin (matches labelBoxes in domain/map). */
function labelPlacement(side: LabelSide, lit: boolean) {
  const gap = lit ? 19 : 8;
  const vgap = lit ? 12 : 7;
  switch (side) {
    case "right":
      return { x: gap, y: 3, textAnchor: "start" as const };
    case "left":
      return { x: -gap, y: 3, textAnchor: "end" as const };
    case "above":
      return { x: 0, y: -vgap - 2.5, textAnchor: "middle" as const };
    case "below":
      return { x: 0, y: vgap + 8, textAnchor: "middle" as const };
    case "upRight":
      return { x: gap - 3, y: 3 - 11, textAnchor: "start" as const };
    case "downRight":
      return { x: gap - 3, y: 3 + 11, textAnchor: "start" as const };
    case "upLeft":
      return { x: -gap + 3, y: 3 - 11, textAnchor: "end" as const };
    case "downLeft":
      return { x: -gap + 3, y: 3 + 11, textAnchor: "end" as const };
  }
}

const TIER_FILL = {
  great: "var(--s-great)",
  good: "var(--s-good)",
  ok: "var(--s-ok)",
  bad: "var(--s-bad)",
};

/**
 * The schematic map. Rated stations are score bubbles, visited-but-unrated ones are brand
 * checks, the rest are grey dots. Tap a pin to select it.
 */
export function MapView({
  geometry,
  pins,
  stations,
  selected,
  dimmed,
  onSelect,
}: {
  /** Land shapes and size, computed on the server so the projection code never ships. */
  geometry: MapGeometry;
  pins: Pin[];
  stations: Map<string, MapStation>;
  selected: string | null;
  dimmed: Set<string>;
  onSelect: (id: string | null) => void;
}) {
  const { width, height, land } = geometry;
  // Draw unvisited first and the selected pin last, so they stack sensibly.
  const order = [...pins].sort(
    (a, b) =>
      Number(stations.get(a.id)?.visited) - Number(stations.get(b.id)?.visited) ||
      Number(a.id === selected) - Number(b.id === selected),
  );
  return (
    <div className={styles.card}>
      <svg
        className={styles.map}
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label="Map of WeWork locations in Manhattan and Brooklyn"
        onClick={(e) => {
          if (e.target === e.currentTarget) onSelect(null);
        }}
      >
        {land.map((l) => (
          <path key={l.name} d={l.d} className={l.far ? styles.landFar : styles.land} />
        ))}
        <clipPath id="manhattan">
          <path d={geometry.streets.clip} />
        </clipPath>
        <g clipPath="url(#manhattan)" aria-hidden="true">
          <path d={geometry.streets.grid} className={styles.grid} />
          <path d={geometry.streets.broadway} className={styles.broadway} />
        </g>
        <defs>
          <filter id="pin-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.25" />
          </filter>
        </defs>
        {geometry.labels.map((l) => (
          <text
            key={l.text}
            x={l.x}
            y={l.y}
            textAnchor="middle"
            transform={l.rotate ? `rotate(${l.rotate} ${l.x} ${l.y})` : undefined}
            className={l.water ? styles.water : styles.geo}
          >
            {l.text}
          </text>
        ))}
        {order.map((pin) => {
          const s = stations.get(pin.id);
          if (!s) return null;
          const isSelected = pin.id === selected;
          const side = pin.label;
          const tier = tierOf(s.overall);
          const label = `${s.name}, ${
            s.overall !== null
              ? `${formatScore(s.overall)} out of 5`
              : s.visited
                ? "visited, not rated"
                : "not visited yet"
          }`;
          return (
            <g
              key={pin.id}
              transform={`translate(${pin.x} ${pin.y})`}
              data-pin={pin.id}
              className={`${styles.pin} ${dimmed.has(pin.id) ? styles.dim : ""} ${isSelected ? styles.selected : ""}`}
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-pressed={isSelected}
              onClick={() => onSelect(isSelected ? null : pin.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(isSelected ? null : pin.id);
                }
              }}
            >
              {/* 44px tap target; overlapping neighbors resolve to the one drawn on top */}
              <circle r="22" className={styles.hit} />
              {s.visited ? (
                <>
                  <rect
                    x="-16"
                    y="-10"
                    width="32"
                    height="20"
                    rx="10"
                    className={styles.bubble}
                    fill={tier ? TIER_FILL[tier] : "var(--brand)"}
                    filter="url(#pin-shadow)"
                  />
                  <text y="3.6" textAnchor="middle" className={styles.value}>
                    {tier ? formatScore(s.overall) : "✓"}
                  </text>
                </>
              ) : (
                <circle r="5" className={styles.dot} filter="url(#pin-shadow)" />
              )}
              <text
                {...labelPlacement(side, s.visited)}
                className={`${styles.name} ${s.visited ? "" : styles.nameDim}`}
              >
                {s.short}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
