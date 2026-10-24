/*
 * Photo sizes. The server reads a photo's size when it's uploaded and puts it in the file name
 * ("…-736x1600…"), so pages can reserve the right space before the image loads (no layout
 * jump) without storing it anywhere else.
 */

export interface PhotoSize {
  width: number;
  height: number;
}

/** A JPEG's pixel size, from its frame header (SOF), or null if it can't be read. */
export function jpegSize(bytes: Uint8Array): PhotoSize | null {
  let i = 2; // after the FF D8 start-of-image marker
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1]!;
    // SOF0–SOF15 carry the size; C4 (huffman tables), C8 and CC (arithmetic) don't.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = (bytes[i + 5]! << 8) | bytes[i + 6]!;
      const width = (bytes[i + 7]! << 8) | bytes[i + 8]!;
      return width && height ? { width, height } : null;
    }
    i += 2 + ((bytes[i + 2]! << 8) | bytes[i + 3]!);
  }
  return null;
}

const SIZE_IN_NAME = /-(\d{1,5})x(\d{1,5})(?:-[A-Za-z0-9]+)?(?:\.jpg)?$/;

/** The size recorded in a photo's address, or null for photos uploaded before that. */
export function photoSize(url: string): PhotoSize | null {
  const m = SIZE_IN_NAME.exec(url);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}
