import * as db from "../db";
import { orgScopedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const searchRouter = router({
  global: orgScopedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      return await db.globalSearch(input.query, ctx.orgId ?? undefined);
    }),
});
