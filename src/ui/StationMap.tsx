"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { AreaKey } from "@/domain/areas";
import { formatScore, tierOf } from "@/domain/scoring";
import { placeName } from "@/domain/place-name";
import { ButtonLink } from "./Button";
import { Empty } from "./Empty";
import { plural } from "./format";
import { ScoreCircle } from "./ScoreCircle";
import styles from "./StationMap.module.css";

export interface MapPin {
  slug: string;
  name: string;
  /** The full street address, shown under the name (many names are just the address). */
  address: string;
  neighborhood: string;
  area: AreaKey;
  overall: number | null;
  reviewCount: number;
  /** Anyone in the crew has been. */
  visited: boolean;
  /** You have been. */
  mine: boolean;
  lat: number;
  lng: number;
}

/* OpenFreeMap: free OpenStreetMap vector tiles, no API key or usage cap. */
const MAP_STYLES = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
} as const;
type Theme = keyof typeof MAP_STYLES;

/** Pins grow from dots into score badges once neighboring buildings stop overlapping. */
const NEAR_ZOOM = 13.5;
/** Room around the stations when framing; more at the bottom, where the map credits sit. */
const FRAME_PADDING = { top: 36, right: 36, bottom: 72, left: 36 };
/** How long the map credits stay open before folding into the (i) button. */
const CREDITS_SHOWN_MS = 5000;
/** How far past the outermost stations you can pan, in degrees (about 30 km). */
const PAN_MARGIN = 0.3;

/** The app's resolved theme: an explicit choice on <html>, else the system setting. */
function currentTheme(): Theme {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === "light" || chosen === "dark") return chosen;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const pinLabel = (p: MapPin) =>
  `${p.name}, ${p.overall === null ? "not rated yet" : `${formatScore(p.overall)} out of 5`}`;

/** Pins are MapLibre's DOM, not React's: mark the selected one by hand. */
function markSelected(root: HTMLElement | null, slug: string | null) {
  for (const pin of root?.querySelectorAll<HTMLElement>("[data-slug]") ?? []) {
    const on = pin.dataset.slug === slug;
    pin.classList.toggle(styles.active!, on);
    pin.setAttribute("aria-pressed", String(on));
  }
}

/**
 * A draggable street map with a pin per station, colored by the crew's score. Tapping a pin
 * shows that station's card under the map. MapLibre needs `window` and WebGL, so it loads in
 * the browser only, and only on this screen.
 */
