import { describe, expect, it } from "vitest";
import { isOurPhoto } from "./photos";

describe("isOurPhoto", () => {
  it("accepts photos stored by this app, and nothing else", () => {
    expect(isOurPhoto("/api/photos/0f8fad5b-d9cb-469f-a165-70867728950e")).toBe(true);
    expect(
      isOurPhoto("https://abc123.public.blob.vercel-storage.com/photos/0f8fad5b-x1Yz.jpg"),
    ).toBe(true);
    expect(isOurPhoto("https://example.com/photos/x.jpg")).toBe(false);
    expect(isOurPhoto("https://abc.public.blob.vercel-storage.com.evil.com/photos/x.jpg")).toBe(
      false,
    );
    expect(isOurPhoto("/api/photos/../me")).toBe(false);
    expect(isOurPhoto("javascript:alert(1)")).toBe(false);
  });
});
