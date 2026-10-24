import { and, eq, isNotNull } from "drizzle-orm";
import { jpegSize, photoSize, type PhotoSize } from "@/domain/photos";
import type { Db } from "./db/client";
import { reviews } from "./db/schema";

/*
 * Run by scripts/backfill-photo-sizes.ts with tsx, outside Next.js, so no "server-only" guard
 * here (it throws outside a React Server Component). ESLint already keeps ui/ and client/ out.
 *
 * One-time: give photos uploaded before sizes were kept a size-carrying address (see
 * domain/photos.ts), so their cards stop jumping as they load. Each photo is downloaded,
 * measured, stored again under a sized name, and its review is pointed at the new copy.
 * The old file is left in place: cached pages may still show it until the cache refreshes.
 */

export interface BackfillDeps {
  fetchBytes: (url: string) => Promise<Uint8Array>;
  /** Stores a JPEG under a name carrying its size; returns its new address. */
  store: (bytes: Uint8Array, size: PhotoSize) => Promise<string>;
  /** false: only report what would change. */
  apply: boolean;
  log: (line: string) => void;
}

export async function backfillPhotoSizes(db: Db, deps: BackfillDeps) {
  const rows = await db
    .select({ id: reviews.id, photoUrl: reviews.photoUrl })
    .from(reviews)
    .where(isNotNull(reviews.photoUrl));
  const todo = rows.filter((r) => !photoSize(r.photoUrl!));
  const result = { checked: rows.length, updated: 0, skipped: 0 };
  for (const r of todo) {
    try {
      const bytes = await deps.fetchBytes(r.photoUrl!);
      const size = jpegSize(bytes);
      if (!size) {
        deps.log(`review ${r.id}: couldn't read the photo's size, skipped`);
        result.skipped++;
        continue;
      }
      if (deps.apply) {
        const url = await deps.store(bytes, size);
        // Only if the review still points at the same photo (it may have been edited meanwhile).
        await db
          .update(reviews)
          .set({ photoUrl: url })
          .where(and(eq(reviews.id, r.id), eq(reviews.photoUrl, r.photoUrl!)));
      }
      deps.log(`review ${r.id}: ${size.width}x${size.height}${deps.apply ? "" : " (dry run)"}`);
      result.updated++;
    } catch (e) {
      deps.log(`review ${r.id}: failed (${e instanceof Error ? e.message : String(e)}), skipped`);
      result.skipped++;
    }
  }
  return result;
}
