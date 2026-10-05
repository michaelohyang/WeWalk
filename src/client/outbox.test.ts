// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flush, pending, send, subscribe } from "./outbox";

const job = (key = "k1") => ({
  key,
  method: "PUT" as const,
  url: `/api/reviews/${key}`,
  body: { a: 1 },
  label: "Your review",
});
const reply = (status: number, body?: unknown) =>
  Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status }));

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("outbox", () => {
  it("sends and forgets on success", async () => {
    const fetch = vi.fn(() => reply(201, { review: { id: "k1" } }));
    vi.stubGlobal("fetch", fetch);
    expect(await send(job())).toEqual({ status: "sent", data: { review: { id: "k1" } } });
    expect(pending()).toEqual([]);
    expect(fetch).toHaveBeenCalledWith(
      "/api/reviews/k1",
      expect.objectContaining({ method: "PUT", body: '{"a":1}' }),
    );
  });

  it("keeps the write when there's no signal, and posts it once later", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
    );
    expect(await send(job())).toEqual({ status: "queued" });
    expect(pending()).toHaveLength(1);

    const fetch = vi.fn(() => reply(201, {}));
    vi.stubGlobal("fetch", fetch);
    await Promise.all([flush(), flush()]); // concurrent flushes share one run
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(pending()).toEqual([]);
  });

  it("keeps the write on a server hiccup (5xx, 429)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => reply(503)),
    );
    expect((await send(job())).status).toBe("queued");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => reply(429)),
    );
    await flush();
    expect(pending()).toHaveLength(1);
  });

  it("drops a rejected write and reports why", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        reply(409, {
          error: { code: "conflict", message: "Already reviewed", details: { existingId: "x" } },
        }),
      ),
    );
    const result = await send(job());
    expect(result).toEqual({
      status: "rejected",
      httpStatus: 409,
      error: { code: "conflict", message: "Already reviewed", details: { existingId: "x" } },
    });
    expect(pending()).toEqual([]);
  });

  it("re-sending the same key replaces the queued copy instead of duplicating it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("offline"))),
    );
    await send(job("a"));
    await send({ ...job("a"), body: { a: 2 } });
    await send(job("b"));
    expect(pending().map((j) => [j.key, j.body])).toEqual([
      ["a", { a: 2 }],
      ["b", { a: 1 }],
    ]);
  });

  it("stops flushing at the first write that still can't go, keeping order", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("offline"))),
    );
    await send(job("a"));
    await send(job("b"));
    const fetch = vi.fn(() => Promise.reject(new TypeError("offline")));
    vi.stubGlobal("fetch", fetch);
    await flush();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(pending().map((j) => j.key)).toEqual(["a", "b"]);
  });

  it("tells subscribers about changes, and rejected flushes to the caller", async () => {
    const seen: number[] = [];
    const off = subscribe((jobs) => seen.push(jobs.length));
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("offline"))),
    );
    await send(job());
    vi.stubGlobal(
      "fetch",
      vi.fn(() => reply(400, { error: { code: "invalid", message: "nope" } })),
    );
    const rejected = vi.fn();
    await flush(rejected);
    off();
    expect(seen).toEqual([1, 0]); // queued, then dropped when rejected
    expect(rejected).toHaveBeenCalledWith(
      expect.objectContaining({ key: "k1" }),
      expect.objectContaining({ status: "rejected" }),
    );
  });
});
