import { NextResponse, type NextRequest } from "next/server";
import { contentSecurityPolicy, NONCE_HEADER } from "@/server/csp";

/**
 * Sends a Content-Security-Policy with a fresh script nonce on every page. Next.js reads the
 * nonce from the request's CSP header and puts it on its own inline and bundle scripts.
 */
export function proxy(request: NextRequest) {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  const policy = contentSecurityPolicy(nonce, { dev: process.env.NODE_ENV !== "production" });

  const headers = new Headers(request.headers);
  headers.set(NONCE_HEADER, nonce);
  headers.set("Content-Security-Policy", policy);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: API responses, static files and images don't run scripts.
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      // The router's prefetches are RSC payloads, not documents. Browser prefetches (Purpose:
      // prefetch) can become real navigations, so they still get the policy.
      missing: [{ type: "header", key: "next-router-prefetch" }],
    },
  ],
};
