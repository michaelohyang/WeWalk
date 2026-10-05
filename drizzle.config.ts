import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./src/server/db/migrations",
  // Migrations use the direct connection (port 5432), not the pooler.
  dbCredentials: { url: process.env.DIRECT_URL ?? "" },
  strict: true,
});
