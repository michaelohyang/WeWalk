import { authedRoute } from "@/server/http";
import { AppError } from "@/server/errors";
import { memoryPhoto } from "@/server/photos";
import { NextResponse } from "next/server";

/** Local dev and tests only: photos kept in memory (deployed photos are served by Vercel Blob). */
export const GET = authedRoute<{ id: string }>(async (_ctx, params) => {
  const bytes = memoryPhoto(params.id);
  if (!bytes) throw new AppError("not_found", "No such photo.");
  return new NextResponse(Buffer.from(bytes), {
    headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=86400" },
  });
});
