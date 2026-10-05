import type { Metadata } from "next";
import { CATEGORIES, type CategoryKey } from "@/domain/categories";
import type { RankKey } from "@/domain/ranking";
import { loadRanks } from "@/server/pages";
import { ButtonLink } from "@/ui/Button";
import { Chip, ChipRow } from "@/ui/Chips";
import { Empty } from "@/ui/Empty";
import { plural } from "@/ui/format";
import { Page, Section } from "@/ui/Page";
import { ScoreCircle } from "@/ui/ScoreCircle";
import { StationRow } from "@/ui/StationRow";
import styles from "./ranks.module.css";

export const metadata: Metadata = { title: "Ranks" };

const SORTS: { key: RankKey; label: string }[] = [
  { key: "overall", label: "Overall" },
  ...CATEGORIES.map((c) => ({ key: c.key as CategoryKey, label: c.label })),
];

export default async function RanksPage({
  searchParams,
}: {
  searchParams: Promise<{ by?: string }>;
}) {
  const { by } = await searchParams;
  const key = SORTS.find((s) => s.key === by)?.key ?? "overall";
  const view = await loadRanks(key);
  if (!view) return null;
  const label = SORTS.find((s) => s.key === key)!.label;
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
              : "Top marks, zero words. Classic."}
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
        title={key === "overall" ? "Best overall" : `Best for ${label.toLowerCase()}`}
        note={`${view.rows.length} rated`}
      >
        <ChipRow label="Rank by">
          {SORTS.map((s) => (
            <Chip
              key={s.key}
              pressed={s.key === key}
              href={s.key === "overall" ? "/ranks" : `/ranks?by=${s.key}`}
            >
              {s.label}
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
          <Empty title={`No ${label.toLowerCase()} scores yet.`}>
            Somebody has to try it first.
          </Empty>
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
