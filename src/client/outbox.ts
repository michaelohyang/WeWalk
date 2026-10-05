import { request } from "./api";
import { clearDraft } from "./draft";
import { currentMember, MEMBER_HEADER } from "./member";
import { store } from "./storage";

/*
 * The offline outbox. Every write is an idempotent PUT/DELETE keyed by a client-generated id,
 * so a write can be retried any number of times and lands exactly once. Writes go into a
 * queue in localStorage first, then we try to send:
 *
 * - sent (2xx): removed from the queue.
 * - no signal, server hiccup (network error, timeout, 5xx, 408, 429): stays queued; retried
 *   when the phone comes back online, the app reopens, or the tab becomes visible again.
 * - signed out or refused (401, 403): stays queued too. Signing back in fixes it, and dropping
 *   someone's review because their session lapsed would be the worst outcome.
 * - rejected (other 4xx): removed; the caller shows why. A rejection won't fix itself, so the
 *   form's draft is kept (it's only cleared once the server has the write).
 *
 * Each write remembers who made it. Only the signed-in member's writes are sent (and the
 * server double-checks), so on a shared phone nothing posts under the wrong name.
 */

export interface Job {
  /** Unique per write; also dedupes re-submits of the same write. */
  key: string;
  method: "PUT" | "DELETE";
  url: string;
  body?: unknown;
  /** Shown while waiting, e.g. "Your review of 450 Lex". */
  label: string;
  /** The form draft this write came from: cleared once the server has it. */
  draft?: string;
  /** Who made it (null if unknown: sent by whoever is signed in). */
  memberId?: string | null;
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
/** Writes whose first try is still in flight: queued, but nobody needs to hear about it yet. */
const firstTry = new Set<string>();

export const pending = (): Job[] => store.get<Job[]>(KEY) ?? [];

const mine = (job: Job) => !job.memberId || job.memberId === currentMember();

/** Your writes that are actually waiting for signal (not the one being posted right now). */
export const waiting = (): Job[] => pending().filter((j) => mine(j) && !firstTry.has(j.key));

function notify() {
  const jobs = waiting();
  for (const l of listeners) l(jobs);
}

function save(jobs: Job[]) {
  store.set(KEY, jobs);
  notify();
}

/** Be told whenever the waiting writes change. Returns an unsubscribe function. */
export function subscribe(listener: (jobs: Job[]) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const HOLD = new Set([401, 403, 408, 429]);
const retryable = (status: number) => status >= 500 || HOLD.has(status);

async function attempt(job: Job): Promise<SendResult> {
  const author: Record<string, string> = job.memberId ? { [MEMBER_HEADER]: job.memberId } : {};
  const res = await request(job.method, job.url, job.body, author);
  if (res.ok) return { status: "sent", data: res.data };
  if (res.status === 0 || retryable(res.status)) return { status: "queued" }; // no signal / hiccup
  return { status: "rejected", httpStatus: res.status, error: res.error };
}

const outcomes = new Map<string, SendResult["status"]>();

/** How a write that left the queue ended ("sent" or "rejected"), if it ended in this tab. */
export const outcome = (key: string) => outcomes.get(key);

function settle(job: Job, result: SendResult) {
  if (result.status === "queued") return;
  outcomes.set(job.key, result.status);
  if (result.status === "sent" && job.draft) clearDraft(job.draft);
  save(pending().filter((j) => j.key !== job.key));
}

/** Queue a write and try to send it now. */
export async function send(job: Omit<Job, "queuedAt" | "memberId">): Promise<SendResult> {
  const full: Job = { ...job, memberId: currentMember(), queuedAt: Date.now() };
  firstTry.add(job.key);
  save([...pending().filter((j) => j.key !== job.key), full]);
  try {
    const result = await attempt(full);
    settle(full, result);
    return result;
  } finally {
    firstTry.delete(job.key);
    notify();
  }
}

let flushing: Promise<void> | null = null;

/** Retry everything queued, oldest first. Safe to call often; runs one flush at a time. */
export function flush(
  onRejected?: (job: Job, result: SendResult & { status: "rejected" }) => void,
) {
  // `.finally` runs after the assignment even when there's nothing to send (an async function
  // with no awaits finishes synchronously, which would leave a stale, never-cleared lock).
  flushing ??= (async () => {
    for (const job of waiting()) {
      const result = await attempt(job);
      if (result.status === "queued") break; // still offline: try again later
      settle(job, result);
      if (result.status === "rejected") onRejected?.(job, result);
    }
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}
