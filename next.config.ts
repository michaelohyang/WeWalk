import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Don't generate AGENTS.md / CLAUDE.md in the repo root on `next dev`.
  agentRules: false,
};

export default nextConfig;
