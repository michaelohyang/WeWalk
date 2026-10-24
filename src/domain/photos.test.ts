import { describe, expect, it } from "vitest";
import { jpegSize, photoSize } from "./photos";

/** A minimal JPEG: SOI, an APP0 segment, then a baseline SOF0 with the given size. */
function jpeg(width: number, height: number, sof = 0xc0): Uint8Array {
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xe0,
    0x00,
    0x06,
    0x4a,
    0x46,
    0x49,
    0x46, // APP0, length 6
    0xff,
    sof,
    0x00,
    0x0b,
    0x08,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    0x01,
    0x01,
    0x11,
    0x00,
  ]);
}

describe("jpegSize", () => {
  it("reads width and height from the frame header", () => {
    expect(jpegSize(jpeg(736, 1600))).toEqual({ width: 736, height: 1600 });
    expect(jpegSize(jpeg(1600, 1200, 0xc2))).toEqual({ width: 1600, height: 1200 }); // progressive
  });

  it("gives up on anything that isn't a readable JPEG", () => {
    expect(jpegSize(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(jpegSize(jpeg(736, 1600).slice(0, 14))).toBeNull(); // cut off before the frame
    expect(jpegSize(jpeg(0, 1600))).toBeNull();
  });
});

describe("photoSize", () => {
  it("reads the size stored in a photo's address", () => {
    expect(
      photoSize("https://abc.public.blob.vercel-storage.com/photos/0f8fad5b-736x1600-x1Yz.jpg"),
    ).toEqual({ width: 736, height: 1600 });
    expect(photoSize("/api/photos/0f8fad5b-d9cb-469f-a165-70867728950e-1600x1200")).toEqual({
      width: 1600,
      height: 1200,
    });
  });

  it("is null for photos uploaded before sizes were recorded", () => {
    expect(photoSize("/api/photos/0f8fad5b-d9cb-469f-a165-70867728950e")).toBeNull();
    expect(
      photoSize("https://abc.public.blob.vercel-storage.com/photos/0f8fad5b-x1Yz.jpg"),
    ).toBeNull();
  });
});
