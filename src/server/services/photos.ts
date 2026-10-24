import "server-only";
import type { Db } from "../db/client";
import { storePhoto } from "../photos";
import { recordPhoto } from "../repos/photos";
import type { Session } from "./auth";

/** Store a photo and remember who uploaded it (only they can put it on a review). */
export async function uploadPhoto(db: Db, session: Session, bytes: Uint8Array): Promise<string> {
  const url = await storePhoto(bytes);
  await recordPhoto(db, url, session.member.id);
  return url;
}
