/* Shared by the app (client.ts) and the deploy script, so no "server-only" here. */
/**
 * TLS to anything but this machine (Supabase requires it), and a small pool: each serverless
 * instance keeps its own, and the pooler multiplexes them onto real connections.
 */
export function connectionOptions(url: string) {
  const local = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
  return { ssl: local ? false : ("require" as const), max: 5, idle_timeout: 20 };
}