export function StationMap({
  pins,
  compact = false,
}: {
  pins: MapPin[];
  /** Shorter, without the "drag to explore" hint: the map card on Home. */
  compact?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  /** The map and MapLibre's Marker class, once the library has downloaded. */
  const [loaded, setLoaded] = useState<{
    map: MapLibreMap;
    Marker: typeof MapLibreMarker;
  } | null>(null);
  // The first pins frame the map. Later data refreshes (e.g. after the outbox syncs) only swap
  // the pins, so the view and the selection survive them.
  const [framePins] = useState(pins);
  const selectedRef = useRef(selected);

  useEffect(() => {
    const el = container.current;
    if (!el || !framePins.length) return;
    // Strict mode runs this twice; the first run's import may finish after its cleanup.
    let cancelled = false;
    let map: MapLibreMap | undefined;
    let stopWatchingTheme = () => {};
    let creditsTimer: ReturnType<typeof setTimeout> | undefined;

    import("maplibre-gl")
      .then(({ AttributionControl, LngLatBounds, Map, Marker, NavigationControl }) => {
        if (cancelled) return;
        const bounds = new LngLatBounds();
        for (const p of framePins) bounds.extend([p.lng, p.lat]);
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        let theme = currentTheme();
        const m = new Map({
          container: el,
          style: MAP_STYLES[theme],
          bounds,
          fitBoundsOptions: { padding: FRAME_PADDING },
          maxBounds: [
            [sw.lng - PAN_MARGIN, sw.lat - PAN_MARGIN],
            [ne.lng + PAN_MARGIN, ne.lat + PAN_MARGIN],
          ],
          attributionControl: false,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          // Embedded in a scrolling page (Home): one finger scrolls the page, two move the map.
          cooperativeGestures: compact,
        });
        map = m;
        m.touchZoomRotate.disableRotation();
        m.addControl(new NavigationControl({ showCompass: false }), "top-right");
        m.addControl(new AttributionControl({ compact: true }), "bottom-right");
        let moved = false;
        m.once("dragstart", () => (moved = true));
        m.once("load", () => {
          // The container can settle to its final size after the map is created (the Home card):
          // measure again and frame every station, unless you've already started exploring.
          m.resize();
          if (!moved) m.fitBounds(bounds, { padding: FRAME_PADDING, animate: false });
          // OpenStreetMap's attribution rules: show the credits first, then they may fold into
          // the (i) button after five seconds (MapLibre also folds them as soon as you drag).
          creditsTimer = setTimeout(() => {
            const credits = el.querySelector(".maplibregl-ctrl-attrib");
            credits?.classList.remove("maplibregl-compact-show");
            credits?.removeAttribute("open");
          }, CREDITS_SHOWN_MS);
        });

        // A data attribute, not a class: React owns this element's className.
        const sizePins = () => {
          if (m.getZoom() >= NEAR_ZOOM) el.dataset.near = "";
          else delete el.dataset.near;
        };
        m.on("zoom", sizePins);
        sizePins();
        m.on("click", () => setSelected(null));

        // Follow the app's theme while the map is open (the moon button or the OS setting).
        const syncTheme = () => {
          const next = currentTheme();
          if (next === theme) return;
          theme = next;
          m.setStyle(MAP_STYLES[next]);
        };
        const observer = new MutationObserver(syncTheme);
        observer.observe(document.documentElement, { attributeFilter: ["data-theme"] });
        const media = matchMedia("(prefers-color-scheme: dark)");
        media.addEventListener("change", syncTheme);
        stopWatchingTheme = () => {
          observer.disconnect();
          media.removeEventListener("change", syncTheme);
        };
        setLoaded({ map: m, Marker });
      })
      .catch((error: unknown) => {
        // No WebGL, or the map code didn't download (offline).
        console.error("Station map failed to load", error);
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      clearTimeout(creditsTimer);
      stopWatchingTheme();
      map?.remove();
    };
  }, [framePins, compact]);

  // (Re)place the pins whenever the station data changes, keeping the selection marked.
  useEffect(() => {
    if (!loaded) return;
    const { map, Marker } = loaded;
    const markers = pins.map((p) => {
      const pin = document.createElement("button");
      pin.type = "button";
      pin.className = `${styles.pin} ${styles[tierOf(p.overall) ?? "none"]}`;
      pin.textContent = formatScore(p.overall);
      pin.dataset.slug = p.slug;
      pin.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelected(p.slug);
      });
      const marker = new Marker({ element: pin }).setLngLat([p.lng, p.lat]).addTo(map);
      // Set after the Marker, which labels its element generically.
      pin.setAttribute("aria-label", pinLabel(p));
      // On Home, ~30 pins would be Tab stops before the rest of the page; "Full map" (just
      // before the map) has them all. Taps still work.
      if (compact) pin.tabIndex = -1;
      return marker;
    });
    markSelected(container.current, selectedRef.current);
    return () => {
      for (const marker of markers) marker.remove();
    };
  }, [loaded, pins, compact]);

  useEffect(() => {
    selectedRef.current = selected;
    markSelected(container.current, selected);
  }, [selected]);

  if (!pins.length) return <Empty title="No stations yet.">Nothing to put on the map.</Empty>;
  if (failed)
    return (
      <Empty title="The map didn't load.">
        Your browser may not support it, or you&apos;re offline. The station list on Home still
        works.
      </Empty>
    );

  const station = pins.find((p) => p.slug === selected);
  return (
    <>
      <div ref={container} className={compact ? `${styles.map} ${styles.compact}` : styles.map} />
      <div className={compact ? styles.cardCompact : styles.card} aria-live="polite">
        {station ? (
          <article className={styles.station} aria-label={station.name}>
            <ScoreCircle value={station.overall} />
            <div className={styles.info}>
              {/* On Home the card sits under the map section's own h2. */}
              {compact ? (
                <h3 className={styles.name}>{placeName(station)}</h3>
              ) : (
                <h2 className={styles.name}>{placeName(station)}</h2>
              )}
              <p className={styles.address}>{station.address}</p>
              <p className={styles.meta}>
                {station.neighborhood} · {plural(station.reviewCount, "review")}
                {station.mine ? " · you've been" : station.visited ? " · crew's been" : ""}
              </p>
            </div>
            <ButtonLink href={`/stations/${station.slug}`} variant="primary" size="sm">
              View
            </ButtonLink>
          </article>
        ) : (
          !compact && <p className={styles.hint}>Drag to explore. Tap a pin to see the station.</p>
        )}
      </div>
    </>
  );
}
