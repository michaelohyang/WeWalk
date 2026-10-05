import { request } from "./api";
import { store } from "./storage";

/*
 * The offline outbox. Every write is an idempotent PUT/DELETE keyed by a client-generated id,
 * so a write can be retried any number of times and lands exactly once. Writes go into a
 * queue in localStorage first, then we try to send:
 *
 * - sent (2xx): removed from the queue.
 * - no signal, server hiccup (network error, 5xx, 408, 429): stays queued; retried when the
 *   phone comes back online, the app reopens, or the tab becomes visible again.
 * - rejected (other 4xx): removed; the caller shows why. A rejection won't fix itself.
 */

export interface Job {
  /** Unique per write; also dedupes re-submits of the same write. */
  key: string;
  method: "PUT" | "DELETE";
  url: string;
  body?: unknown;
  /** Shown while waiting, e.g. "Your review of 450 Lex". */
  label: string;
  queuedAt: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type SendResult =
  | { status: "sent"; data: unknown }
  | { status: "queued" }
  | { status: "rejected"; httpStatus: number; error: ApiError };

const KEY = "wewalk:outbox";
const listeners = new Set<(jobs: Job[]) => void>();

export const pending = (): Job[] => store.get<Job[]>(KEY) ?? [];

function save(jobs: Job[]) {
  store.set(KEY, jobs);
  for (const l of listeners) l(jobs);
}

/** Be told whenever the queue changes. Returns an unsubscribe function. */
export function subscribe(listener: (jobs: Job[]) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const retryable = (status: number) => status >= 500 || status === 408 || status === 429;

async function attempt(job: Job): Promise<SendResult> {
  const res = await request(job.method, job.url, job.body);
  if (res.ok) return { status: "sent", data: res.data };
  if (res.status === 0 || retryable(res.status)) return { status: "queued" }; // no signal / hiccup
  return { status: "rejected", httpStatus: res.status, error: res.error };
}

function settle(job: Job, result: SendResult) {
  if (result.status !== "queued") save(pending().filter((j) => j.key !== job.key));
}

/** Queue a write and try to send it now. */
export async function send(job: Omit<Job, "queuedAt">): Promise<SendResult> {
  const full = { ...job, queuedAt: Date.now() };
  save([...pending().filter((j) => j.key !== job.key), full]);
  const result = await attempt(full);
  settle(full, result);
  return result;
}

let flushing: Promise<void> | null = null;

/** Retry everything queued, oldest first. Safe to call often; runs one flush at a time. */
export function flush(
  onRejected?: (job: Job, result: SendResult & { status: "rejected" }) => void,
) {
  flushing ??= (async () => {
    try {
      for (const job of pending()) {
        const result = await attempt(job);
        if (result.status === "queued") break; // still offline: try again later
        settle(job, result);
        if (result.status === "rejected") onRejected?.(job, result);
      }
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}
