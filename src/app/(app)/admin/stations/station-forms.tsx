"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { fieldErrors, request } from "@/client/api";
import { areasIn, CITIES } from "@/domain/areas";
import forms from "@/ui/forms.module.css";
import { Select } from "@/ui/Select";
import { useToast } from "@/ui/Toast";
import styles from "./admin.module.css";

/** A station as the admin page passes it in (the server's AdminStation). */
export interface StationValues {
  slug: string;
  name: string;
  short: string | null;
  address: string;
  neighborhood: string;
  area: string;
  lat: number;
  lng: number;
  hidden: boolean;
}

const AREA_GROUPS = CITIES.map((c) => ({
  label: c.name,
  options: areasIn(c.key).map((a) => ({ value: a.key, label: a.label })),
}));

const EMPTY = {
  name: "",
  short: "",
  address: "",
  neighborhood: "",
  area: "",
  lat: "",
  lng: "",
  hidden: false,
};
type Draft = typeof EMPTY;

const draftOf = (s: StationValues): Draft => ({
  name: s.name,
  short: s.short ?? "",
  address: s.address,
  neighborhood: s.neighborhood,
  area: s.area,
  lat: String(s.lat),
  lng: String(s.lng),
  hidden: s.hidden,
});

/** Blank stays null so the server says "enter a number" instead of reading it as 0. */
const coordinate = (value: string) => (value.trim() === "" ? null : Number(value));

/** The building form, for adding (no `station`) or editing one. */
function StationForm({ station, onSaved }: { station?: StationValues; onSaved?: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(station ? draftOf(station) : EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const idPrefix = station ? `edit-${station.slug}` : "new";

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors(({ [key]: _gone, ...rest }) => (void _gone, rest));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const body = { ...draft, lat: coordinate(draft.lat), lng: coordinate(draft.lng) };
    const res = station
      ? await request("PUT", `/api/admin/stations/${station.slug}`, body)
      : await request<{ station: StationValues }>("POST", "/api/admin/stations", body);
    setBusy(false);
    if (!res.ok) {
      const byField = fieldErrors(res.error);
      setErrors(Object.keys(byField).length ? byField : { form: res.error.message });
      return;
    }
    setErrors({});
    if (!station) setDraft(EMPTY);
    toast(station ? `Saved ${draft.name.trim()}.` : `Added ${draft.name.trim()}.`);
    onSaved?.();
    router.refresh();
  }

  const text = (key: "name" | "short" | "address" | "neighborhood", label: string, max: number) => (
    <label className={forms.field}>
      <span>{label}</span>
      <input
        className={forms.input}
        value={draft[key]}
        maxLength={max}
        onChange={(e) => set(key, e.target.value)}
        aria-invalid={!!errors[key]}
      />
      {errors[key] && <span className={forms.error}>{errors[key]}</span>}
    </label>
  );
  const coord = (key: "lat" | "lng", label: string) => (
    <label className={forms.field}>
      <span>{label}</span>
      <input
        className={forms.input}
        value={draft[key]}
        inputMode="decimal"
        onChange={(e) => set(key, e.target.value)}
        aria-invalid={!!errors[key]}
      />
      {errors[key] && <span className={forms.error}>{errors[key]}</span>}
    </label>
  );

  return (
    <form className={forms.card} onSubmit={submit} noValidate>
      {text("name", "Name", 80)}
      {station ? (
        <p className={forms.lede}>Link: /stations/{station.slug} (stays the same)</p>
      ) : (
        <p className={forms.lede}>Its link comes from the name and can&apos;t change later.</p>
      )}
      {text("short", "Short name (optional, for the map and stamps)", 30)}
      {text("address", "Address", 200)}
      {text("neighborhood", "Neighborhood", 60)}
      <label className={forms.field}>
        <span>Area</span>
        <Select
          id={`${idPrefix}-area`}
          className={forms.input}
          value={draft.area}
          onValueChange={(v) => set("area", v)}
          placeholder="Pick an area…"
          groups={AREA_GROUPS}
          invalid={!!errors.area}
        />
        {errors.area && <span className={forms.error}>{errors.area}</span>}
      </label>
      <div className={styles.pair}>
        {coord("lat", "Latitude")}
        {coord("lng", "Longitude")}
      </div>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={draft.hidden}
          onChange={(e) => set("hidden", e.target.checked)}
        />
        <span>Hidden: off the map and lists. Its reviews are kept.</span>
      </label>
      {errors.form && (
        <p className={forms.error} role="alert">
          {errors.form}
        </p>
      )}
      <button type="submit" className={station ? forms.secondary : forms.primary} disabled={busy}>
        {busy ? "Saving…" : station ? "Save changes" : "Add building"}
      </button>
    </form>
  );
}

export function AddStation() {
  return <StationForm />;
}

/** One building in the list, with its edit form folded away. */
export function EditStation({ station }: { station: StationValues }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className={styles.item}>
      <div className={styles.summary}>
        <div className={styles.text}>
          <b>{station.name}</b>
          <span className={styles.meta}>
            {station.short ? `${station.short} · ` : ""}
            {station.neighborhood}
          </span>
        </div>
        {station.hidden && <span className={styles.hidden}>Hidden</span>}
        <Collapsible.Trigger className={forms.textBtn}>
          {open ? "Close" : "Edit"}
        </Collapsible.Trigger>
      </div>
      <Collapsible.Content>
        <StationForm station={station} onSaved={() => setOpen(false)} />
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
