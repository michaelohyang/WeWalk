"use client";

import type { AreaKey } from "@/domain/areas";
import type { LabelSide, MapGeometry, Pin } from "@/domain/map-types";
import { formatScore, tierOf } from "@/domain/scoring";
import { areaColor } from "./format";
import styles from "./MapView.module.css";

export interface MapStation {
  slug: string;
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
  area,
  here,
  onSelect,
}: {
  /** Land shapes and size, computed on the server so the projection code never ships. */
  geometry: MapGeometry;
  pins: Pin[];
  stations: Map<string, MapStation>;
  selected: string | null;
  dimmed: Set<string>;
  /** The area filter, if any: its zone is tinted more strongly. */
  area?: AreaKey | null;
  /** How many of the crew checked in at each station today: shown as a badge on the pin. */
  here?: ReadonlyMap<string, number>;
  onSelect: (slug: string | null) => void;
}) {
  const { width, height, land, zones } = geometry;
  // With an area picked, its zone stands out and the rest fade back.
  const zoneClass = (a: AreaKey) =>
    !area ? styles.zone : a === area ? styles.zoneOn : styles.zoneOff;
  // Draw unvisited first and the selected pin last, so they stack sensibly.
  const order = [...pins].sort(
    (a, b) =>
      Number(stations.get(a.slug)?.visited) - Number(stations.get(b.slug)?.visited) ||
      Number(a.slug === selected) - Number(b.slug === selected),
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
        <defs>
          <filter id="pin-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.25" />
          </filter>
          <clipPath id="zones-manhattan">
            <path d={zones.manhattan.shore} />
          </clipPath>
          {/* Soft edges where one area meets the next. */}
          <filter id="zone-blur" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        <g aria-hidden="true" className={styles.zones}>
          <g clipPath="url(#zones-manhattan)">
            <g filter="url(#zone-blur)">
              {zones.manhattan.areas.map((z) => (
                <path
                  key={z.area}
                  d={z.d}
                  style={{ fill: areaColor(z.area) }}
                  className={zoneClass(z.area)}
                />
              ))}
            </g>
          </g>
          <path
            d={zones.brooklyn}
            style={{ fill: areaColor("brooklyn") }}
            className={zoneClass("brooklyn")}
          />
          <rect {...zones.park} rx={6} className={styles.park} />
        </g>
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
          const s = stations.get(pin.slug);
          if (!s) return null;
          const isSelected = pin.slug === selected;
          const side = pin.label;
          const tier = tierOf(s.overall);
          const label = `${s.name}, ${
            s.overall !== null
              ? `${formatScore(s.overall)} out of 5`
              : s.visited
                ? "visited, not rated"
                : "not visited yet"
          }${here?.get(pin.slug) ? `, ${here.get(pin.slug)} from the crew here today` : ""}`;
          return (
            <g
              key={pin.slug}
              transform={`translate(${pin.x} ${pin.y})`}
              data-pin={pin.slug}
              className={`${styles.pin} ${dimmed.has(pin.slug) ? styles.dim : ""} ${isSelected ? styles.selected : ""}`}
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-pressed={isSelected}
              onClick={() => onSelect(isSelected ? null : pin.slug)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(isSelected ? null : pin.slug);
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
              {!!here?.get(pin.slug) && (
                <g transform="translate(15 -10)" className={styles.here} aria-hidden="true">
                  <circle r="6.5" />
                  <text y="2.8" textAnchor="middle">
                    {here.get(pin.slug)}
                  </text>
                </g>
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
