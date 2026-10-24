import { currentMember } from "./member";
import { store } from "./storage";

/** Drafts belong to whoever is signed in: a shared phone never shows you someone else's. */
const prefix = (memberId: string | null) => `wewalk:draft:${memberId ?? "anyone"}:`;
const scoped = (key: string) => `${prefix(currentMember())}${key}`;

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

/** Every draft a member left on this phone (their account is gone). */
export function clearMemberDrafts(memberId: string): void {
  for (const key of store.keys()) if (key.startsWith(prefix(memberId))) store.remove(key);
}
