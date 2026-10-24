import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

/*
 * The backfill runs with tsx, outside Next.js and without the test stubs (vitest swaps
 * "server-only" for an empty module). Run the real script, with no credentials, and check it
 * loads and asks for them instead of crashing on import.
 */
describe("pnpm photos:backfill", () => {
  it("loads outside Next.js and explains what it needs", () => {
    const env = { ...process.env };
    delete env.DIRECT_URL;
    delete env.DATABASE_URL;
    const run = spawnSync(
      "node_modules/.bin/tsx",
      ["--env-file-if-exists=.env.test-missing", "scripts/backfill-photo-sizes.ts"],
      { encoding: "utf8", env, timeout: 30_000 },
    );
    expect(run.stderr).not.toMatch(/server-only|Client Component/);
    expect(run.stderr).toMatch(/needs DIRECT_URL or DATABASE_URL/);
    expect(run.status).toBe(1);
  });
});
