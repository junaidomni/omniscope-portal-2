import * as db from "../db";
import * as fathomIntegration from "../fathomIntegration";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

export const adminRouter = router({
  getAllUsers: adminProcedure.query(async ({ ctx }) => {
    return await db.getAllUsers();
  }),

  // Invitation-based user management
  createInvitation: adminProcedure
    .input(z.object({
      email: z.string().email(),
      fullName: z.string().min(1),
      role: z.enum(["user", "admin"]).default("user"),
    }))
    .mutation(async ({ input, ctx }) => {
      // Check if email already has an invitation
      const existing = await db.getInvitationByEmail(input.email);
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'An invitation already exists for this email' });
      }
      // Check if user already exists
      const existingUsers = await db.getAllUsers();
      if (existingUsers.some(u => u.email?.toLowerCase() === input.email.toLowerCase())) {
        throw new TRPCError({ code: 'CONFLICT', message: 'A user with this email already exists' });
      }
      const id = await db.createInvitation({
        email: input.email.toLowerCase(),
        fullName: input.fullName,
        role: input.role,
        invitedBy: ctx.user.id,
      });
      return { id, success: true };
    }),

  listInvitations: adminProcedure.query(async () => {
    return await db.getAllInvitations();
  }),

  deleteInvitation: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteInvitation(input.id);
      return { success: true };
    }),

  updateUserRole: adminProcedure
    .input(z.object({ userId: z.number(), role: z.enum(["user", "admin"]) }))
    .mutation(async ({ input }) => {
      await db.updateUser(input.userId, { role: input.role });
      return { success: true };
    }),

  deleteUser: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteUser(input.userId);
      return { success: true };
    }),

  importFathomMeetings: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(10),
      cursor: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return await fathomIntegration.importFathomMeetings({
        limit: input.limit,
        cursor: input.cursor,
      });
    }),

  registerFathomWebhook: adminProcedure
    .input(z.object({ webhookUrl: z.string().url() }))
    .mutation(async ({ input }) => {
      return await fathomIntegration.registerFathomWebhook(input.webhookUrl);
    }),

  listFathomWebhooks: adminProcedure.query(async () => {
    return await fathomIntegration.listFathomWebhooks();
  }),

  deleteFathomWebhook: adminProcedure
    .input(z.object({ webhookId: z.string() }))
    .mutation(async ({ input }) => {
      await fathomIntegration.deleteFathomWebhook(input.webhookId);
      return { success: true };
    }),
});
