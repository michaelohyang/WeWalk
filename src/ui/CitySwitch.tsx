"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CITIES, CITY_COOKIE, type CityKey } from "@/domain/areas";
import { SegmentedButtons } from "./SegmentedButtons";

/**
 * NYC | Boston | Atlanta. Remembered on this phone (a cookie the pages read), and shared by
 * Home, Map, Ranks and Passport. Switching drops the area filter (an area from another city
 * would show nothing), keeps the rest (e.g. Ranks' sort) and reloads the page's data.
 */
export function CitySwitch({ city }: { city: CityKey }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  return (
    <SegmentedButtons
      label="City"
      value={city}
      options={CITIES.map((c) => ({ value: c.key, label: c.label }))}
      onChange={(next) => {
        const secure = location.protocol === "https:" ? "; secure" : "";
        document.cookie = `${CITY_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax${secure}`;
        const kept = new URLSearchParams(params);
        kept.delete("area");
        const query = kept.toString();
        router.replace(query ? `${path}?${query}` : path, { scroll: false });
        router.refresh();
      }}
    />
  );
}
