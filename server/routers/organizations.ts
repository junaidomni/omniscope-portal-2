import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

/**
 * Organizations Router — Multi-tenant org management
 * Handles: account setup, org CRUD, membership management, org switching
 */
export const organizationsRouter = router({
  /**
   * Get the current user's account + all their org memberships.
   * This is the primary "bootstrap" call on app load.
   */
  getMyOrgs: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    // Get account
    const account = await db.getAccountByOwner(userId);

    // Get all org memberships
    const memberships = await db.getUserOrgMemberships(userId);

    return {
      account,
      memberships: memberships.map((m) => ({
        id: m.membership.id,
        role: m.membership.role,
        isDefault: m.membership.isDefault,
        joinedAt: m.membership.joinedAt,
        org: {
          id: m.org.id,
          name: m.org.name,
          slug: m.org.slug,
          logoUrl: m.org.logoUrl,
          accentColor: m.org.accentColor,
          industry: m.org.industry,
          domain: m.org.domain,
          timezone: m.org.timezone,
          status: m.org.status,
          onboardingCompleted: m.org.onboardingCompleted,
        },
      })),
    };
  }),

  /**
   * Auto-provision: Create account + default org for a first-time user.
   * Called once when user has no account yet.
   */
  autoProvision: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.user.id;
    const userName = ctx.user.name || "User";

    const account = await db.autoProvisionUserAccount(userId, userName);
    if (!account) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to provision account",
      });
    }

    // Return the full bootstrap data
    const memberships = await db.getUserOrgMemberships(userId);
    return {
      account,
      memberships: memberships.map((m) => ({
        id: m.membership.id,
        role: m.membership.role,
        isDefault: m.membership.isDefault,
        joinedAt: m.membership.joinedAt,
        org: {
          id: m.org.id,
          name: m.org.name,
          slug: m.org.slug,
          logoUrl: m.org.logoUrl,
          accentColor: m.org.accentColor,
          industry: m.org.industry,
          domain: m.org.domain,
          timezone: m.org.timezone,
          status: m.org.status,
          onboardingCompleted: m.org.onboardingCompleted,
        },
      })),
    };
  }),

  /**
   * Create a new organization under the user's account
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(500),
        slug: z.string().min(2).max(100).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "Slug must be lowercase alphanumeric with hyphens"),
        logoUrl: z.string().optional(),
        accentColor: z.string().optional(),
        industry: z.string().optional(),
        domain: z.string().optional(),
        timezone: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Get or create account
      let account = await db.getAccountByOwner(userId);
      if (!account) {
        const accountId = await db.createAccount({
          name: `${ctx.user.name || "User"}'s Account`,
          ownerUserId: userId,
        });
        if (!accountId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create account" });
        account = await db.getAccountById(accountId);
      }
      if (!account) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Account not found" });

      // Check org limit
      const existingOrgs = await db.getOrganizationsByAccount(account.id);
      if (existingOrgs.length >= account.maxOrganizations) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Organization limit reached (${account.maxOrganizations}). Upgrade your plan for more.`,
        });
      }

      // Check slug availability
      const slugAvailable = await db.isOrgSlugAvailable(input.slug);
      if (!slugAvailable) {
        throw new TRPCError({ code: "CONFLICT", message: "This slug is already taken" });
      }

      // Create org
      const orgId = await db.createOrganization({
        accountId: account.id,
        name: input.name,
        slug: input.slug,
        logoUrl: input.logoUrl,
        accentColor: input.accentColor,
        industry: input.industry,
        domain: input.domain,
        timezone: input.timezone,
      });
      if (!orgId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create organization" });

      // Add creator as org_admin
      await db.addOrgMembership({
        userId,
        organizationId: orgId,
        role: "org_admin",
      });

      return await db.getOrganizationById(orgId);
    }),

  /**
   * Update an organization's details (requires org_admin+ role)
   */
  update: protectedProcedure
    .input(
      z.object({
        orgId: z.number(),
        name: z.string().min(1).max(500).optional(),
        logoUrl: z.string().nullable().optional(),
        accentColor: z.string().optional(),
        industry: z.string().nullable().optional(),
        domain: z.string().nullable().optional(),
        timezone: z.string().optional(),
        settings: z.string().nullable().optional(),
        onboardingCompleted: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { orgId, ...data } = input;

      // Check permission
      const membership = await db.getOrgMembership(ctx.user.id, orgId);
      if (!membership || !["super_admin", "account_owner", "org_admin"].includes(membership.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to update this organization" });
      }

      await db.updateOrganization(orgId, data);
      return await db.getOrganizationById(orgId);
    }),

  /**
   * Get a single organization by ID (must be a member)
   */
  getById: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ ctx, input }) => {
      const membership = await db.getOrgMembership(ctx.user.id, input.orgId);
      if (!membership) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You are not a member of this organization" });
      }

      const org = await db.getOrganizationById(input.orgId);
      if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });

      return { org, membership };
    }),

  /**
   * Check if a slug is available
   */
  checkSlug: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const available = await db.isOrgSlugAvailable(input.slug);
      return { available };
    }),

  /**
   * Switch the user's active/default org
   */
  switchOrg: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const membership = await db.getOrgMembership(ctx.user.id, input.orgId);
      if (!membership) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You are not a member of this organization" });
      }

      await db.setDefaultOrg(ctx.user.id, input.orgId);
      return await db.getOrganizationById(input.orgId);
    }),

  /**
   * Get all members of an organization (requires member+ role)
   */
  getMembers: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ ctx, input }) => {
      const membership = await db.getOrgMembership(ctx.user.id, input.orgId);
      if (!membership) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You are not a member of this organization" });
      }

      return await db.getOrgMembers(input.orgId);
    }),

  /**
   * Invite/add a user to an organization (requires org_admin+)
   */
  addMember: protectedProcedure
    .input(
      z.object({
        orgId: z.number(),
        userId: z.number(),
        role: z.enum(["org_admin", "manager", "member", "viewer"]).default("member"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check permission
      const myMembership = await db.getOrgMembership(ctx.user.id, input.orgId);
      if (!myMembership || !["super_admin", "account_owner", "org_admin"].includes(myMembership.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to add members" });
      }

      // Check if already a member
      const existing = await db.getOrgMembership(input.userId, input.orgId);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "User is already a member of this organization" });
      }

      await db.addOrgMembership({
        userId: input.userId,
        organizationId: input.orgId,
        role: input.role,
        invitedBy: ctx.user.id,
      });

      return { success: true };
    }),

  /**
   * Update a member's role (requires org_admin+)
   */
  updateMemberRole: protectedProcedure
    .input(
      z.object({
        orgId: z.number(),
        userId: z.number(),
        role: z.enum(["org_admin", "manager", "member", "viewer"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const myMembership = await db.getOrgMembership(ctx.user.id, input.orgId);
      if (!myMembership || !["super_admin", "account_owner", "org_admin"].includes(myMembership.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to update roles" });
      }

      // Can't change your own role
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot change your own role" });
      }

      await db.updateOrgMemberRole(input.userId, input.orgId, input.role);
      return { success: true };
    }),

  /**
   * Remove a member from an organization (requires org_admin+)
   */
  removeMember: protectedProcedure
    .input(z.object({ orgId: z.number(), userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const myMembership = await db.getOrgMembership(ctx.user.id, input.orgId);
      if (!myMembership || !["super_admin", "account_owner", "org_admin"].includes(myMembership.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to remove members" });
      }

      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot remove yourself" });
      }

      await db.removeOrgMembership(input.userId, input.orgId);
      return { success: true };
    }),
});
