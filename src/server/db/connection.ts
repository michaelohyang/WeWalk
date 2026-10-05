/* Shared by the app (client.ts) and the deploy script, so no "server-only" here. */

const isLocal = (url: string) => /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);

/**
 * The app's node-postgres pool (serverless on Vercel, in front of Supabase's pooler):
 * - TLS to anything but this machine. Supabase signs its certificate with its own CA, so the
 *   connection is encrypted without verifying the chain (what `sslmode=require` means).
 * - A small pool per instance, with idle connections closed after 5 s (attachDatabasePool waits
 *   for that before Vercel freezes the instance).
 * - Fail fast: 10 s to connect, 15 s per query, instead of hanging until the platform kills the
 *   request.
 */
export function poolOptions(url: string) {
  return {
    connectionString: url,
    ssl: isLocal(url) ? false : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
    query_timeout: 15_000,
    keepAlive: true,
  };
}

/** postgres-js options for one-off scripts (pnpm db:deploy): one connection, no pipelining. */
export function scriptConnectionOptions(url: string) {
  return {
    ssl: isLocal(url) ? false : ("require" as const),
    max: 1,
    connect_timeout: 10,
    // Not in postgres-js's type definitions, but a supported option (src/index.js). Supabase's
    // transaction pooler can mix up the results of pipelined queries.
    max_pipeline: 1,
  };
}
