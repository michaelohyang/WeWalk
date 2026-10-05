import { currentMember } from "./member";
import { store } from "./storage";

/** Drafts belong to whoever is signed in: a shared phone never shows you someone else's. */
const scoped = (key: string) => `wewalk:draft:${currentMember() ?? "anyone"}:${key}`;

/** Autosaved form state, so a reload or a dropped tab never loses a half-written review. */
export function loadDraft<T>(key: string): T | null {
  return store.get<{ savedAt: number; value: T }>(scoped(key))?.value ?? null;
}

export function saveDraft(key: string, value: unknown): void {
  store.set(scoped(key), { savedAt: Date.now(), value });
}

export function clearDraft(key: string): void {
  store.remove(scoped(key));
}
