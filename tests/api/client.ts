import { NextRequest } from "next/server";

/* A tiny HTTP client for calling route handlers directly, with a per-phone cookie jar. */

const ORIGIN = "http://wewalk.test";
type Handler = (
  req: NextRequest,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- any route's params shape
  ctx: { params: Promise<any> },
) => Promise<Response>;

export interface Reply {
  status: number;
  body: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- test convenience
  setCookie: string | null;
}

export class Phone {
  private jar = new Map<string, string>();

  /** The Cookie header this phone sends. Assigning replaces the whole jar (e.g. "" to clear). */
  get cookie(): string {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  set cookie(value: string) {
    this.jar = new Map(
      value
        .split(";")
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => [p.slice(0, p.indexOf("=")), p.slice(p.indexOf("=") + 1)]),
    );
  }

  async call(
    handler: Handler,
    method: string,
    path: string,
    opts: {
      body?: unknown;
      params?: Record<string, string>;
      headers?: Record<string, string>;
      /** A body sent as is (text, or bytes for a photo upload). */
      raw?: string | Uint8Array<ArrayBuffer>;
    } = {},
  ): Promise<Reply> {
    const headers: Record<string, string> = { origin: ORIGIN, ...opts.headers };
    if (this.cookie) headers.cookie = this.cookie;
    let body: string | Uint8Array<ArrayBuffer> | undefined;
    if (opts.raw !== undefined) body = opts.raw;
    else if (opts.body !== undefined) {
      body = JSON.stringify(opts.body);
      headers["content-type"] ??= "application/json";
    }
    const res = await handler(new NextRequest(`${ORIGIN}${path}`, { method, headers, body }), {
      params: Promise.resolve(opts.params ?? {}),
    });
    const setCookie = res.headers.get("set-cookie");
    for (const line of res.headers.getSetCookie()) {
      const pair = line.split(";")[0]!;
      const name = pair.slice(0, pair.indexOf("="));
      const value = pair.slice(pair.indexOf("=") + 1);
      if (value && !/max-age=0|expires=thu, 01 jan 1970/i.test(line)) this.jar.set(name, value);
      else this.jar.delete(name);
    }
    // JSON for API replies; the raw bytes for anything else (a photo).
    if (!res.headers.get("content-type")?.includes("json") && res.ok) {
      return { status: res.status, body: new Uint8Array(await res.arrayBuffer()), setCookie };
    }
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, setCookie };
  }
}
