import { authedRoute, json } from "@/server/http";
import { AppError } from "@/server/errors";
import { MAX_PHOTO_BYTES } from "@/server/photos";
import { uploadPhoto } from "@/server/services/photos";
import { spend } from "@/server/services/rate-limits";

/** Upload a review photo (the raw JPEG as the body) → `{ url }` to put on the review. */
export const POST = authedRoute(async ({ req, db, now, session }) => {
  await spend(db, "photoBurst", session.member.id, now);
  await spend(db, "photoQuota", session.member.id, now);
  if (req.headers.get("content-type")?.toLowerCase() !== "image/jpeg") {
    throw new AppError("invalid", "Photos need to be JPEGs.");
  }
  if (Number(req.headers.get("content-length") ?? 0) > MAX_PHOTO_BYTES) {
    throw new AppError("too_large", "That photo is too big.");
  }
  const url = await uploadPhoto(db, session, new Uint8Array(await req.arrayBuffer()));
  return json({ url }, 201);
});
