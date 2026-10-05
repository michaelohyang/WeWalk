"use client";

import type { MapGeometry, Pin } from "@/domain/map-types";
import { formatScore, tierOf } from "@/domain/scoring";
import styles from "./MapView.module.css";

export interface MapStation {
  id: string;
  name: string;
  short: string;
  overall: number | null;
  visited: boolean;
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
  const { width, height, squeezeY, land } = geometry;
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
        <line x1="0" x2={width} y1={squeezeY} y2={squeezeY} className={styles.squeeze} />
        <text x={width - 8} y={squeezeY - 5} textAnchor="end" className={styles.geo}>
          Uptown, not to scale ↑
        </text>
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
          const side = pin.label ?? (isSelected ? "right" : null);
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
                  />
                  <text y="3.6" textAnchor="middle" className={styles.value}>
                    {tier ? formatScore(s.overall) : "✓"}
                  </text>
                </>
              ) : (
                <circle r="4.5" className={styles.dot} />
              )}
              {side && (
                <text
                  x={side === "right" ? (s.visited ? 19 : 8) : s.visited ? -19 : -8}
                  y="3"
                  textAnchor={side === "right" ? "start" : "end"}
                  className={`${styles.name} ${s.visited ? "" : styles.nameDim}`}
                >
                  {s.short}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
