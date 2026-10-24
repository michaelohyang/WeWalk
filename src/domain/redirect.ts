/**
 * Where to send someone after logging in: a path on this site, or "/". Parsed as a URL rather
 * than prefix-checked, because browsers read "/\evil.com" (and tabs or newlines mixed into
 * "//") as a link to another site.
 */
export function safeNext(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/")) return "/";
  const base = "https://wewalk.invalid";
  try {
    const url = new URL(next, base);
    if (url.origin !== base) return "/";
    // The parser tidies the path ("/.//x" becomes "//x"), which a browser would read as a
    // link to another site: refuse anything that comes out protocol-relative.
    const path = url.pathname + url.search + url.hash;
    return path.startsWith("//") ? "/" : path;
  } catch {
    return "/";
  }
}
