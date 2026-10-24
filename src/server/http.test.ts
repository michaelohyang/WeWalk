import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { clientIp } from "./http";

const request = (headers: Record<string, string>) =>
  new NextRequest("http://wewalk.test/api/signup", { headers });

describe("clientIp", () => {
  it("prefers x-real-ip, then the first x-forwarded-for entry, then 'unknown'", () => {
    expect(clientIp(request({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "1.1.1.1" }))).toBe(
      "203.0.113.7",
    );
    expect(clientIp(request({ "x-forwarded-for": " 198.51.100.2 , 10.0.0.1" }))).toBe(
      "198.51.100.2",
    );
    expect(clientIp(request({}))).toBe("unknown");
  });
});
