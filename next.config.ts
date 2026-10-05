import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Don't generate AGENTS.md / CLAUDE.md in the repo root on `next dev`.
  agentRules: false,
  // PGlite (local dev + e2e only) ships WebAssembly; load it from node_modules, don't bundle it.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
