import { CITY_COOKIE, type CityKey } from "@/domain/areas";

/** Remembers the city on this phone (a cookie the pages read). */
export function rememberCity(city: CityKey): void {
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${CITY_COOKIE}=${city}; path=/; max-age=31536000; samesite=lax${secure}`;
}
