import * as analytics from "../analytics";
import { orgScopedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const analyticsRouter = router({
  dashboard: orgScopedProcedure.query(async ({ ctx }) => {
    return await analytics.getDashboardMetrics(ctx.orgId);
  }),
  
  dailySummary: orgScopedProcedure
    .input(z.object({ date: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const date = input.date ? new Date(input.date) : new Date();
      return await analytics.getDailySummary(date, ctx.orgId);
    }),
  
  weeklySummary: orgScopedProcedure
    .input(z.object({ weekStart: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      let weekStart: Date;
      if (input.weekStart) {
        weekStart = new Date(input.weekStart);
      } else {
        const now = new Date();
        weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
      }
      return await analytics.getWeeklySummary(weekStart, ctx.orgId);
    }),
});
