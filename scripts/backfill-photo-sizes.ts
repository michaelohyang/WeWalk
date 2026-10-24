/*
 * `pnpm photos:backfill` (dry run) / `pnpm photos:backfill --apply`
 *
 * Gives review photos uploaded before photo sizes were kept a size-carrying address, so their
 * cards stop jumping as they load. Needs DATABASE_URL (or DIRECT_URL) and Blob credentials
 * (BLOB_READ_WRITE_TOKEN): `vercel env pull .env.local` gets both. Run it once, after the
 * deploy that records sizes on upload. Old photo files are left in place.
 */
import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { scriptConnectionOptions } from "../src/server/db/connection";
import * as schema from "../src/server/db/schema";
import { backfillPhotoSizes } from "../src/server/photo-backfill";

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("photos:backfill needs DIRECT_URL or DATABASE_URL.");
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) {
    throw new Error("photos:backfill needs Blob credentials: run `vercel env pull .env.local`.");
  }
  const apply = process.argv.includes("--apply");
  const client = postgres(url, { ...scriptConnectionOptions(url), onnotice: () => {} });
  try {
    const db = drizzle(client, { schema });
    const result = await backfillPhotoSizes(db, {
      apply,
      log: (line) => console.log(line),
      async fetchBytes(photoUrl) {
        const res = await fetch(photoUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return new Uint8Array(await res.arrayBuffer());
      },
      async store(bytes, size) {
        const blob = await put(
          `photos/${randomUUID()}-${size.width}x${size.height}.jpg`,
          Buffer.from(bytes),
          {
            access: "public",
            contentType: "image/jpeg",
            addRandomSuffix: true,
          },
        );
        return blob.url;
      },
    });
    console.log(
      `photos:backfill: ${result.checked} photos checked, ${result.updated} ${apply ? "updated" : "would be updated"}, ${result.skipped} skipped.` +
        (apply ? "" : " Run again with --apply to make the changes."),
    );
  } finally {
    await client.end();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
