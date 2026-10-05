import { renameInputSchema } from "@/domain/schemas";
import { authedRoute, json, memberJson, readJson } from "@/server/http";
import { listDevices, rename } from "@/server/services/auth";

/** Who am I, and which phones am I signed in on. */
export const GET = authedRoute(async ({ db, session }) =>
  json({ member: memberJson(session.member), devices: await listDevices(db, session) }),
);

/** Rename yourself: `{ name }`. */
export const PATCH = authedRoute(async ({ req, db, session }) => {
  const { name } = await readJson(req, renameInputSchema);
  return json({ member: memberJson(await rename(db, session, name)) });
});
