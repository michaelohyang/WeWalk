import type { ApiError } from "./outbox";

export type ApiResult<T = unknown> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: ApiError }
  | { ok: false; status: 0; error: ApiError }; // no signal

const OFFLINE: ApiError = { code: "offline", message: "No signal. Try again in a sec." };

/** A JSON request to our API. Never throws: failures come back as `{ ok: false }`. */
export async function request<T = unknown>(
  method: string,
  url: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, error: OFFLINE };
  }
  const text = await res.text();
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
