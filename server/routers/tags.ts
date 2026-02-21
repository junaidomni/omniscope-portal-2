import * as db from "../db";
import { orgScopedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const tagsRouter = router({
  list: orgScopedProcedure
    .input(z.object({ type: z.enum(["sector", "jurisdiction"]).optional() }).optional())
    .query(async ({ input }) => {
      return await db.getAllTags(input?.type);
    }),

  create: orgScopedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      type: z.enum(["sector", "jurisdiction"]),
    }))
    .mutation(async ({ input }) => {
      const tagId = await db.createTag({ name: input.name, type: input.type });
      return { id: tagId };
    }),
});
