import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getDb, type Db } from "./db/client";
import { AppError, type AppErrorCode } from "./errors";
import { authenticate, type Session } from "./services/auth";

/*
 * The plumbing every API route shares: sessions, JSON in and out, errors to status codes,
 * and a same-origin check on writes. Routes stay a few lines each.
 */

export const SESSION_COOKIE = "ww_session";
/**
 * Who this phone is signed in as, readable by our own scripts (it's an id, not a secret). The
 * offline outbox and drafts are kept per member, so one person's queued writes never post
 * under someone else's name on a shared phone.
 */
export const MEMBER_COOKIE = "ww_member";
/** Sent with queued writes: the member who made the write. */
export const MEMBER_HEADER = "x-wewalk-member";
const SESSION_MAX_AGE = 400 * 24 * 60 * 60; // the longest browsers allow

const STATUS: Record<AppErrorCode, number> = {
  invalid: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  gone: 410,
  too_large: 413,
};

/** Our bodies are a review at most (~3 KB). Anything near this is a mistake or abuse. */
const MAX_BODY_BYTES = 64 * 1024;
const TOO_LARGE = "That's too much to send at once.";

export interface Ctx {
  req: NextRequest;
  db: Db;
  now: Date;
}

export interface AuthedCtx extends Ctx {
  session: Session;
}

export function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

export function errorResponse(error: AppError): NextResponse {
  return json(
    {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details && { details: error.details }),
      },
    },
    STATUS[error.code],
  );
}

/**
 * Writes must come from our own pages. Browsers always send Origin on these requests; a missing
 * one means a non-browser client, which we don't need to support. SameSite=Lax cookies and the
 * JSON content type already stop cross-site requests; this is defense in depth.
 */
function assertSameOrigin(req: NextRequest) {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin");
  // Behind Vercel's proxy the public host arrives as x-forwarded-host; either form is ours.
  const forwarded = req.headers.get("x-forwarded-host");
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const ours = [req.nextUrl.origin, forwarded && `${proto}://${forwarded}`];
  if (!origin || !ours.includes(origin)) {
    throw new AppError("forbidden", "Requests must come from WeWalk itself.");
  }
}

/** Wraps a handler: same-origin check, and turns AppErrors into JSON responses. */
export function route<P>(handler: (ctx: Ctx, params: P) => Promise<Response>) {
  return async (req: NextRequest, context: { params: Promise<P> }): Promise<Response> => {
    try {
      assertSameOrigin(req);
      return await handler({ req, db: await getDb(), now: new Date() }, await context.params);
    } catch (e) {
      if (e instanceof AppError) return errorResponse(e);
      console.error(e);
      return json(
        { error: { code: "internal", message: "Something broke on our end. Try again." } },
        500,
      );
    }
  };
}

/** Like `route`, but needs a signed-in phone. */
export function authedRoute<P>(handler: (ctx: AuthedCtx, params: P) => Promise<Response>) {
  return route<P>(async (ctx, params) => {
    const session = await authenticate(ctx.db, ctx.req.cookies.get(SESSION_COOKIE)?.value, ctx.now);
    if (!session)
      throw new AppError("unauthorized", "You're signed out. Open your crew's invite link.");
    const author = ctx.req.headers.get(MEMBER_HEADER);
    if (author && author !== session.member.id) {
      // Written by whoever was signed in before. Not lost: the outbox holds it for them.
      throw new AppError("unauthorized", "This phone is signed in as someone else now.");
    }
    const res = await handler({ ...ctx, session }, params);
    // Keep the readable member cookie in step with the session (it may predate it).
    if (
      res instanceof NextResponse &&
      ctx.req.cookies.get(MEMBER_COOKIE)?.value !== session.member.id
    ) {
      setMemberCookie(res, session.member.id);
    }
    return res;
  });
}

/** Parses and validates a JSON body. Field problems come back as `details.fields`. */
export async function readJson<S extends z.ZodType>(
  req: NextRequest,
  schema: S,
): Promise<z.output<S>> {
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new AppError("invalid", "Send JSON.");
  }
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    throw new AppError("too_large", TOO_LARGE);
  }
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) throw new AppError("too_large", TOO_LARGE);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new AppError("invalid", "That request body isn't valid JSON.");
  }
  return parse(schema, body);
}

export function parse<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const fields = z.flattenError(result.error);
  throw new AppError("invalid", result.error.issues[0]?.message ?? "Check your input.", {
    fields: { ...fields.fieldErrors, ...(fields.formErrors.length && { _: fields.formErrors }) },
  });
}

const COOKIE = {
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: SESSION_MAX_AGE,
} as const;

function setMemberCookie(res: NextResponse, memberId: string) {
  res.cookies.set(MEMBER_COOKIE, memberId, COOKIE);
}

export function setSessionCookie(
  res: NextResponse,
  { token, memberId }: { token: string; memberId: string },
): NextResponse {
  res.cookies.set(SESSION_COOKIE, token, { ...COOKIE, httpOnly: true });
  setMemberCookie(res, memberId);
  return res;
}

export function clearSessionCookie(res: NextResponse): NextResponse {
  res.cookies.delete(SESSION_COOKIE);
  res.cookies.delete(MEMBER_COOKIE);
  return res;
}

/** The public view of a member. */
export const memberJson = (m: Session["member"]) => ({
  id: m.id,
  name: m.name,
  isOwner: m.isOwner,
  hasPassword: m.hasPassword,
});
