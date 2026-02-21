import * as askOmniScope from "../askOmniScope";
import { TRPCError } from "@trpc/server";
import { orgScopedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const askRouter = router({
  ask: orgScopedProcedure
    .input(z.object({ query: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await askOmniScope.askOmniScope(input.query, ctx.orgId);
    }),

  // Full chat procedure with multi-turn conversation and full database context
  chat: orgScopedProcedure
    .input(z.object({
      query: z.string(),
      context: z.string().optional(), // current page context
      entityId: z.string().optional(), // current entity being viewed
      history: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await askOmniScope.chat(
        input.query,
        input.history || [],
        input.context,
        input.entityId,
        ctx.orgId
      );
    }),
  
  findByParticipant: orgScopedProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ ctx, input }) => {
      return await askOmniScope.findMeetingsByParticipant(input.name, ctx.orgId);
    }),
  
  findByOrganization: orgScopedProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ ctx, input }) => {
      return await askOmniScope.findMeetingsByOrganization(input.name, ctx.orgId);
    }),
});
