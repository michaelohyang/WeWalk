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

export const stationIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Unknown station");
export const idSchema = z.uuid();
export const isoDateSchema = z.string().refine(isIsoDate, "Use a real date (YYYY-MM-DD)");

const score = z.int().min(1).max(5);
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

const text = (max: number) => z.string().trim().max(max).default("");

export const reviewInputSchema = z
  .object({
    stationId: stationIdSchema,
    visitedOn: isoDateSchema,
    scores: scoresSchema,
    hotTake: text(120),
    body: text(1200),
    tags: z
      .array(z.enum(TAGS))
      .max(TAGS.length)
      .default([])
      .transform((ts) => [...new Set(ts)]),
  })
  .strict();
export type ReviewInput = z.infer<typeof reviewInputSchema>;

export const checkinInputSchema = z
  .object({ stationId: stationIdSchema, visitedOn: isoDateSchema, note: text(400) })
  .strict();
export type CheckinInput = z.infer<typeof checkinInputSchema>;

export const joinInputSchema = z
  .object({ code: z.string().min(1).max(200), name: displayNameSchema })
  .strict();
export type JoinInput = z.infer<typeof joinInputSchema>;

export const renameInputSchema = z.object({ name: displayNameSchema }).strict();

export const recoveryInputSchema = z.object({ memberId: idSchema }).strict();

export const redeemLinkSchema = z.object({ token: z.string().min(20).max(100) }).strict();
