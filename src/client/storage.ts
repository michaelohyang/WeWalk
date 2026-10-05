/** localStorage that never throws (private mode, quota, disabled storage): it just forgets. */
export const store = {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage unavailable: the app still works, it just can't remember
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // as above
    }
  },
};
