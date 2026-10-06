/**
 * Failures a caller can act on. Routes map `code` to an HTTP status; anything else is a 500.
 * Field-level problems go in `details.fields` as `{ [field]: string[] }`, the same shape for
 * validation and service errors.
 */
export type AppErrorCode =
  | "invalid" // 400: the input breaks a rule
  | "unauthorized" // 401: no valid session or invite code
  | "forbidden" // 403: signed in, but not allowed
  | "not_found" // 404
  | "conflict" // 409: clashes with existing data
  | "gone" // 410: a one-time link that expired or was used
  | "too_large" // 413: request body over the limit
  | "unavailable"; // 503: a feature that isn't set up on this deployment

export class AppError extends Error {
  constructor(
    readonly code: AppErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** True if `error` is a Postgres unique violation, optionally on a specific constraint/index. */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  // postgres-js puts fields on the error; Drizzle wraps it in `cause`; PGlite uses `constraint`.
  for (let e = error as Record<string, unknown> | undefined; e; e = e.cause as typeof e) {
    if (e.code === "23505") {
      const name = e.constraint_name ?? e.constraint;
      return constraint === undefined || name === constraint;
    }
  }
  return false;
}
