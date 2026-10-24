import { NextResponse } from "next/server";
import { cityDate } from "@/domain/dates";
import { authedRoute } from "@/server/http";
import { exportData } from "@/server/services/account";

/** "Dana K." → "dana-k", for a filename that's safe everywhere. */
const fileSafe = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "member";

/** A copy of everything that's yours, as a JSON file download. */
export const GET = authedRoute(async ({ db, now, session }) => {
  const data = await exportData(db, session, now);
  const filename = `wewalk-${fileSafe(session.member.name)}-${cityDate(now)}.json`;
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
});
