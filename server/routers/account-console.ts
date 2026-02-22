/**
 * Account Console Router
 * 
 * Provides the Account Owner experience — a dedicated section where
 * account owners manage all their organizations, billing, team, and usage.
 * This is NOT the workspace. This is the account-level management layer.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";

export const accountConsoleRouter = router({
  /**
   * Get account overview — summary of all orgs, users, usage, plan
   */
  overview: protectedProcedure.query(async ({ ctx }) => {
    const account = await db.getAccountByOwner(ctx.user!.id);
    if (!account) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No account found" });
    }

    const orgs = await db.getOrganizationsByAccount(account.id);
    const subscription = await db.getSubscriptionForAccount(account.id);
    const limits = await db.getEffectiveLimits(account.id);

    // Count total members across all orgs
    let totalMembers = 0;
    const orgDetails = [];
    for (const org of orgs) {
      const members = await db.getOrgMembers(org.id);
      totalMembers += members.length;
      orgDetails.push({
        ...org,
        memberCount: members.length,
      });
    }

    return {
      account: {
        id: account.id,
        name: account.name,
        plan: account.plan,
        status: account.status,
        billingEmail: account.billingEmail,
        mrrCents: account.mrrCents,
        healthScore: account.healthScore,
        createdAt: account.createdAt,
      },
      organizations: orgDetails,
      totalOrgs: orgs.length,
      totalMembers,
      subscription: subscription ? {
        plan: subscription.status,
        status: subscription.status,
        currentPeriodStart: subscription.startDate,
        currentPeriodEnd: subscription.endDate,
      } : null,
      limits,
    };
  }),

  /**
   * Get all organizations under this account with member details
   */
  organizations: protectedProcedure.query(async ({ ctx }) => {
    const account = await db.getAccountByOwner(ctx.user!.id);
    if (!account) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No account found" });
    }

    const orgs = await db.getOrganizationsByAccount(account.id);
    const result = [];

    for (const org of orgs) {
      const members = await db.getOrgMembers(org.id);
      result.push({
        id: org.id,
        name: org.name,
        slug: org.slug,
        logoUrl: org.logoUrl,
        industry: org.industry,
        status: org.status,
        createdAt: org.createdAt,
        memberCount: members.length,
        members: members.map(m => ({
          userId: m.membership.userId,
          role: m.membership.role,
          joinedAt: m.membership.joinedAt,
          userName: m.user.name,
          userEmail: m.user.email,
        })),
      });
    }

    return result;
  }),

  /**
   * Get all team members across all organizations
   */
  teamMembers: protectedProcedure.query(async ({ ctx }) => {
    const account = await db.getAccountByOwner(ctx.user!.id);
    if (!account) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No account found" });
    }

    const orgs = await db.getOrganizationsByAccount(account.id);
    const memberMap = new Map<number, {
      userId: number;
      userName: string;
      userEmail: string;
      roles: Array<{ orgId: number; orgName: string; role: string }>;
      lastActive: number | null;
    }>();

    for (const org of orgs) {
      const members = await db.getOrgMembers(org.id);
      for (const m of members) {
        const userId = m.membership.userId;
        const existing = memberMap.get(userId);
        if (existing) {
          existing.roles.push({ orgId: org.id, orgName: org.name, role: m.membership.role });
        } else {
          memberMap.set(userId, {
            userId,
            userName: m.user.name ?? "",
            userEmail: m.user.email ?? "",
            roles: [{ orgId: org.id, orgName: org.name, role: m.membership.role }],
            lastActive: null,
          });
        }
      }
    }

    return Array.from(memberMap.values());
  }),

  /**
   * Get billing history for this account
   */
  billingHistory: protectedProcedure.query(async ({ ctx }) => {
    const account = await db.getAccountByOwner(ctx.user!.id);
    if (!account) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No account found" });
    }

    const dbConn = await db.getDb();
    const schema = await import("../../drizzle/schema");
    const orm = await import("drizzle-orm");

    const events = await dbConn!
      .select()
      .from(schema.billingEvents)
      .where(orm.eq(schema.billingEvents.accountId, account.id))
      .orderBy(orm.desc(schema.billingEvents.createdAt))
      .limit(50);

    return {
      events,
      currentPlan: account.plan,
      mrrCents: account.mrrCents,
      billingEmail: account.billingEmail,
    };
  }),

  /**
   * Get usage breakdown across all orgs
   */
  usage: protectedProcedure.query(async ({ ctx }) => {
    const account = await db.getAccountByOwner(ctx.user!.id);
    if (!account) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No account found" });
    }

    const orgs = await db.getOrganizationsByAccount(account.id);
    const limits = await db.getEffectiveLimits(account.id);
    const dbConn = await db.getDb();
    const schema = await import("../../drizzle/schema");
    const orm = await import("drizzle-orm");

    const usageByOrg = [];
    let totalContacts = 0;
    let totalMeetings = 0;
    let totalTasks = 0;
    let totalEmployees = 0;
    let totalDocuments = 0;

    for (const org of orgs) {
      const [contactCount] = await dbConn!.select({ count: orm.sql<number>`count(*)` }).from(schema.contacts).where(orm.eq(schema.contacts.orgId, org.id));
      const [meetingCount] = await dbConn!.select({ count: orm.sql<number>`count(*)` }).from(schema.meetings).where(orm.eq(schema.meetings.orgId, org.id));
      const [taskCount] = await dbConn!.select({ count: orm.sql<number>`count(*)` }).from(schema.tasks).where(orm.eq(schema.tasks.orgId, org.id));
      const [employeeCount] = await dbConn!.select({ count: orm.sql<number>`count(*)` }).from(schema.employees).where(orm.eq(schema.employees.orgId, org.id));
      const [docCount] = await dbConn!.select({ count: orm.sql<number>`count(*)` }).from(schema.documents).where(orm.eq(schema.documents.orgId, org.id));

      const orgUsage = {
        orgId: org.id,
        orgName: org.name,
        contacts: contactCount?.count ?? 0,
        meetings: meetingCount?.count ?? 0,
        tasks: taskCount?.count ?? 0,
        employees: employeeCount?.count ?? 0,
        documents: docCount?.count ?? 0,
      };

      totalContacts += orgUsage.contacts;
      totalMeetings += orgUsage.meetings;
      totalTasks += orgUsage.tasks;
      totalEmployees += orgUsage.employees;
      totalDocuments += orgUsage.documents;

      usageByOrg.push(orgUsage);
    }

    return {
      totals: {
        contacts: totalContacts,
        meetings: totalMeetings,
        tasks: totalTasks,
        employees: totalEmployees,
        documents: totalDocuments,
        organizations: orgs.length,
      },
      limits,
      byOrg: usageByOrg,
    };
  }),

  /**
   * Update account settings (billing email, name)
   */
  updateSettings: protectedProcedure
    .input(z.object({
      billingEmail: z.string().email().optional(),
      name: z.string().min(1).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const account = await db.getAccountByOwner(ctx.user!.id);
      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No account found" });
      }

      const dbConn = await db.getDb();
      const schema = await import("../../drizzle/schema");
      const orm = await import("drizzle-orm");

      const updates: Record<string, unknown> = {};
      if (input.billingEmail) updates.billingEmail = input.billingEmail;
      if (input.name) updates.name = input.name;

      if (Object.keys(updates).length > 0) {
        await dbConn!.update(schema.accounts).set(updates).where(orm.eq(schema.accounts.id, account.id));
      }

      return { success: true };
    }),
});
