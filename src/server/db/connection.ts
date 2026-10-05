/* Shared by the app (client.ts) and the deploy script, so no "server-only" here. */

/**
 * Connection settings for postgres-js:
 * - TLS to anything but this machine (Supabase requires it).
 * - A small pool: each serverless instance keeps its own, and the pooler multiplexes them.
 * - One query in flight per connection. postgres-js pipelines up to 100 by default, but
 *   Supabase's transaction pooler can hand pipelined queries to different server connections
 *   and mix up their results (rows of one query mapped onto another's columns). Seen in
 *   production as "Cannot read properties of undefined (reading 'toISOString')".
 * - Fail fast instead of hanging when the database can't be reached.
 */
export function connectionOptions(url: string) {
  const local = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
  return {
    ssl: local ? false : ("require" as const),
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    // Not in postgres-js's type definitions, but a supported option (src/index.js).
    max_pipeline: 1,
  };
}
