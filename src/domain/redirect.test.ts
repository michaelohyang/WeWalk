import { describe, expect, it } from "vitest";
import { safeNext } from "./redirect";

describe("safeNext", () => {
  it("keeps paths on this site, with their query and hash", () => {
    expect(safeNext("/stations/dock-72")).toBe("/stations/dock-72");
    expect(safeNext("/ranks?by=coffee&area=downtown#top")).toBe(
      "/ranks?by=coffee&area=downtown#top",
    );
  });

  it.each([
    ["//evil.com", "protocol-relative"],
    ["/\\evil.com", "backslash (browsers treat it as a slash)"],
    ["/\t/evil.com", "tab inside //"],
    ["/\n/evil.com", "newline inside //"],
    ["https://evil.com", "absolute URL"],
    ["javascript:alert(1)", "script URL"],
    ["evil.com", "no leading slash"],
    ["/.//evil.com", "dot segment collapsing to //"],
    ["/./\\evil.com", "dot segment then backslash"],
    ["/..//evil.com", "parent segment collapsing to //"],
    ["/a/..//evil.com", "parent segment after a folder"],
    ["/%2e//evil.com", "encoded dot segment"],
  ])("sends %j to / (%s)", (input) => {
    expect(safeNext(input)).toBe("/");
  });

  it("falls back to / for anything that isn't a string", () => {
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext(["/a", "/b"])).toBe("/");
  });
});
