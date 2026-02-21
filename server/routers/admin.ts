import * as db from "../db";
import * as fathomIntegration from "../fathomIntegration";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router, platformOwnerProcedure } from "../_core/trpc";
import { z } from "zod";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

export const adminRouter = router({
  // ============================================================================
  // PLATFORM OWNER ROUTES (Super-Admin / God-Mode)
  // ============================================================================
  
  /**
   * List all organizations on the platform (cross-account).
   * Only accessible to platform owners.
   */
  listAllOrganizations: platformOwnerProcedure.query(async () => {
    return await db.getAllOrganizations();
  }),

  /**
   * Get platform overview metrics (all accounts, all orgs).
   * Only accessible to platform owners.
   */
  platformOverview: platformOwnerProcedure.query(async () => {
    const accounts = await db.getAllAccounts();
    const orgs = await db.getAllOrganizations();
    const users = await db.getAllUsers();
    
    return {
      totalAccounts: accounts.length,
      totalOrganizations: orgs.length,
      totalUsers: users.length,
      accounts: accounts.map(acc => ({
        id: acc.id,
        name: acc.name,
        plan: acc.plan,
        status: acc.status,
        organizationCount: orgs.filter(o => o.accountId === acc.id).length,
        createdAt: acc.createdAt,
      })),
    };
  }),

  /**
   * Grant platform owner access to a user.
   * Only accessible to existing platform owners.
   */
  grantPlatformOwner: platformOwnerProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input }) => {
      await db.updateUser(input.userId, { platformOwner: true });
      return { success: true };
    }),

  /**
   * Revoke platform owner access from a user.
   * Only accessible to existing platform owners.
   */
  revokePlatformOwner: platformOwnerProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input }) => {
      await db.updateUser(input.userId, { platformOwner: false });
      return { success: true };
    }),

  // ============================================================================
  // REGULAR ADMIN ROUTES
  // ============================================================================
  
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
