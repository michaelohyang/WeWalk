/* `pnpm db:seed`: upsert the station list into the database at DIRECT_URL. */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../schema";
import { seedStations } from "./seed";

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Set DIRECT_URL (or DATABASE_URL) to seed.");

  const client = postgres(url, { max: 1 });
  try {
    const count = await seedStations(drizzle(client, { schema }));
    console.log(`Seeded ${count} stations.`);
  } finally {
    await client.end();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
