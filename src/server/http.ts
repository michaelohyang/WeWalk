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
const SESSION_MAX_AGE = 400 * 24 * 60 * 60; // the longest browsers allow

const STATUS: Record<AppErrorCode, number> = {
  invalid: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  gone: 410,
};

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

/** Writes must come from our own pages: a cross-site form or script can't use your cookie. */
function assertSameOrigin(req: NextRequest) {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) {
    throw new AppError("forbidden", "Requests must come from WeWalk itself.");
  }
}

/** Wraps a handler: same-origin check, and turns AppErrors into JSON responses. */
export function route<P>(handler: (ctx: Ctx, params: P) => Promise<Response>) {
  return async (req: NextRequest, context: { params: Promise<P> }): Promise<Response> => {
    try {
      assertSameOrigin(req);
      return await handler({ req, db: getDb(), now: new Date() }, await context.params);
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
    return handler({ ...ctx, session }, params);
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
  let body: unknown;
  try {
    body = await req.json();
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

export function setSessionCookie(res: NextResponse, token: string): NextResponse {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}

export function clearSessionCookie(res: NextResponse): NextResponse {
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

/** The public view of a member. */
export const memberJson = (m: Session["member"]) => ({
  id: m.id,
  name: m.name,
  isOwner: m.isOwner,
});
