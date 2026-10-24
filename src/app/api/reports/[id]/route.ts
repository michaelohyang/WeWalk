import { NextResponse } from "next/server";
import { handleReportInputSchema, idSchema } from "@/domain/schemas";
import { crewChanged } from "@/server/crew-cache";
import { authedRoute, parse, readJson } from "@/server/http";
import { handleReport } from "@/server/services/moderation";

/** Owner or admin: deal with a report, `{ action: "hide" | "remove" | "dismiss" }`. */
export const POST = authedRoute<{ id: string }>(async ({ req, db, now, session }, params) => {
  const { action } = await readJson(req, handleReportInputSchema);
  await handleReport(db, session, parse(idSchema, params.id), action, now);
  crewChanged();
  return new NextResponse(null, { status: 204 });
});
