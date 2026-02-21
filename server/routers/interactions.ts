import * as db from "../db";
import { orgScopedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const interactionsRouter = router({
  list: orgScopedProcedure
    .input(z.object({
      contactId: z.number().optional(),
      companyId: z.number().optional(),
      type: z.string().optional(),
      limit: z.number().optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      return await db.getAllInteractions(input ? { ...input, orgId: ctx.orgId ?? undefined } : { orgId: ctx.orgId ?? undefined });
    }),

  forContact: orgScopedProcedure
    .input(z.object({ contactId: z.number(), limit: z.number().optional() }))
    .query(async ({ input }) => {
      return await db.getInteractionsForContact(input.contactId, input.limit ?? 50);
    }),

  forCompany: orgScopedProcedure
    .input(z.object({ companyId: z.number(), limit: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      return await db.getInteractionsForCompany(input.companyId, input.limit ?? 50);
    }),

  create: orgScopedProcedure
    .input(z.object({
      type: z.enum(["meeting", "note", "doc_shared", "task_update", "email", "intro", "call"]),
      timestamp: z.string(),
      contactId: z.number().optional(),
      companyId: z.number().optional(),
      sourceRecordId: z.number().optional(),
      sourceType: z.string().optional(),
      summary: z.string().optional(),
      details: z.string().optional(),
      tags: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const id = await db.createInteraction({
        type: input.type,
        timestamp: new Date(input.timestamp),
        contactId: input.contactId ?? null,
        companyId: input.companyId ?? null,
        sourceRecordId: input.sourceRecordId ?? null,
        sourceType: input.sourceType ?? null,
        summary: input.summary ?? null,
        details: input.details ?? null,
        tags: input.tags ?? null,
        createdBy: ctx.user?.id ?? null,
      });
      return { id };
    }),

  delete: orgScopedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteInteraction(input.id);
      return { success: true };
    }),
});
