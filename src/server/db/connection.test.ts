import { describe, expect, it } from "vitest";
import { poolOptions, scriptConnectionOptions } from "./connection";

const SUPABASE = "postgres://u:p@aws-0-us-east-1.pooler.supabase.com:6543/postgres";

describe("connection options", () => {
  it("uses TLS for remote databases, not for this machine", () => {
    expect(poolOptions(SUPABASE).ssl).toEqual({ rejectUnauthorized: false });
    expect(poolOptions("postgres://postgres@127.0.0.1:55432/postgres").ssl).toBe(false);
    expect(scriptConnectionOptions(SUPABASE).ssl).toBe("require");
    expect(scriptConnectionOptions("postgres://postgres@localhost/postgres").ssl).toBe(false);
  });

  it("fails fast instead of hanging, and closes idle connections quickly", () => {
    expect(poolOptions(SUPABASE)).toMatchObject({
      connectionTimeoutMillis: 10_000,
      query_timeout: 15_000,
      idleTimeoutMillis: 5_000,
    });
    expect(scriptConnectionOptions(SUPABASE)).toMatchObject({ max_pipeline: 1 });
  });
});
