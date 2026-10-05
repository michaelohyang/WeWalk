import { describe, expect, it } from "vitest";
import { connectionOptions } from "./connection";

describe("connectionOptions", () => {
  it("requires TLS for remote databases, not for this machine", () => {
    expect(
      connectionOptions("postgres://u:p@aws-0-us-east-1.pooler.supabase.com:6543/postgres").ssl,
    ).toBe("require");
    expect(connectionOptions("postgres://postgres@127.0.0.1:55432/postgres").ssl).toBe(false);
    expect(connectionOptions("postgres://postgres@localhost/postgres").ssl).toBe(false);
  });
});
