/** Map styles, tiles, glyphs and sprites (src/ui/StationMap.tsx). */
const MAP_TILES = "https://tiles.openfreemap.org";
/** Review photos in production (Vercel Blob public store). Local dev serves them from /api/photos. */
const PHOTO_STORE = "https://*.public.blob.vercel-storage.com";

/** Request header the proxy passes the nonce in, for the root layout's theme boot script. */
export const NONCE_HEADER = "x-nonce";

/**
 * The Content-Security-Policy for a page response. Scripts run only with this request's nonce;
 * 'strict-dynamic' lets those scripts load the app's chunks, so no host list is needed.
 */
export function contentSecurityPolicy(nonce: string, { dev }: { dev: boolean }): string {
  const directives = [
    "default-src 'self'",
    // React uses eval in development only, to rebuild server error stacks in the browser.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // React style={} attributes and MapLibre's marker positioning are inline styles.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${MAP_TILES} ${PHOTO_STORE}`,
    "font-src 'self'",
    `connect-src 'self' ${MAP_TILES}`,
    // MapLibre starts its worker from a blob: URL; child-src covers Safari before worker-src.
    "worker-src 'self' blob:",
    "child-src blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (!dev) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}
