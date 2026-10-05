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
  cookie = "";

  async call(
    handler: Handler,
    method: string,
    path: string,
    opts: {
      body?: unknown;
      params?: Record<string, string>;
      headers?: Record<string, string>;
      raw?: string;
    } = {},
  ): Promise<Reply> {
    const headers: Record<string, string> = { origin: ORIGIN, ...opts.headers };
    if (this.cookie) headers.cookie = this.cookie;
    let body: string | undefined;
    if (opts.raw !== undefined) body = opts.raw;
    else if (opts.body !== undefined) {
      body = JSON.stringify(opts.body);
      headers["content-type"] ??= "application/json";
    }
    const res = await handler(new NextRequest(`${ORIGIN}${path}`, { method, headers, body }), {
      params: Promise.resolve(opts.params ?? {}),
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      const [pair] = setCookie.split(";");
      this.cookie = pair!.endsWith("=") ? "" : pair!;
    }
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, setCookie };
  }
}
