import { authedRoute, json } from "@/server/http";
import { AppError } from "@/server/errors";
import { MAX_PHOTO_BYTES, storePhoto } from "@/server/photos";

/** Upload a review photo (the raw JPEG as the body) → `{ url }` to put on the review. */
export const POST = authedRoute(async ({ req }) => {
  if (req.headers.get("content-type")?.toLowerCase() !== "image/jpeg") {
    throw new AppError("invalid", "Photos need to be JPEGs.");
  }
  if (Number(req.headers.get("content-length") ?? 0) > MAX_PHOTO_BYTES) {
    throw new AppError("too_large", "That photo is too big.");
  }
  const url = await storePhoto(new Uint8Array(await req.arrayBuffer()));
  return json({ url }, 201);
});
