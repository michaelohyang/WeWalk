import "server-only";
import { del, put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { AppError } from "./errors";

/*
 * Review photos. The phone shrinks a photo to a JPEG of a few hundred KB before uploading, so
 * the server takes JPEG only. Photos live in Vercel Blob once a Blob store is connected to the
 * project: Vercel then sets BLOB_STORE_ID and the deployment signs in on its own (OIDC); older
 * stores set BLOB_READ_WRITE_TOKEN instead. @vercel/blob handles either. Without a store, local
 * dev and tests keep photos in memory and serve them from /api/photos/:id; on Vercel, uploads
 * are refused instead.
 *
 * Blob URLs are public but unguessable (a random suffix), and only reachable from a review.
 */

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

const blobConfigured = () => !!(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
/** Never on Vercel (where VERCEL=1): a serverless function's memory doesn't last. */
const inMemoryAllowed = () => process.env.VERCEL !== "1";

/** Local dev and tests only. */
const memory = new Map<string, Uint8Array>();
const LOCAL_URL = /^\/api\/photos\/([0-9a-f-]{36})$/;
/** Where Vercel Blob serves public files. */
const BLOB_URL = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/photos\/[\w.-]+\.jpg$/i;

/** Whether a URL is a photo this app stored (so a review can't point at any image on the web). */
export const isOurPhoto = (url: string) => LOCAL_URL.test(url) || BLOB_URL.test(url);

/** JPEG files start with FF D8 FF. */
const isJpeg = (b: Uint8Array) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

export async function storePhoto(bytes: Uint8Array): Promise<string> {
  if (!bytes.length) throw new AppError("invalid", "That photo is empty.");
  if (bytes.length > MAX_PHOTO_BYTES) throw new AppError("too_large", "That photo is too big.");
  if (!isJpeg(bytes)) throw new AppError("invalid", "Photos need to be JPEGs.");
  if (blobConfigured()) {
    const blob = await put(`photos/${randomUUID()}.jpg`, Buffer.from(bytes), {
      access: "public",
      contentType: "image/jpeg",
      addRandomSuffix: true,
    });
    return blob.url;
  }
  if (!inMemoryAllowed()) throw new AppError("unavailable", "Photos aren't set up yet.");
  const id = randomUUID();
  memory.set(id, bytes);
  return `/api/photos/${id}`;
}

/** Local dev and tests: a photo kept in memory. */
export function memoryPhoto(id: string): Uint8Array | undefined {
  return memory.get(id);
}

/** Best effort: a photo nobody points at any more. */
export async function deletePhoto(url: string): Promise<void> {
  const local = LOCAL_URL.exec(url);
  if (local) {
    memory.delete(local[1]!);
    return;
  }
  if (blobConfigured() && BLOB_URL.test(url)) {
    try {
      await del(url);
    } catch (e) {
      console.error("Couldn't delete a photo", e);
    }
  }
}
