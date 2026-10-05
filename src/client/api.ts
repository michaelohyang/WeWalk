import type { ApiError } from "./outbox";

export type ApiResult<T = unknown> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: ApiError }
  | { ok: false; status: 0; error: ApiError }; // no signal

const OFFLINE: ApiError = { code: "offline", message: "No signal. Try again in a sec." };

/** Lobby wifi can hang instead of failing. Past this, treat the request as "no signal". */
export const TIMEOUT_MS = 8000;

/** A JSON request to our API. Never throws: failures come back as `{ ok: false }`. */
export async function request<T = unknown>(
  method: string,
  url: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<ApiResult<T>> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  let res: Response;
  let text: string;
  try {
    res = await fetch(url, {
      method,
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...extraHeaders,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: abort.signal,
    });
    text = await res.text();
  } catch {
    return { ok: false, status: 0, error: OFFLINE };
  } finally {
    clearTimeout(timer);
  }
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON (e.g. a proxy error page)
  }
  if (res.ok) return { ok: true, status: res.status, data: json as T };
  const error = (json as { error?: ApiError } | null)?.error ?? {
    code: "unknown",
    message: "That didn't go through. Try again.",
  };
  return { ok: false, status: res.status, error };
}

/** Field-level messages from an API error (`details.fields`). */
export function fieldErrors(error: ApiError): Record<string, string> {
  const fields = (error.details?.fields ?? {}) as Record<string, string[]>;
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v[0] ?? error.message]));
}
