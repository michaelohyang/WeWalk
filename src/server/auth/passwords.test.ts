import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./passwords";

describe("passwords", () => {
  it("stores a salted hash, never the password", async () => {
    const a = await hashPassword("correct horse battery");
    const b = await hashPassword("correct horse battery");
    expect(a).toMatch(/^scrypt\$15\$8\$1\$[\w-]{22}\$[\w-]{43}$/);
    expect(a).not.toContain("correct horse");
    expect(a).not.toBe(b); // different salts
  });

  it("verifies the right password only", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", stored)).toBe(true);
    expect(await verifyPassword("correct horse batterY", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  it("never matches a malformed hash", async () => {
    expect(await verifyPassword("x", "plain-text-password")).toBe(false);
    expect(await verifyPassword("x", "scrypt$15$8$1$$")).toBe(false);
  });
});
