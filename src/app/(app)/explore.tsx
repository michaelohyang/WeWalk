"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AREAS, isArea, type AreaKey } from "@/domain/areas";
import { tierOf } from "@/domain/scoring";
import type { Tag } from "@/domain/tags";
import type { ExploreView, StationCard } from "@/server/services/views";
import { ButtonLink } from "@/ui/Button";
import { Chip, ChipRow, Segmented } from "@/ui/Chips";
import { Empty } from "@/ui/Empty";
import { areaColor, tierWord } from "@/ui/format";
import { Icon } from "@/ui/Icon";
import { MapView } from "@/ui/MapView";
import { Page, Section } from "@/ui/Page";
import { ScoreCircle } from "@/ui/ScoreCircle";
import { StationRow } from "@/ui/StationRow";
import styles from "./explore.module.css";

type Filters = { q: string; area: AreaKey | null; tag: Tag | null; view: "map" | "list" };

function parseFilters(params: URLSearchParams, tags: readonly Tag[]): Filters {
  const area = params.get("area");
  const tag = params.get("tag");
  return {
    q: params.get("q") ?? "",
    area: isArea(area) ? area : null,
    tag: tags.includes(tag as Tag) ? (tag as Tag) : null,
    view: params.get("view") === "list" ? "list" : "map",
  };
}

function toQuery(f: Filters): string {
  const qs = new URLSearchParams();
  if (f.q) qs.set("q", f.q);
  if (f.area) qs.set("area", f.area);
  if (f.tag) qs.set("tag", f.tag);
  if (f.view === "list") qs.set("view", "list");
  return qs.toString();
}

/**
 * Filters live in React state (so quick taps never read a stale URL) and are mirrored into the
 * URL (?q=&area=&tag=&view=list), so Back and shared links restore them.
 */
function useFilters(tags: readonly Tag[]) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [filters, setFilters] = useState(() => parseFilters(params, tags));
  useEffect(() => {
    const next = toQuery(filters);
    if (next !== params.toString())
      router.replace(next ? `${path}?${next}` : path, { scroll: false });
  }, [filters, params, path, router]);
  const set = (next: Partial<Filters>) => setFilters((prev) => ({ ...prev, ...next }));
  return [filters, set] as const;
}

const matcher = (f: { q: string; area: AreaKey | null; tag: Tag | null }) => (s: StationCard) =>
  (!f.area || s.area === f.area) &&
  (!f.tag || s.tags.includes(f.tag)) &&
  (!f.q ||
    `${s.name} ${s.address} ${s.neighborhood}`.toLowerCase().includes(f.q.trim().toLowerCase()));

export function Explore({ view }: { view: ExploreView }) {
  const [filters, setFilters] = useFilters(view.tags);
  const [selected, setSelected] = useState<string | null>(null);
  const byId = useMemo(() => new Map(view.stations.map((s) => [s.id, s])), [view.stations]);
  const matches = matcher(filters);
  const shown = view.stations.filter(matches);
  const dimmed = new Set(view.stations.filter((s) => !matches(s)).map((s) => s.id));
  const picked = selected ? byId.get(selected) : undefined;

  return (
    <Page
      title={
        <>
          We<span className={styles.brand}>Walk</span>
        </>
      }
      subtitle="NYC WeWorks, rated by people who care too much"
    >
      <label className={styles.search}>
        <Icon name="search" size={18} />
        <input
          type="search"
          value={filters.q}
          onChange={(e) => setFilters({ q: e.target.value })}
          placeholder="Search 1460 Broadway, Dumbo, Irving Pl…"
          aria-label="Search stations"
          autoComplete="off"
        />
      </label>

      <Segmented
        label="View"
        value={filters.view}
        options={[
          { value: "map", label: "Map" },
          { value: "list", label: "List" },
        ]}
        onChange={(v) => {
          setSelected(null);
          setFilters({ view: v });
        }}
      />

      <ChipRow label="Neighborhood">
        <Chip pressed={!filters.area} onClick={() => setFilters({ area: null })}>
          All
        </Chip>
        {AREAS.map((a) => (
          <Chip
            key={a.key}
            pressed={filters.area === a.key}
            color={areaColor(a.key)}
            onClick={() => setFilters({ area: filters.area === a.key ? null : a.key })}
          >
            {a.label}
          </Chip>
        ))}
      </ChipRow>
      {view.tags.length > 0 && (
        <ChipRow label="Best for">
          {view.tags.map((t) => (
            <Chip
              key={t}
              pressed={filters.tag === t}
              onClick={() => setFilters({ tag: filters.tag === t ? null : t })}
            >
              {t}
            </Chip>
          ))}
        </ChipRow>
      )}

      {filters.view === "list" ? (
        shown.length ? (
          <div className={styles.list}>
            {[...shown]
              .sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1) || a.name.localeCompare(b.name))
              .map((s) => (
                <StationRow key={s.id} station={s} />
              ))}
          </div>
        ) : (
          <div className={styles.spaced}>
            <Empty title="No matches.">Nothing fits those filters. Loosen up a little.</Empty>
          </div>
        )
      ) : (
        <>
          <MapView
            geometry={view.map}
            pins={view.pins}
            stations={byId}
            selected={selected}
            dimmed={dimmed}
            onSelect={setSelected}
          />
          <ul className={styles.legend} aria-label="Score colors">
            <li style={{ "--c": "var(--s-great)" } as React.CSSProperties}>4.3+ elite</li>
            <li style={{ "--c": "var(--s-good)" } as React.CSSProperties}>3.5+ solid</li>
            <li style={{ "--c": "var(--s-ok)" } as React.CSSProperties}>2.8+ fine</li>
            <li style={{ "--c": "var(--s-bad)" } as React.CSSProperties}>pray</li>
            <li style={{ "--c": "var(--muted)" } as React.CSSProperties}>not yet</li>
          </ul>
          <Section
            title="Crew favorites"
            note={`${view.visited} of ${view.stations.length} visited`}
          >
            {view.favorites.length ? (
              <div>
                {view.favorites.map((id) => (
                  <StationRow key={id} station={byId.get(id)!} />
                ))}
              </div>
            ) : (
              <Empty title="The map's all grey.">
                Nobody&apos;s rated anything yet. Grab a coffee somewhere, then judge it.
              </Empty>
            )}
          </Section>
        </>
      )}

      {picked && filters.view === "map" && (
        <Preview station={picked} onClose={() => setSelected(null)} />
      )}
    </Page>
  );
}

function Preview({ station, onClose }: { station: StationCard; onClose: () => void }) {
  const verdict = station.hotTake
    ? `“${station.hotTake.text}”`
    : station.visited
      ? "Been here, but nobody's said anything spicy yet."
      : "Nobody from the crew has been here yet.";
  return (
    <div className={styles.sheet} role="dialog" aria-label={`${station.name} preview`}>
      <div className={styles.sheetHead}>
        <ScoreCircle value={station.overall} />
        <div className={styles.sheetTitle}>
          <h3>{station.name}</h3>
          <p>
            {station.neighborhood} · {tierWord(tierOf(station.overall))}
          </p>
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close preview">
          <Icon name="close" size={18} />
        </button>
      </div>
      <p className={styles.verdict}>{verdict}</p>
      <div className={styles.sheetActions}>
        <ButtonLink href={`/s/${station.id}`} variant="dark">
          View station
        </ButtonLink>
        <ButtonLink href={`/rate/${station.id}`} variant="primary">
          Rate
        </ButtonLink>
      </div>
    </div>
  );
}
