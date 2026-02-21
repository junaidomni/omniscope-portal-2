import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { orgScopedProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import { z } from "zod";

export const designRouter = router({
  get: orgScopedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
    return db.getDesignPreferences(ctx.user.id);
  }),

  update: orgScopedProcedure
    .input(z.object({
      theme: z.enum(["obsidian", "ivory", "midnight", "emerald", "slate"]).optional(),
      accentColor: z.string().optional(),
      logoUrl: z.string().nullable().optional(),
      sidebarStyle: z.enum(["default", "compact", "minimal"]).optional(),
      sidebarPosition: z.enum(["left", "right"]).optional(),
      fontFamily: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      return db.upsertDesignPreferences(ctx.user.id, input);
    }),

  uploadLogo: orgScopedProcedure
    .input(z.object({ base64: z.string(), mimeType: z.string() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const buffer = Buffer.from(input.base64, "base64");
      const ext = input.mimeType.includes("png") ? "png" : input.mimeType.includes("svg") ? "svg" : "jpg";
      const key = `logos/${ctx.user.id}-custom-logo-${Date.now()}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      await db.upsertDesignPreferences(ctx.user.id, { logoUrl: url });
      return { url };
    }),
});
