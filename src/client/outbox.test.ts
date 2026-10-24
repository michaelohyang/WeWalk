// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TIMEOUT_MS } from "./api";
import { loadDraft, saveDraft } from "./draft";
import { flush, outcome, pending, send, subscribe, waiting } from "./outbox";

const job = (key = "k1") => ({
  key,
  method: "PUT" as const,
  url: `/api/reviews/${key}`,
  body: { a: 1 },
  label: "Your review",
});
const reply = (status: number, body?: unknown) =>
  Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status }));

const signIn = (id: string) => (document.cookie = `ww_member=${id}; path=/`);

beforeEach(() => {
  localStorage.clear();
  signIn("alice");
});
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
    expect(seen).toEqual([0, 1, 0]); // first try in flight, queued, then dropped when rejected
    expect(rejected).toHaveBeenCalledWith(
      expect.objectContaining({ key: "k1" }),
      expect.objectContaining({ status: "rejected" }),
    );
  });

  it("doesn't announce a write as waiting while its first try is still in flight", async () => {
    let finish!: (r: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((r) => (finish = r))),
    );
    const seen: number[] = [];
    const stop = subscribe((jobs) => seen.push(jobs.length));
    const sending = send(job());
    expect(pending()).toHaveLength(1); // safe on the phone already
    expect(waiting()).toEqual([]); // but nothing to tell the user yet
    finish(new Response("{}", { status: 201 }));
    await sending;
    stop();
    expect(seen.every((n) => n === 0)).toBe(true);
    expect(outcome("k1")).toBe("sent");
  });

  it("gives up on a hanging request and keeps the write queued", async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal(
        "fetch",
        vi.fn(
          (_url: string, init: RequestInit) =>
            new Promise<Response>((_, reject) =>
              init.signal!.addEventListener("abort", () => reject(new Error("aborted"))),
            ),
        ),
      );
      const sending = send(job("slow"));
      await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
      expect(await sending).toEqual({ status: "queued" });
      expect(waiting().map((j) => j.key)).toEqual(["slow"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("never sends someone else's queued write; holds it for them", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("offline"))),
    );
    await send(job("alices"));
    signIn("bob"); // Alice signs out, Bob signs in on the same phone
    const fetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() =>
      reply(201, {}),
    );
    vi.stubGlobal("fetch", fetch);
    expect(waiting()).toEqual([]);
    await flush();
    expect(fetch).not.toHaveBeenCalled();
    expect(pending()).toHaveLength(1);

    signIn("alice");
    await flush();
    expect(fetch).toHaveBeenCalledTimes(1);
    const headers = fetch.mock.calls[0]![1].headers as Record<string, string>;
    expect(headers["x-wewalk-member"]).toBe("alice"); // the server double-checks
    expect(pending()).toEqual([]);
  });

  it("holds a write when signed out (401), marked as waiting for a login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => reply(401, { error: { code: "unauthorized", message: "Signed out" } })),
    );
    expect(await send(job())).toEqual({ status: "queued", needsLogin: true });
    expect(pending()).toMatchObject([{ key: "k1", needsLogin: true }]);

    // Logged back in but offline: it's waiting for signal again, not for a login.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
    );
    await flush();
    expect(pending()[0]!.needsLogin).toBeUndefined();
  });

  it("drops a refused write (403) and keeps posting the ones behind it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
    );
    await send(job("k1"));
    await send(job("k2"));

    const fetch = vi.fn((url: string) =>
      url.endsWith("/k1")
        ? reply(403, { error: { code: "forbidden", message: "That's someone else's review." } })
        : reply(201, {}),
    );
    vi.stubGlobal("fetch", fetch);
    const refused: string[] = [];
    await flush((j, result) => refused.push(`${j.key}: ${result.error.message}`));
    expect(refused).toEqual(["k1: That's someone else's review."]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(pending()).toEqual([]);
  });

  it("clears the form draft only once the server has the write", async () => {
    saveDraft("review:x", { hotTake: "keep me" });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => reply(409, { error: { code: "conflict", message: "Already reviewed" } })),
    );
    expect((await send({ ...job(), draft: "review:x" })).status).toBe("rejected");
    expect(loadDraft("review:x")).toEqual({ hotTake: "keep me" });

    vi.stubGlobal(
      "fetch",
      vi.fn(() => reply(201, {})),
    );
    await send({ ...job(), draft: "review:x" });
    expect(loadDraft("review:x")).toBeNull();
  });

  it("keeps drafts per member", () => {
    saveDraft("review:x", { hotTake: "alice's" });
    signIn("bob");
    expect(loadDraft("review:x")).toBeNull();
  });
});
