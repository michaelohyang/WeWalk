import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { photos } from "../db/schema";

/** Remember who uploaded a photo. */
export async function recordPhoto(db: Db, url: string, memberId: string) {
  await db.insert(photos).values({ url, memberId }).onConflictDoNothing();
}

/** Who uploaded a photo (undefined if we have no record of it). */
export async function photoOwner(db: Db, url: string): Promise<string | undefined> {
  const [row] = await db
    .select({ memberId: photos.memberId })
    .from(photos)
    .where(eq(photos.url, url));
  return row?.memberId;
}

export async function forgetPhoto(db: Db, url: string) {
  await db.delete(photos).where(eq(photos.url, url));
}
