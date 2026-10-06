"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AREAS, isArea, type AreaKey } from "@/domain/areas";
import type { Tag } from "@/domain/tags";
import type { ExploreView, StationCard } from "@/server/services/views";
import { ButtonLink } from "@/ui/Button";
import { Chip, ChipRow } from "@/ui/Chips";
import { Empty } from "@/ui/Empty";
import { areaColor } from "@/ui/format";
import { Icon } from "@/ui/Icon";
import { Page, Section } from "@/ui/Page";
import { StationRow } from "@/ui/StationRow";
import { ThemeToggle } from "@/ui/ThemeSwitch";
import { AreaTiles } from "./area-tiles";
import styles from "./explore.module.css";
import { Feed } from "./feed";
import { HereToday } from "./here-today";

type Filters = { q: string; area: AreaKey | null; tag: Tag | null };

function parseFilters(params: URLSearchParams, tags: readonly Tag[]): Filters {
  const area = params.get("area");
  const tag = params.get("tag");
  return {
    q: params.get("q") ?? "",
    area: isArea(area) ? area : null,
    tag: tags.includes(tag as Tag) ? (tag as Tag) : null,
  };
}

function toQuery(f: Filters): string {
  const qs = new URLSearchParams();
  if (f.q) qs.set("q", f.q);
  if (f.area) qs.set("area", f.area);
  if (f.tag) qs.set("tag", f.tag);
  return qs.toString();
}

/**
 * Filters live in React state (so quick taps never read a stale URL) and are mirrored into the
 * URL (?q=&area=&tag=), so Back and shared links restore them.
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

const matcher = (f: Filters) => (s: StationCard) =>
  (!f.area || s.area === f.area) &&
  (!f.tag || s.tags.includes(f.tag)) &&
  (!f.q ||
    `${s.name} ${s.address} ${s.neighborhood}`.toLowerCase().includes(f.q.trim().toLowerCase()));

/**
 * Home. Browsing: who's out today, the five areas as tiles, then the crew's latest reviews and
 * check-ins. Searching or picking an area or tag: the matching buildings as a list.
 */
export function Explore({ view }: { view: ExploreView }) {
  const [filters, setFilters] = useFilters(view.tags);
  const filtering = !!(filters.q || filters.area || filters.tag);
  const shown = view.stations
    .filter(matcher(filters))
    .sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1) || a.name.localeCompare(b.name));
  const href = (next: Partial<Filters>) => {
    const q = toQuery({ ...filters, ...next });
    return q ? `/?${q}` : "/";
  };

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
      </form>

      {filtering ? (
        <>
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
          <TagChips tags={view.tags} current={filters.tag} href={href} onSelect={setFilters} />
          <Section title="Matches" note={shown.length || undefined}>
            {shown.length ? (
              <div className={styles.list} role="group" aria-label="Matching stations">
                {shown.map((s) => (
                  <StationRow key={s.slug} station={s} />
                ))}
              </div>
            ) : (
              <Empty title="No matches.">Nothing fits those filters. Loosen up a little.</Empty>
            )}
            <p className={styles.clear}>
              <Link
                href="/"
                scroll={false}
                onClick={(e) => {
                  e.preventDefault();
                  setFilters({ q: "", area: null, tag: null });
                }}
              >
                ← Back to the crew feed
              </Link>
            </p>
          </Section>
        </>
      ) : (
        <>
          <HereToday here={view.hereToday} />
          <AreaTiles
            areas={view.areas}
            href={(area) => href({ area })}
            onSelect={(area) => setFilters({ area })}
          />
          <TagChips tags={view.tags} current={filters.tag} href={href} onSelect={setFilters} />
          <Section title="Latest from the crew">
            {view.feed.length ? (
              <Feed entries={view.feed} />
            ) : (
              <Empty title="Quiet so far.">
                Nobody&apos;s checked in or rated anything yet. Grab a coffee somewhere, then judge
                it.
                <span className={styles.emptyAction}>
                  <ButtonLink href="/rate" variant="primary" size="sm">
                    Rate your first station
                  </ButtonLink>
                </span>
              </Empty>
            )}
          </Section>
        </>
      )}
    </Page>
  );
}

function TagChips({
  tags,
  current,
  href,
  onSelect,
}: {
  tags: Tag[];
  current: Tag | null;
  href: (next: Partial<Filters>) => string;
  onSelect: (next: Partial<Filters>) => void;
}) {
  if (!tags.length) return null;
  return (
    <ChipRow label="Best for" showLabel>
      {tags.map((t) => {
        const tag = current === t ? null : t;
        return (
          <Chip
            key={t}
            current={current === t}
            href={href({ tag })}
            onSelect={() => onSelect({ tag })}
          >
            {t}
          </Chip>
        );
      })}
    </ChipRow>
  );
}
