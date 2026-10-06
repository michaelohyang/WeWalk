/*
 * Review photos: shrink on the phone, then upload. A 12-megapixel camera photo is ~4 MB; a
 * 1600px JPEG at 80% is a few hundred KB, plenty for a phone screen and quick on lobby wifi.
 */

const MAX_SIDE = 1600;
const QUALITY = 0.8;
const UPLOAD_TIMEOUT_MS = 30_000;

/** Any image the browser can read (camera JPEG, HEIC on iPhone, PNG) → a smaller JPEG. */
export async function shrinkPhoto(file: File): Promise<Blob> {
  // Applies the camera's rotation, so portrait photos stay upright.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/jpeg", QUALITY));
  if (!blob) throw new Error("Couldn't read that photo.");
  return blob;
}

export type UploadResult = { ok: true; url: string } | { ok: false; message: string };

/** Upload a JPEG. Needs a connection: unlike reviews, photos aren't queued offline. */
export async function uploadPhoto(jpeg: Blob): Promise<UploadResult> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), UPLOAD_TIMEOUT_MS);
  try {
    const res = await fetch("/api/photos", {
      method: "POST",
      headers: { "content-type": "image/jpeg" },
      body: jpeg,
      signal: abort.signal,
    });
    const json = (await res.json().catch(() => null)) as {
      url?: string;
      error?: { message: string };
    } | null;
    if (res.ok && json?.url) return { ok: true, url: json.url };
    return { ok: false, message: json?.error?.message ?? "That photo didn't upload. Try again." };
  } catch {
    return {
      ok: false,
      message: "Photos need a connection. Your review can still post without one.",
    };
  } finally {
    clearTimeout(timer);
  }
}
