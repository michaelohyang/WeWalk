import { builtinModules } from "node:module";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Layer rules (docs/PLAN.md §5): app → services → repos/domain.
 * - domain: pure TypeScript, imports nothing from other layers, frameworks, drivers or I/O.
 * - ui, client: run in the browser, never touch server code or database drivers.
 * - server: never imports UI, routes or browser code.
 * - app: routes call services, never repos or the database directly.
 *
 * Folder rules use import/no-restricted-paths, which checks the file an import resolves to
 * (alias, relative or barrel alike). Package bans use no-restricted-imports.
 */
const DB_DRIVERS = ["postgres", "postgres/*", "drizzle-orm", "drizzle-orm/*"];
const NODE_BUILTINS = ["node:*", ...builtinModules, ...builtinModules.map((m) => `${m}/*`)];
const banPackages = (files, ...patterns) => ({
  files,
  rules: { "no-restricted-imports": ["error", { patterns }] },
});

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

  {
    files: ["src/**"],
    settings: {
      "import/resolver": { typescript: { project: "./tsconfig.json" }, node: true },
    },
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/domain",
              from: ["./src/server", "./src/ui", "./src/app", "./src/client"],
              message: "domain/ is pure: it must not import other layers.",
            },
            {
              target: ["./src/ui", "./src/client"],
              from: "./src/server",
              message: "Browser code must not import server code.",
            },
            {
              target: "./src/server",
              from: ["./src/ui", "./src/app", "./src/client"],
              message: "server/ must not import UI, routes or browser code.",
            },
            {
              target: "./src/app",
              from: ["./src/server/repos", "./src/server/db"],
              message: "Routes call services, not repos or the database.",
            },
          ],
        },
      ],
    },
  },

  banPackages(
    ["src/domain/**"],
    {
      group: ["next", "next/*", "react", "react/*", "react-dom", "react-dom/*", ...DB_DRIVERS],
      message: "domain/ is pure: no framework or database imports.",
    },
    {
      group: NODE_BUILTINS,
      message: "domain/ is pure: no I/O.",
    },
  ),
  banPackages(
    ["src/ui/**", "src/client/**"],
    {
      group: ["server-only", "react-dom/server"],
      message: "Browser code must not import server code.",
    },
    { group: DB_DRIVERS, message: "Browser code must not import database drivers." },
  ),
  banPackages(
    ["src/app/**"],
    { group: DB_DRIVERS, message: "Routes call services, not the database." },
    {
      // A barrel would re-export repos/db past the path zones above: import modules directly.
      regex: "^@/server(?:/index)?$",
      message: "Import the specific server module (e.g. @/server/services/…), not a barrel.",
    },
  ),
]);
