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
import { ThemeToggle } from "@/ui/ThemeSwitch";
import { Page, Section } from "@/ui/Page";
import { ScoreCircle } from "@/ui/ScoreCircle";
import { StationRow } from "@/ui/StationRow";
import styles from "./explore.module.css";
import { HereToday } from "./here-today";

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

/** Room the preview sheet and tab bar take at the bottom of the screen. */
const SHEET_CLEARANCE = 300;

const matcher = (f: { q: string; area: AreaKey | null; tag: Tag | null }) => (s: StationCard) =>
  (!f.area || s.area === f.area) &&
  (!f.tag || s.tags.includes(f.tag)) &&
  (!f.q ||
    `${s.name} ${s.address} ${s.neighborhood}`.toLowerCase().includes(f.q.trim().toLowerCase()));

export function Explore({ view }: { view: ExploreView }) {
  const [filters, setFilters] = useFilters(view.tags);
  const [selected, setSelected] = useState<string | null>(null);
  const hereCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const h of view.hereToday) counts.set(h.stationSlug, (counts.get(h.stationSlug) ?? 0) + 1);
    return counts;
  }, [view.hereToday]);
  const bySlug = useMemo(() => new Map(view.stations.map((s) => [s.slug, s])), [view.stations]);
  const matches = matcher(filters);
  const shown = view.stations.filter(matches);
  const dimmed = new Set(view.stations.filter((s) => !matches(s)).map((s) => s.slug));
  // Searching or filtering on the map: list what matches under it, not the usual favorites.
  const filtering = !!(filters.q || filters.area || filters.tag);
  const results = shown.length ? (
    <div className={styles.list} role="group" aria-label="Matching stations">
      {[...shown]
        .sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1) || a.name.localeCompare(b.name))
        .map((s) => (
          <StationRow key={s.slug} station={s} />
        ))}
    </div>
  ) : (
    <div className={styles.spaced}>
      <Empty title="No matches.">Nothing fits those filters. Loosen up a little.</Empty>
    </div>
  );
  const picked = selected ? bySlug.get(selected) : undefined;
  const href = (next: Partial<Filters>) => {
    const q = toQuery({ ...filters, ...next });
    return q ? `/?${q}` : "/";
  };

  // Escape closes the preview.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  // Keep the tapped pin visible above the preview sheet.
  useEffect(() => {
    if (!selected) return;
    const pin = document.querySelector(`[data-pin="${CSS.escape(selected)}"]`);
    if (!pin) return;
    const sheetTop = window.innerHeight - SHEET_CLEARANCE;
    const { top, bottom } = pin.getBoundingClientRect();
    if (bottom > sheetTop) window.scrollBy({ top: bottom - sheetTop + 24, behavior: "smooth" });
    else if (top < 0) window.scrollBy({ top: top - 24, behavior: "smooth" });
  }, [selected]);

  return (
    <Page
      title={
        <>
          We<span className={styles.brand}>Walk</span>
        </>
      }
      subtitle="NYC WeWorks, rated by people who care too much"
      action={<ThemeToggle />}
    >
      {/* A plain GET form, so search works even before the page's JavaScript loads. */}
      <form
        role="search"
        action="/"
        className={styles.search}
        onSubmit={(e) => {
          e.preventDefault();
          (document.activeElement as HTMLElement | null)?.blur();
        }}
      >
        <Icon name="search" size={18} />
        <input
          type="search"
          name="q"
          value={filters.q}
          onChange={(e) => setFilters({ q: e.target.value })}
          placeholder="Search 1460 Broadway, Dumbo, Irving Pl…"
          aria-label="Search stations"
          autoComplete="off"
          enterKeyHint="search"
        />
        {filters.area && <input type="hidden" name="area" value={filters.area} />}
        {filters.tag && <input type="hidden" name="tag" value={filters.tag} />}
        {filters.view === "list" && <input type="hidden" name="view" value="list" />}
      </form>

      <HereToday here={view.hereToday} />

      <Segmented
        label="View"
        value={filters.view}
        options={[
          { value: "map", label: "Map", href: href({ view: "map" }) },
          { value: "list", label: "List", href: href({ view: "list" }) },
        ]}
        onSelect={(v) => {
          setSelected(null);
          setFilters({ view: v });
        }}
      />

      <ChipRow label="Neighborhood">
        <Chip
          current={!filters.area}
          href={href({ area: null })}
          onSelect={() => setFilters({ area: null })}
        >
          All
        </Chip>
        {AREAS.map((a) => {
          const area = filters.area === a.key ? null : a.key;
          return (
            <Chip
              key={a.key}
              current={filters.area === a.key}
              color={areaColor(a.key)}
              href={href({ area })}
              onSelect={() => setFilters({ area })}
            >
              {a.label}
            </Chip>
          );
        })}
      </ChipRow>
      {view.tags.length > 0 && (
        <ChipRow label="Best for" showLabel>
          {view.tags.map((t) => {
            const tag = filters.tag === t ? null : t;
            return (
              <Chip
                key={t}
                current={filters.tag === t}
                href={href({ tag })}
                onSelect={() => setFilters({ tag })}
              >
                {t}
              </Chip>
            );
          })}
        </ChipRow>
      )}

      {filters.view === "list" ? (
        results
      ) : (
        <>
          <MapView
            geometry={view.map}
            pins={view.pins}
            stations={bySlug}
            selected={selected}
            dimmed={dimmed}
            area={filters.area}
            here={hereCount}
            onSelect={setSelected}
          />
          <ul className={styles.legend} aria-label="Score colors">
            <li style={{ "--c": "var(--s-great)" } as React.CSSProperties}>4.3+ elite</li>
            <li style={{ "--c": "var(--s-good)" } as React.CSSProperties}>3.5+ solid</li>
            <li style={{ "--c": "var(--s-ok)" } as React.CSSProperties}>2.8+ fine</li>
            <li style={{ "--c": "var(--s-bad)" } as React.CSSProperties}>pray</li>
            <li style={{ "--c": "var(--muted)" } as React.CSSProperties}>not yet</li>
          </ul>
          {filtering ? (
            <Section title="Matches" note={shown.length || undefined}>
              {results}
            </Section>
          ) : (
            <Section
              title="Crew favorites"
              note={`${view.visited} of ${view.stations.length} visited`}
            >
              {view.favorites.length ? (
                <div>
                  {view.favorites.map((id) => (
                    <StationRow key={id} station={bySlug.get(id)!} />
                  ))}
                </div>
              ) : (
                <Empty title="The map's all grey.">
                  Nobody&apos;s rated anything yet. Grab a coffee somewhere, then judge it.
                  <span className={styles.emptyAction}>
                    <ButtonLink href="/rate" variant="primary" size="sm">
                      Rate your first station
                    </ButtonLink>
                  </span>
                </Empty>
              )}
            </Section>
          )}
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
        <ButtonLink href={`/stations/${station.slug}`} variant="dark">
          View station
        </ButtonLink>
        <ButtonLink href={`/rate/${station.slug}`} variant="primary">
          Rate
        </ButtonLink>
      </div>
    </div>
  );
}
