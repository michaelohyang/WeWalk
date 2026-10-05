/*
 * `pnpm smoke https://your-app.vercel.app`: a read-only check of a deployed WeWalk. It writes
 * nothing and never needs the invite code, so it's safe to run against production any time.
 */

const base = (process.argv[2] ?? process.env.SMOKE_URL ?? "").replace(/\/$/, "");
if (!/^https?:\/\//.test(base)) {
  console.error("Usage: pnpm smoke https://your-app.vercel.app");
  process.exit(2);
}

type Check = { name: string; run: () => Promise<string | null> }; // null = pass, else why not

const get = (path: string, init?: RequestInit) =>
  fetch(`${base}${path}`, { redirect: "manual", ...init });

const checks: Check[] = [
  {
    name: "signed-out home shows the members-only gate",
    run: async () => {
      const res = await get("/");
      const html = await res.text();
      if (res.status !== 200) return `status ${res.status}`;
      return html.includes("Members only.") ? null : "no members-only gate in the page";
    },
  },
  {
    name: "security headers are set",
    run: async () => {
      const h = (await get("/")).headers;
      const want = {
        "referrer-policy": "no-referrer",
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
        "x-robots-tag": "noindex, nofollow",
      };
      const bad = Object.entries(want).filter(([k, v]) => h.get(k) !== v);
      return bad.length ? `missing or wrong: ${bad.map(([k]) => k).join(", ")}` : null;
    },
  },
  {
    name: "the API needs a session",
    run: async () => {
      const res = await get("/api/me");
      return res.status === 401 ? null : `GET /api/me gave ${res.status}, expected 401`;
    },
  },
  {
    name: "cross-site writes are refused",
    run: async () => {
      const res = await get("/api/join", {
        method: "POST",
        headers: { origin: "https://evil.example", "content-type": "application/json" },
        body: JSON.stringify({ code: "x", name: "x" }),
      });
      return res.status === 403 ? null : `got ${res.status}, expected 403`;
    },
  },
  {
    name: "a wrong invite code is refused (and the database answers)",
    run: async () => {
      const res = await get("/api/join", {
        method: "POST",
        headers: { origin: base, "content-type": "application/json" },
        body: JSON.stringify({ code: "definitely-not-the-crew-code", name: "Smoke Test" }),
      });
      return res.status === 401 ? null : `got ${res.status}, expected 401`;
    },
  },
  {
    name: "a bad invite link explains itself",
    run: async () => {
      const html = await (await get("/j/not-the-code")).text();
      return html.includes("That invite link doesn't work.") ? null : "no bad-link message";
    },
  },
  {
    name: "the link-preview card is served",
    run: async () => {
      const html = await (await get("/j/not-the-code")).text();
      const image = /<meta property="og:image" content="([^"]+)"/.exec(html)?.[1];
      if (!image) return "no og:image tag";
      const url = new URL(image);
      if (url.origin !== new URL(base).origin) {
        console.warn(`  note: og:image points at ${url.origin} (fine if that's your main domain)`);
      }
      const res = await get(url.pathname + url.search);
      const type = res.headers.get("content-type") ?? "";
      return res.ok && type.startsWith("image/png") ? null : `${image}: ${res.status} ${type}`;
    },
  },
  {
    name: "robots.txt keeps crawlers out",
    run: async () => {
      const text = await (await get("/robots.txt")).text();
      return /Disallow: \/\s*$/m.test(text) ? null : "robots.txt doesn't disallow /";
    },
  },
];

async function main() {
  let failed = 0;
  for (const c of checks) {
    let why: string | null;
    try {
      why = await c.run();
    } catch (e) {
      why = e instanceof Error ? e.message : String(e);
    }
    console.log(`${why ? "✗" : "✓"} ${c.name}${why ? `: ${why}` : ""}`);
    if (why) failed++;
  }
  console.log(failed ? `\n${failed} check(s) failed.` : `\nAll ${checks.length} checks passed.`);
  process.exit(failed ? 1 : 0);
}

void main();
