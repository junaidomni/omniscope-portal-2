import * as db from "../db";
import { orgScopedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const meetingCategoriesRouter = router({
  getForMeeting: orgScopedProcedure
    .input(z.object({ meetingId: z.number() }))
    .query(async ({ input }) => {
      return await db.getCategoriesForMeeting(input.meetingId);
    }),

  add: orgScopedProcedure
    .input(z.object({ meetingId: z.number(), category: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await db.addCategoryToMeeting(input.meetingId, input.category);
      return { success: true };
    }),

  remove: orgScopedProcedure
    .input(z.object({ meetingId: z.number(), category: z.string() }))
    .mutation(async ({ input }) => {
      await db.removeCategoryFromMeeting(input.meetingId, input.category);
      return { success: true };
    }),

  listAll: orgScopedProcedure.query(async () => {
    return await db.getAllMeetingCategories();
  }),

  getMeetingsByCategory: orgScopedProcedure
    .input(z.object({ category: z.string() }))
    .query(async ({ input }) => {
      return await db.getMeetingsByCategory(input.category);
    }),
});
