import "server-only";
import { lt, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { rateLimits } from "../db/schema";

/**
 * Counts one request against `key` in the window starting at `windowStart` and returns the new
 * count. One statement, so concurrent requests on other connections never lose a count.
 */
export async function countRequest(db: Db, key: string, windowStart: Date): Promise<number> {
  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });
  return row!.count;
}

/** Deletes windows that started before `cutoff`. */
export async function deleteWindowsBefore(db: Db, cutoff: Date) {
  await db.delete(rateLimits).where(lt(rateLimits.windowStart, cutoff));
}
