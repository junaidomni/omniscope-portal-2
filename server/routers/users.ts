import * as db from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const usersRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        limit: z.number().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const allUsers = await db.getAllUsers();
      
      if (!input?.search) {
        return allUsers.slice(0, input?.limit || allUsers.length);
      }
      
      // Filter users by search query
      const searchLower = input.search.toLowerCase();
      const filtered = allUsers.filter(
        (user) =>
          user.name?.toLowerCase().includes(searchLower) ||
          user.email?.toLowerCase().includes(searchLower)
      );
      
      return filtered.slice(0, input?.limit || filtered.length);
    }),
});
