import { describe, expect, it } from "vitest";
import { contentSecurityPolicy } from "./csp";

const directive = (policy: string, name: string) =>
  policy.split("; ").find((d) => d === name || d.startsWith(`${name} `));

describe("contentSecurityPolicy", () => {
  it("allows only scripts carrying this request's nonce", () => {
    const policy = contentSecurityPolicy("abc123", { dev: false });
    expect(directive(policy, "script-src")).toBe(
      "script-src 'self' 'nonce-abc123' 'strict-dynamic'",
    );
    expect(policy).not.toContain("unsafe-eval");
  });

  it("allows eval only in development, and upgrades to https only in production", () => {
    const dev = contentSecurityPolicy("n", { dev: true });
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(directive(dev, "upgrade-insecure-requests")).toBeUndefined();
    expect(directive(contentSecurityPolicy("n", { dev: false }), "upgrade-insecure-requests")).toBe(
      "upgrade-insecure-requests",
    );
  });

  it("lets the map and photos load, and nothing frame or embed the app", () => {
    const policy = contentSecurityPolicy("n", { dev: false });
    expect(directive(policy, "connect-src")).toContain("https://tiles.openfreemap.org");
    expect(directive(policy, "img-src")).toContain("https://*.public.blob.vercel-storage.com");
    expect(directive(policy, "worker-src")).toContain("blob:");
    expect(directive(policy, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(policy, "object-src")).toBe("object-src 'none'");
  });
});
