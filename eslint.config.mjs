import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Layer rules (docs/PLAN.md §5): app → services → repos/domain.
 * - domain: pure TypeScript, imports nothing from other layers or frameworks.
 * - ui, client: run in the browser, never touch server code or database drivers.
 * - server: never imports UI, routes or browser code.
 * - app: routes call services, never repos or the database directly.
 */
/** A folder itself (barrel/index imports) and anything inside it, via alias or relative path. */
const dir = (...names) => names.flatMap((n) => [`**/${n}`, `**/${n}/**`]);

const layer = (files, patterns) => ({
  files,
  rules: { "no-restricted-imports": ["error", { patterns }] },
});

const DB_DRIVERS = ["postgres", "postgres/*", "drizzle-orm", "drizzle-orm/*"];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "next-env.d.ts",
    "prototype/**",
    "playwright-report/**",
    "test-results/**",
  ]),

  layer(
    ["src/domain/**"],
    [
      {
        group: dir("server", "ui", "app", "client"),
        message: "domain/ is pure: it must not import other layers.",
      },
      {
        group: ["next", "next/*", "react", "react/*", "react-dom", "react-dom/*", ...DB_DRIVERS],
        message: "domain/ is pure: no framework or database imports.",
      },
      {
        group: ["node:*", "fs", "fs/*", "path", "child_process", "http", "https", "net"],
        message: "domain/ is pure: no I/O.",
      },
    ],
  ),
  layer(
    ["src/ui/**", "src/client/**"],
    [
      {
        group: [...dir("server"), "server-only"],
        message: "Browser code must not import server code.",
      },
      { group: DB_DRIVERS, message: "Browser code must not import database drivers." },
    ],
  ),
  layer(
    ["src/server/**"],
    [
      {
        group: dir("ui", "app", "client"),
        message: "server/ must not import UI, routes or browser code.",
      },
    ],
  ),
  layer(
    ["src/app/**"],
    [
      {
        group: dir("server/repos", "server/db"),
        message: "Routes call services, not repos or the database.",
      },
      { group: DB_DRIVERS, message: "Routes call services, not the database." },
    ],
  ),
]);
