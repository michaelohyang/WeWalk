import { store } from "./storage";

/** Autosaved form state, so a reload or a dropped tab never loses a half-written review. */
export function loadDraft<T>(key: string): T | null {
  return store.get<{ savedAt: number; value: T }>(`wewalk:draft:${key}`)?.value ?? null;
}

export function saveDraft(key: string, value: unknown): void {
  store.set(`wewalk:draft:${key}`, { savedAt: Date.now(), value });
}

export function clearDraft(key: string): void {
  store.remove(`wewalk:draft:${key}`);
}

/** The station you last rated: the default when you open the rate form from the tab bar. */
export const lastStation = {
  get: () => store.get<string>("wewalk:lastStation"),
  set: (id: string) => store.set("wewalk:lastStation", id),
};
