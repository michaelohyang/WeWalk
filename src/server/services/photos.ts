import "server-only";
import type { Db } from "../db/client";
import { deletePhoto, storePhoto } from "../photos";
import { forgetPhoto, photoOwner, recordPhoto } from "../repos/photos";
import { photoInUse } from "../repos/reviews";
import type { Session } from "./auth";

/** Store a photo and remember who uploaded it (only they can put it on a review). */
export async function uploadPhoto(db: Db, session: Session, bytes: Uint8Array): Promise<string> {
  const url = await storePhoto(bytes);
  await recordPhoto(db, url, session.member.id);
  return url;
}

/**
 * Deletes a photo that just came off `memberId`'s review, but only if they uploaded it and no
 * review still shows it: before uploads were recorded, one photo could end up on two people's
 * reviews, and the other person's must survive.
 */
export async function releasePhoto(db: Db, url: string, memberId: string): Promise<void> {
  if ((await photoOwner(db, url)) !== memberId) return;
  if (await photoInUse(db, url)) return;
  await deletePhoto(url);
  await forgetPhoto(db, url);
}
