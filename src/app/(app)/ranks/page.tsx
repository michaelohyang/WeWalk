import type { Metadata } from "next";
import { AREAS, isArea, type AreaKey } from "@/domain/areas";
import { CATEGORIES, type CategoryKey } from "@/domain/categories";
import type { RankKey } from "@/domain/ranking";
import { loadRanks } from "@/server/pages";
import { ButtonLink } from "@/ui/Button";
import { Chip, ChipRow } from "@/ui/Chips";
import { Empty } from "@/ui/Empty";
import { areaColor, plural } from "@/ui/format";
import { Page, Section } from "@/ui/Page";
import { ScoreCircle } from "@/ui/ScoreCircle";
import { StationRow } from "@/ui/StationRow";
import styles from "./ranks.module.css";

export const metadata: Metadata = { title: "Ranks" };

const SORTS: { key: RankKey; label: string; title: string }[] = [
  { key: "overall", label: "Overall", title: "Best overall" },
  ...CATEGORIES.map((c) => ({ key: c.key as CategoryKey, label: c.label, title: c.rankTitle })),
];

/** /ranks?by=wifi&area=flatiron: "best Wi-Fi near Flatiron" is two taps. */
function ranksHref(by: RankKey, area: AreaKey | null) {
  const qs = new URLSearchParams();
  if (by !== "overall") qs.set("by", by);
  if (area) qs.set("area", area);
  const q = qs.toString();
  return q ? `/ranks?${q}` : "/ranks";
}

export default async function RanksPage({
  searchParams,
}: {
  searchParams: Promise<{ by?: string; area?: string }>;
}) {
  const params = await searchParams;
  const sort = SORTS.find((s) => s.key === params.by) ?? SORTS[0]!;
  const area = isArea(params.area) ? params.area : null;
  const view = await loadRanks(sort.key, area);
  if (!view) return null;
  const areaLabel = AREAS.find((a) => a.key === area)?.label;
  const monthName = new Date(`${view.month}-01T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    timeZone: "UTC",
  });
  const som = view.stationOfMonth;

  return (
    <Page title="Ranks">
      {som ? (
        <article className={styles.spot}>
          <div className={styles.spotScore}>
            <ScoreCircle value={som.station.overall} size="lg" />
          </div>
          <span className={styles.kicker}>
            {som.fresh
              ? `Station of the Month · ${monthName}`
              : `All-time champ · quiet ${monthName}`}
          </span>
          <h2>{som.station.name}</h2>
          <span className={styles.meta}>
            {som.station.neighborhood} · {plural(som.station.reviewCount, "review")}
          </span>
          <p className={styles.quote}>
            {som.station.hotTake
              ? `“${som.station.hotTake.text}”`
              : "No hot take yet. Strong, silent type."}
          </p>
          <ButtonLink href={`/s/${som.station.id}`} variant="light" size="sm">
            View station
          </ButtonLink>
        </article>
      ) : (
        <Empty title="Station of the Month: TBD">
          Rate one building and it wins by default. That&apos;s democracy.
        </Empty>
      )}

      <Section
        title={areaLabel ? `${sort.title} · ${areaLabel}` : sort.title}
        note={`${view.rows.length} rated`}
      >
        <ChipRow label="Rank by">
          {SORTS.map((s) => (
            <Chip key={s.key} current={s.key === sort.key} href={ranksHref(s.key, area)}>
              {s.label}
            </Chip>
          ))}
        </ChipRow>
        <ChipRow label="Neighborhood">
          <Chip current={!area} href={ranksHref(sort.key, null)}>
            All
          </Chip>
          {AREAS.map((a) => (
            <Chip
              key={a.key}
              current={area === a.key}
              color={areaColor(a.key)}
              href={ranksHref(sort.key, area === a.key ? null : a.key)}
            >
              {a.label}
            </Chip>
          ))}
        </ChipRow>
        {view.rows.length ? (
          <ol className={styles.rows}>
            {view.rows.map((r) => (
              <li key={r.station.id}>
                <StationRow
                  station={r.station}
                  value={r.value}
                  lead={
                    <span className={`${styles.rank} ${r.rank <= 3 ? styles.top : ""}`}>
                      {r.rank}
                    </span>
                  }
                />
              </li>
            ))}
          </ol>
        ) : (
          <Empty title="No scores here yet.">Somebody has to try it first.</Empty>
        )}
        {view.rows.length > 0 && view.unrated > 0 && (
          <p className={styles.note}>
            {plural(view.unrated, "station")} still unrated. Field trip?
          </p>
        )}
      </Section>
    </Page>
  );
}
