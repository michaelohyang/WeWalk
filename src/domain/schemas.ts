import { z } from "zod";
import { CATEGORY_KEYS, type CategoryKey } from "./categories";
import { isIsoDate } from "./dates";
import { displayNameProblem, normalizeDisplayName } from "./names";
import { TAGS } from "./tags";

/**
 * Request shapes shared by the API (validation) and, later, the client (forms).
 * Server-only rules that need the clock or the database (e.g. visit date not in the future,
 * name already taken) live in the services.
 */

export const stationIdSchema = z
  .string("Pick a building.")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "That building isn't on the map.");
export const idSchema = z.uuid("That id isn't valid.");
export const isoDateSchema = z.string("Pick a date.").refine(isIsoDate, "That date isn't valid.");

const score = z
  .int("Scores go from 1 to 5.")
  .min(1, "Scores go from 1 to 5.")
  .max(5, "Scores go from 1 to 5.");
export const scoresSchema = z
  .object(
    Object.fromEntries(CATEGORY_KEYS.map((k) => [k, score.optional()])) as Record<
      CategoryKey,
      z.ZodOptional<typeof score>
    >,
  )
  .strict()
  .refine((s) => Object.values(s).some((v) => v !== undefined), "Rate at least one thing.");

export const displayNameSchema = z
  .string()
  .transform(normalizeDisplayName)
  .superRefine((name, ctx) => {
    const problem = displayNameProblem(name);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  });

/**
 * Free text: control characters are removed (Postgres rejects NUL, and the rest only cause
 * trouble). `multiline` keeps line breaks and tabs; single-line text turns them into spaces.
 */
const text = (max: number, { multiline = false } = {}) =>
  z
    .string("That should be text.")
    .transform((s) =>
      (multiline ? s.replace(/\r\n?/g, "\n") : s.replace(/[\t\r\n]+/g, " "))
        .replace(multiline ? /[\u0000-\u0008\u000b-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g, "")
        .trim(),
    )
    .pipe(z.string().max(max, `Keep it under ${max} characters.`))
    .default("");

export const reviewInputSchema = z
  .object({
    stationId: stationIdSchema,
    visitedOn: isoDateSchema,
    scores: scoresSchema,
    hotTake: text(120),
    body: text(1200, { multiline: true }),
    tags: z
      .array(z.enum(TAGS, "That tag isn't on the list."))
      .max(TAGS.length)
      .default([])
      .transform((ts) => [...new Set(ts)]),
  })
  .strict();
export type ReviewInput = z.infer<typeof reviewInputSchema>;

export const checkinInputSchema = z
  .object({
    stationId: stationIdSchema,
    visitedOn: isoDateSchema,
    note: text(400, { multiline: true }),
  })
  .strict();
export type CheckinInput = z.infer<typeof checkinInputSchema>;

export const joinInputSchema = z
  .object({ code: z.string().min(1).max(200), name: displayNameSchema })
  .strict();
export type JoinInput = z.infer<typeof joinInputSchema>;

export const renameInputSchema = z.object({ name: displayNameSchema }).strict();

export const recoveryInputSchema = z.object({ memberId: idSchema }).strict();

export const redeemLinkSchema = z.object({ token: z.string().min(20).max(100) }).strict();
