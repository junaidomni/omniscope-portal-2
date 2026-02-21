import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { orgScopedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const integrationsRouter = router({
  list: orgScopedProcedure.query(async ({ ctx }) => {
    return db.listIntegrations(ctx.orgId);
  }),

  getBySlug: orgScopedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      return db.getIntegrationBySlug(input.slug);
    }),

  toggle: orgScopedProcedure
    .input(z.object({ id: z.number(), enabled: z.boolean() }))
    .mutation(async ({ input }) => {
      await db.toggleIntegration(input.id, input.enabled);
      return { success: true };
    }),

  updateApiKey: orgScopedProcedure
    .input(z.object({ id: z.number(), apiKey: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      await db.updateIntegrationApiKey(input.id, input.apiKey);
      return { success: true };
    }),

  upsert: orgScopedProcedure
    .input(z.object({
      slug: z.string(),
      name: z.string(),
      description: z.string().optional(),
      category: z.enum(["intelligence", "communication", "finance", "productivity", "custom"]).optional(),
      type: z.enum(["oauth", "api_key", "webhook", "custom"]).optional(),
      enabled: z.boolean().optional(),
      status: z.enum(["connected", "disconnected", "error", "pending"]).optional(),
      iconColor: z.string().optional(),
      iconLetter: z.string().optional(),
      apiKey: z.string().nullable().optional(),
      apiSecret: z.string().nullable().optional(),
      baseUrl: z.string().nullable().optional(),
      webhookUrl: z.string().nullable().optional(),
      webhookSecret: z.string().nullable().optional(),
      config: z.string().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return db.upsertIntegration({ ...input, createdBy: ctx.user?.id });
    }),

  delete: orgScopedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteIntegration(input.id);
      return { success: true };
    }),

  // Feature Toggles
  listToggles: orgScopedProcedure.query(async ({ ctx }) => {
    return db.listFeatureToggles(ctx.orgId);
  }),

  setToggle: orgScopedProcedure
    .input(z.object({ key: z.string(), enabled: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const result = await db.setFeatureToggle(input.key, input.enabled, ctx.user?.id);
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Feature toggle not found" });
      return result;
    }),
});
