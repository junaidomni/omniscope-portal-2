/**
 * Admin Hub Router — Cross-org queries for the Super Admin Organization Hub.
 * These procedures aggregate data across all organizations and are gated
 * to super_admin / account_owner roles only.
 */
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { storagePut } from "../storage";
import {
  users,
  accounts,
  organizations,
  orgMemberships,
  meetings,
  tasks,
  contacts,
  companies,
  integrations,
  featureToggles,
  activityLog,
  employees,
  subscriptions,
  plans,
  billingEvents,
  loginHistory,
  planFeatures,
  invitations,
  platformAuditLog,
} from "../../drizzle/schema";
import { eq, count, desc, and, gte, like, sql, asc } from "drizzle-orm";
import { logAuditEvent } from "../auditLog";
import { notifyOwner } from "../_core/notification";
import * as dbHelpers from "../db";

// Gate: only super_admin or account_owner can access
const hubProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

  const memberships = await db
    .select({ role: orgMemberships.role })
    .from(orgMemberships)
    .where(eq(orgMemberships.userId, ctx.user.id));

  const hasAccess =
    ctx.user.role === "admin" ||
    memberships.some(
      (m) => m.role === "super_admin" || m.role === "account_owner"
    );

  if (!hasAccess) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Super Admin access required",
    });
  }
  return next({ ctx });
});

export const adminHubRouter = router({
  /**
   * Dashboard overview — aggregated metrics across all orgs
   */
  dashboardOverview: hubProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    // Get account info
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.ownerUserId, ctx.user.id))
      .limit(1);

    // Count organizations
    const orgs = account
      ? await db
          .select({
            id: organizations.id,
            name: organizations.name,
            slug: organizations.slug,
            status: organizations.status,
            industry: organizations.industry,
            logoUrl: organizations.logoUrl,
            accentColor: organizations.accentColor,
            createdAt: organizations.createdAt,
          })
          .from(organizations)
          .where(eq(organizations.accountId, account.id))
      : [];

    // Count total users
    const totalUsersResult = await db.select({ count: count() }).from(users);
    const totalUsers = totalUsersResult[0]?.count ?? 0;

    // Count total meetings
    const totalMeetingsResult = await db.select({ count: count() }).from(meetings);
    const totalMeetings = totalMeetingsResult[0]?.count ?? 0;

    // Count total tasks
    const totalTasksResult = await db.select({ count: count() }).from(tasks);
    const totalTasks = totalTasksResult[0]?.count ?? 0;

    // Count total contacts
    const totalContactsResult = await db.select({ count: count() }).from(contacts);
    const totalContacts = totalContactsResult[0]?.count ?? 0;

    // Count total companies
    const totalCompaniesResult = await db.select({ count: count() }).from(companies);
    const totalCompanies = totalCompaniesResult[0]?.count ?? 0;

    // Count integrations by status
    const integrationsData = await db
      .select({ status: integrations.status, count: count() })
      .from(integrations)
      .groupBy(integrations.status);

    const integrationStats = { connected: 0, disconnected: 0, error: 0, pending: 0, total: 0 };
    integrationsData.forEach((row) => {
      const key = row.status as keyof typeof integrationStats;
      if (key in integrationStats) integrationStats[key] = row.count;
      integrationStats.total += row.count;
    });

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentActivityResult = await db
      .select({ count: count() })
      .from(activityLog)
      .where(gte(activityLog.createdAt, sevenDaysAgo));
    const recentActivityCount = recentActivityResult[0]?.count ?? 0;

    // Feature toggles summary
    const toggles = await db.select().from(featureToggles);
    const enabledFeatures = toggles.filter((t) => t.enabled).length;
    const totalFeatures = toggles.length;

    return {
      account: account
        ? {
            id: account.id,
            name: account.name,
            plan: account.plan,
            status: account.status,
            maxOrganizations: account.maxOrganizations,
            maxUsersPerOrg: account.maxUsersPerOrg,
          }
        : null,
      organizations: {
        list: orgs,
        total: orgs.length,
        active: orgs.filter((o) => o.status === "active").length,
        suspended: orgs.filter((o) => o.status === "suspended").length,
      },
      users: { total: totalUsers },
      meetings: { total: totalMeetings },
      tasks: { total: totalTasks },
      contacts: { total: totalContacts },
      companies: { total: totalCompanies },
      integrations: integrationStats,
      activity: { last7Days: recentActivityCount },
      features: { enabled: enabledFeatures, total: totalFeatures },
    };
  }),

  /**
   * All organizations with member counts
   */
  listOrganizations: hubProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.ownerUserId, ctx.user.id))
      .limit(1);

    if (!account) return [];

    const orgs = await db
      .select()
      .from(organizations)
      .where(eq(organizations.accountId, account.id))
      .orderBy(desc(organizations.createdAt));

    const memberCounts = await db
      .select({ orgId: orgMemberships.organizationId, count: count() })
      .from(orgMemberships)
      .groupBy(orgMemberships.organizationId);

    const countMap = new Map(memberCounts.map((mc) => [mc.orgId, mc.count]));

    return orgs.map((org) => ({
      ...org,
      memberCount: countMap.get(org.id) ?? 0,
    }));
  }),

  /**
   * All users across all orgs with their memberships
   */
  listAllUsers: hubProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));

    const allMemberships = await db
      .select({
        userId: orgMemberships.userId,
        role: orgMemberships.role,
        orgId: orgMemberships.organizationId,
        orgName: organizations.name,
        orgSlug: organizations.slug,
        isDefault: orgMemberships.isDefault,
      })
      .from(orgMemberships)
      .innerJoin(organizations, eq(orgMemberships.organizationId, organizations.id));

    const membershipMap = new Map<number, typeof allMemberships>();
    allMemberships.forEach((m) => {
      const existing = membershipMap.get(m.userId) ?? [];
      existing.push(m);
      membershipMap.set(m.userId, existing);
    });

    return allUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      profilePhotoUrl: (u as any).profilePhotoUrl,
      onboardingCompleted: u.onboardingCompleted,
      createdAt: u.createdAt,
      memberships: membershipMap.get(u.id) ?? [],
    }));
  }),

  /**
   * All integrations with their status
   */
  listAllIntegrations: hubProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    return await db.select().from(integrations).orderBy(integrations.sortOrder);
  }),

  /**
   * All feature toggles
   */
  listAllFeatureToggles: hubProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    return await db.select().from(featureToggles).orderBy(featureToggles.sortOrder);
  }),

  /**
   * Toggle a feature flag (global)
   */
  toggleFeature: hubProcedure
    .input(z.object({ id: z.number(), enabled: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db
        .update(featureToggles)
        .set({ enabled: input.enabled, updatedBy: ctx.user.id })
        .where(eq(featureToggles.id, input.id));
      return { success: true };
    }),

  /**
   * Update the required plan for a feature flag
   */
  updateFeaturePlan: hubProcedure
    .input(z.object({
      id: z.number(),
      requiredPlan: z.enum(["starter", "professional", "enterprise"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db
        .update(featureToggles)
        .set({ requiredPlan: input.requiredPlan, updatedBy: ctx.user.id })
        .where(eq(featureToggles.id, input.id));
      return { success: true };
    }),

  /**
   * Get features available for an org based on its account plan
   */
  getOrgAvailableFeatures: hubProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Get the org's account plan
      const [org] = await db
        .select({ accountId: organizations.accountId })
        .from(organizations)
        .where(eq(organizations.id, input.orgId));
      if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });

      const [account] = await db
        .select({ plan: accounts.plan })
        .from(accounts)
        .where(eq(accounts.id, org.accountId));
      if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });

      const planHierarchy: Record<string, number> = { starter: 0, professional: 1, enterprise: 2, sovereign: 3 };
      const accountLevel = planHierarchy[account.plan] ?? 0;

      // Get all features
      const allFeatures = await db.select().from(featureToggles).orderBy(featureToggles.sortOrder);

      return allFeatures.map((f) => ({
        ...f,
        availableOnPlan: (planHierarchy[f.requiredPlan] ?? 0) <= accountLevel,
        accountPlan: account.plan,
      }));
    }),

  /**
   * Audit log — cross-org activity
   */
  getAuditLog: hubProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
        action: z.string().optional(),
        entityType: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const conditions = [];
      if (input?.action) conditions.push(eq(activityLog.action, input.action));
      if (input?.entityType) conditions.push(eq(activityLog.entityType, input.entityType));

      const logs = await db
        .select({
          id: activityLog.id,
          action: activityLog.action,
          entityType: activityLog.entityType,
          entityId: activityLog.entityId,
          entityName: activityLog.entityName,
          details: activityLog.details,
          userId: activityLog.userId,
          userName: users.name,
          createdAt: activityLog.createdAt,
        })
        .from(activityLog)
        .leftJoin(users, eq(activityLog.userId, users.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(activityLog.createdAt))
        .limit(input?.limit ?? 50)
        .offset(input?.offset ?? 0);

      const totalResult = await db
        .select({ count: count() })
        .from(activityLog)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return { logs, total: totalResult[0]?.count ?? 0 };
    }),

  /**
   * Platform health stats
   */
  platformHealth: hubProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const [meetingCount] = await db.select({ count: count() }).from(meetings);
    const [taskCount] = await db.select({ count: count() }).from(tasks);
    const [contactCount] = await db.select({ count: count() }).from(contacts);
    const [companyCount] = await db.select({ count: count() }).from(companies);
    const [employeeCount] = await db.select({ count: count() }).from(employees);
    const [userCount] = await db.select({ count: count() }).from(users);

    const integrationHealth = await db
      .select({
        name: integrations.name,
        slug: integrations.slug,
        status: integrations.status,
        enabled: integrations.enabled,
        lastSyncAt: integrations.lastSyncAt,
        iconUrl: integrations.iconUrl,
      })
      .from(integrations)
      .where(eq(integrations.enabled, true));

    return {
      entities: {
        meetings: meetingCount?.count ?? 0,
        tasks: taskCount?.count ?? 0,
        contacts: contactCount?.count ?? 0,
        companies: companyCount?.count ?? 0,
        employees: employeeCount?.count ?? 0,
        users: userCount?.count ?? 0,
      },
      integrations: integrationHealth,
      timestamp: new Date().toISOString(),
    };
  }),

  /**
   * Update organization status (suspend/activate/archive)
   */
  updateOrgStatus: hubProcedure
    .input(z.object({ orgId: z.number(), status: z.enum(["active", "suspended", "archived"]) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db
        .update(organizations)
        .set({ status: input.status })
        .where(eq(organizations.id, input.orgId));
      return { success: true };
    }),

  /**
   * Get single organization detail with members and integrations
   */
  getOrgDetail: hubProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, input.orgId))
        .limit(1);

      if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });

      // Get members with user info
      const members = await db
        .select({
          id: orgMemberships.id,
          userId: orgMemberships.userId,
          role: orgMemberships.role,
          isDefault: orgMemberships.isDefault,
          joinedAt: orgMemberships.joinedAt,
          userName: users.name,
          userEmail: users.email,
        })
        .from(orgMemberships)
        .innerJoin(users, eq(orgMemberships.userId, users.id))
        .where(eq(orgMemberships.organizationId, input.orgId));

      // Get org integrations
      const orgIntegrations = await db
        .select()
        .from(integrations)
        .where(eq(integrations.orgId, input.orgId))
        .orderBy(integrations.sortOrder);

      // Get org feature toggles
      const orgFeatures = await db
        .select()
        .from(featureToggles)
        .where(eq(featureToggles.orgId, input.orgId));

      // Count meetings, tasks, contacts for this org
      const [meetingCount] = await db.select({ count: count() }).from(meetings).where(eq(meetings.orgId, input.orgId));
      const [taskCount] = await db.select({ count: count() }).from(tasks).where(eq(tasks.orgId, input.orgId));
      const [contactCount] = await db.select({ count: count() }).from(contacts).where(eq(contacts.orgId, input.orgId));

      return {
        ...org,
        members,
        integrations: orgIntegrations,
        features: orgFeatures,
        stats: {
          meetings: meetingCount?.count ?? 0,
          tasks: taskCount?.count ?? 0,
          contacts: contactCount?.count ?? 0,
          members: members.length,
        },
      };
    }),

  /**
   * Update organization details (name, branding, timezone, etc.)
   */
  updateOrg: hubProcedure
    .input(
      z.object({
        orgId: z.number(),
        name: z.string().min(1).max(500).optional(),
        slug: z.string().min(1).max(100).optional(),
        logoUrl: z.string().nullable().optional(),
        accentColor: z.string().max(32).optional(),
        industry: z.string().max(255).nullable().optional(),
        domain: z.string().max(500).nullable().optional(),
        timezone: z.string().max(100).optional(),
        settings: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const { orgId, ...updates } = input;

      // If slug is being changed, check uniqueness
      if (updates.slug) {
        const [existing] = await db
          .select({ id: organizations.id })
          .from(organizations)
          .where(and(eq(organizations.slug, updates.slug)))
          .limit(1);
        if (existing && existing.id !== orgId) {
          throw new TRPCError({ code: "CONFLICT", message: "Slug already in use" });
        }
      }

      // Filter out undefined values
      const setObj: Record<string, any> = {};
      if (updates.name !== undefined) setObj.name = updates.name;
      if (updates.slug !== undefined) setObj.slug = updates.slug;
      if (updates.logoUrl !== undefined) setObj.logoUrl = updates.logoUrl;
      if (updates.accentColor !== undefined) setObj.accentColor = updates.accentColor;
      if (updates.industry !== undefined) setObj.industry = updates.industry;
      if (updates.domain !== undefined) setObj.domain = updates.domain;
      if (updates.timezone !== undefined) setObj.timezone = updates.timezone;
      if (updates.settings !== undefined) setObj.settings = updates.settings;

      if (Object.keys(setObj).length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No fields to update" });
      }

      await db.update(organizations).set(setObj).where(eq(organizations.id, orgId));

      // Return updated org
      const [updated] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1);
      return updated;
    }),

  /**
   * Update member role within an organization
   */
  updateMemberRole: hubProcedure
    .input(
      z.object({
        membershipId: z.number(),
        role: z.enum(["super_admin", "account_owner", "org_admin", "manager", "member", "viewer"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db
        .update(orgMemberships)
        .set({ role: input.role })
        .where(eq(orgMemberships.id, input.membershipId));
      return { success: true };
    }),

  /**
   * Remove member from an organization
   */
  removeMember: hubProcedure
    .input(z.object({ membershipId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await db.delete(orgMemberships).where(eq(orgMemberships.id, input.membershipId));
      return { success: true };
    }),

  /**
   * Update integration settings for an org
   */
  /**
   * Upload org logo to S3
   */
  uploadOrgLogo: hubProcedure
    .input(z.object({
      orgId: z.number(),
      base64: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const buffer = Buffer.from(input.base64, "base64");
      const ext = input.mimeType.includes("png") ? "png" : input.mimeType.includes("svg") ? "svg" : "jpg";
      const key = `org-logos/${input.orgId}-logo-${Date.now()}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);

      await db.update(organizations).set({ logoUrl: url }).where(eq(organizations.id, input.orgId));
      return { url };
    }),

  updateIntegration: hubProcedure
    .input(
      z.object({
        integrationId: z.number(),
        enabled: z.boolean().optional(),
        apiKey: z.string().nullable().optional(),
        apiSecret: z.string().nullable().optional(),
        baseUrl: z.string().nullable().optional(),
        webhookUrl: z.string().nullable().optional(),
        config: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const { integrationId, ...updates } = input;
      const setObj: Record<string, any> = {};
      if (updates.enabled !== undefined) setObj.enabled = updates.enabled;
      if (updates.apiKey !== undefined) setObj.apiKey = updates.apiKey;
      if (updates.apiSecret !== undefined) setObj.apiSecret = updates.apiSecret;
      if (updates.baseUrl !== undefined) setObj.baseUrl = updates.baseUrl;
      if (updates.webhookUrl !== undefined) setObj.webhookUrl = updates.webhookUrl;
      if (updates.config !== undefined) setObj.config = updates.config;

      if (updates.enabled === true) setObj.status = "connected";
      if (updates.enabled === false) setObj.status = "disconnected";

      await db.update(integrations).set(setObj).where(eq(integrations.id, integrationId));
      return { success: true };
    }),

  // ─── ACCOUNTS MANAGEMENT ─────────────────────────────────────────────────

  /**
   * List all accounts with owner info, subscription, and org count
   */
  listAccounts: hubProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const allAccounts = await db
      .select({
        id: accounts.id,
        name: accounts.name,
        plan: accounts.plan,
        status: accounts.status,
        mrrCents: accounts.mrrCents,
        healthScore: accounts.healthScore,
        billingEmail: accounts.billingEmail,
        maxOrganizations: accounts.maxOrganizations,
        maxUsersPerOrg: accounts.maxUsersPerOrg,
        createdAt: accounts.createdAt,
        lastActiveAt: accounts.lastActiveAt,
        ownerName: users.name,
        ownerEmail: users.email,
        ownerAvatar: users.profilePhotoUrl,
      })
      .from(accounts)
      .innerJoin(users, eq(accounts.ownerUserId, users.id))
      .orderBy(desc(accounts.createdAt));

    // Enrich with org count and subscription status
    const enriched = await Promise.all(
      allAccounts.map(async (acct) => {
        const [orgCountResult] = await db
          .select({ count: count() })
          .from(organizations)
          .where(eq(organizations.accountId, acct.id));

        const [sub] = await db
          .select({
            id: subscriptions.id,
            status: subscriptions.status,
            planId: subscriptions.planId,
            billingCycle: subscriptions.billingCycle,
            startDate: subscriptions.startDate,
            endDate: subscriptions.endDate,
          })
          .from(subscriptions)
          .where(and(eq(subscriptions.accountId, acct.id), eq(subscriptions.status, "active")))
          .limit(1);

        let planName = acct.plan;
        if (sub) {
          const [planRow] = await db
            .select({ name: plans.name, key: plans.key })
            .from(plans)
            .where(eq(plans.id, sub.planId))
            .limit(1);
          if (planRow) planName = planRow.key;
        }

        return {
          ...acct,
          orgCount: orgCountResult?.count ?? 0,
          subscription: sub || null,
          resolvedPlan: planName,
        };
      })
    );

    return enriched;
  }),

  /**
   * Get detailed account info for drill-down
   */
  getAccountDetail: hubProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Account + owner
      const [acctRow] = await db
        .select({
          id: accounts.id,
          name: accounts.name,
          plan: accounts.plan,
          status: accounts.status,
          mrrCents: accounts.mrrCents,
          healthScore: accounts.healthScore,
          billingEmail: accounts.billingEmail,
          maxOrganizations: accounts.maxOrganizations,
          maxUsersPerOrg: accounts.maxUsersPerOrg,
          trialEndsAt: accounts.trialEndsAt,
          metadata: accounts.metadata,
          createdAt: accounts.createdAt,
          lastActiveAt: accounts.lastActiveAt,
          ownerUserId: accounts.ownerUserId,
          ownerName: users.name,
          ownerEmail: users.email,
          ownerAvatar: users.profilePhotoUrl,
        })
        .from(accounts)
        .innerJoin(users, eq(accounts.ownerUserId, users.id))
        .where(eq(accounts.id, input.accountId))
        .limit(1);

      if (!acctRow) throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });

      // Organizations under this account
      const orgs = await db
        .select()
        .from(organizations)
        .where(eq(organizations.accountId, input.accountId))
        .orderBy(asc(organizations.name));

      // Org member counts
      const orgDetails = await Promise.all(
        orgs.map(async (org) => {
          const [memberCount] = await db
            .select({ count: count() })
            .from(orgMemberships)
            .where(eq(orgMemberships.organizationId, org.id));
          return {
            id: org.id,
            name: org.name,
            slug: org.slug,
            status: org.status,
            logoUrl: org.logoUrl,
            industry: org.industry,
            memberCount: memberCount?.count ?? 0,
            createdAt: org.createdAt,
          };
        })
      );

      // Subscription
      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(and(eq(subscriptions.accountId, input.accountId), eq(subscriptions.status, "active")))
        .limit(1);

      let plan = null;
      if (sub) {
        const [planRow] = await db.select().from(plans).where(eq(plans.id, sub.planId)).limit(1);
        plan = planRow || null;
      }

      // Billing events
      const recentBilling = await db
        .select()
        .from(billingEvents)
        .where(eq(billingEvents.accountId, input.accountId))
        .orderBy(desc(billingEvents.createdAt))
        .limit(20);

      // Usage counts per org
      const usageByOrg = await Promise.all(
        orgs.map(async (org) => {
          const [contactCount] = await db.select({ count: count() }).from(contacts).where(eq(contacts.orgId, org.id));
          const [meetingCount] = await db.select({ count: count() }).from(meetings).where(eq(meetings.orgId, org.id));
          const [taskCount] = await db.select({ count: count() }).from(tasks).where(eq(tasks.orgId, org.id));
          const [memberCount] = await db.select({ count: count() }).from(orgMemberships).where(eq(orgMemberships.organizationId, org.id));
          return {
            orgId: org.id,
            orgName: org.name,
            contacts: contactCount?.count ?? 0,
            meetings: meetingCount?.count ?? 0,
            tasks: taskCount?.count ?? 0,
            members: memberCount?.count ?? 0,
          };
        })
      );

      return {
        account: acctRow,
        organizations: orgDetails,
        subscription: sub || null,
        plan,
        billingEvents: recentBilling,
        usageByOrg,
      };
    }),

  /**
   * Update account status (suspend, activate, cancel)
   */
  updateAccountStatus: hubProcedure
    .input(z.object({
      accountId: z.number(),
      status: z.enum(["active", "suspended", "cancelled"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.update(accounts).set({ status: input.status }).where(eq(accounts.id, input.accountId));
      return { success: true };
    }),

  /**
   * Update account MRR
   */
  updateAccountMrr: hubProcedure
    .input(z.object({
      accountId: z.number(),
      mrrCents: z.number().min(0),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.update(accounts).set({ mrrCents: input.mrrCents }).where(eq(accounts.id, input.accountId));
      return { success: true };
    }),

  /**
   * Update account health score
   */
  updateAccountHealth: hubProcedure
    .input(z.object({
      accountId: z.number(),
      healthScore: z.number().min(0).max(100),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.update(accounts).set({ healthScore: input.healthScore }).where(eq(accounts.id, input.accountId));
      return { success: true };
    }),

  // ─── REVENUE DASHBOARD ───────────────────────────────────────────────────

  /**
   * Revenue overview — MRR breakdown by plan, total revenue, billing events
   */
  revenueOverview: hubProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    // Total MRR by plan
    const allAccounts = await db
      .select({
        plan: accounts.plan,
        status: accounts.status,
        mrrCents: accounts.mrrCents,
      })
      .from(accounts);

    let totalMrr = 0;
    let activeAccounts = 0;
    const planBreakdown = new Map<string, { count: number; mrr: number }>();

    for (const acct of allAccounts) {
      if (acct.status === "active") {
        activeAccounts++;
        totalMrr += acct.mrrCents;
      }
      const existing = planBreakdown.get(acct.plan) || { count: 0, mrr: 0 };
      existing.count++;
      existing.mrr += acct.mrrCents;
      planBreakdown.set(acct.plan, existing);
    }

    const byPlan = Array.from(planBreakdown.entries()).map(([plan, data]) => ({
      plan,
      count: data.count,
      mrr: data.mrr,
    }));

    // Recent billing events across all accounts
    const recentEvents = await db
      .select({
        id: billingEvents.id,
        accountId: billingEvents.accountId,
        type: billingEvents.type,
        amountCents: billingEvents.amountCents,
        fromPlan: billingEvents.fromPlan,
        toPlan: billingEvents.toPlan,
        description: billingEvents.description,
        createdAt: billingEvents.createdAt,
        accountName: accounts.name,
      })
      .from(billingEvents)
      .innerJoin(accounts, eq(billingEvents.accountId, accounts.id))
      .orderBy(desc(billingEvents.createdAt))
      .limit(50);

    // Subscription status breakdown
    const allSubs = await db
      .select({
        status: subscriptions.status,
        billingCycle: subscriptions.billingCycle,
      })
      .from(subscriptions);

    const subStatusMap = new Map<string, number>();
    const cycleMap = new Map<string, number>();
    for (const sub of allSubs) {
      subStatusMap.set(sub.status, (subStatusMap.get(sub.status) || 0) + 1);
      cycleMap.set(sub.billingCycle, (cycleMap.get(sub.billingCycle) || 0) + 1);
    }

    return {
      totalMrr,
      totalArr: totalMrr * 12,
      activeAccounts,
      totalAccounts: allAccounts.length,
      byPlan,
      recentEvents,
      subscriptionStatus: Object.fromEntries(subStatusMap),
      billingCycles: Object.fromEntries(cycleMap),
    };
  }),

  // ============================================================================
  // H-8: ACCOUNT PROVISIONING
  // ============================================================================
  provisionAccount: hubProcedure
    .input(z.object({
      accountName: z.string().min(1).max(500),
      ownerEmail: z.string().email().optional(),
      plan: z.enum(["starter", "professional", "enterprise", "sovereign"]).default("starter"),
      billingEmail: z.string().email().optional(),
      billingCycle: z.enum(["monthly", "annual", "custom"]).default("monthly"),
      orgName: z.string().min(1).max(500).optional(),
      orgSlug: z.string().min(1).max(100).optional(),
      industry: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      let ownerUserId = ctx.user.id;
      if (input.ownerEmail) {
        const [found] = await database.select().from(users).where(eq(users.email, input.ownerEmail)).limit(1);
        if (!found) throw new TRPCError({ code: "NOT_FOUND", message: `No user found with email ${input.ownerEmail}. They must sign in first.` });
        ownerUserId = found.id;
      }
      const existingAccount = await dbHelpers.getAccountByOwner(ownerUserId);
      if (existingAccount) throw new TRPCError({ code: "CONFLICT", message: "This user already owns an account." });
      const accountId = await dbHelpers.createAccount({ name: input.accountName, ownerUserId, plan: input.plan, billingEmail: input.billingEmail });
      if (!accountId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create account" });
      const orgName = input.orgName || `${input.accountName} Workspace`;
      let slug = input.orgSlug || input.accountName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
      let attempt = 0;
      while (!(await dbHelpers.isOrgSlugAvailable(slug))) { attempt++; slug = attempt > 10 ? `${slug}-${Date.now().toString(36)}` : `${slug}-${attempt}`; }
      const orgId = await dbHelpers.createOrganization({ accountId, name: orgName, slug, industry: input.industry });
      if (orgId) await dbHelpers.addOrgMembership({ userId: ownerUserId, organizationId: orgId, role: "account_owner", isDefault: true });
      const plan = await dbHelpers.getPlanByKey(input.plan);
      if (plan) await dbHelpers.createSubscription({ accountId, planId: plan.id, billingCycle: input.billingCycle, status: "active", notes: input.notes });
      await logAuditEvent(
        { userId: ctx.user.id, userName: ctx.user.name ?? undefined, userEmail: ctx.user.email ?? undefined },
        { action: "create", entityType: "account", entityId: accountId, details: { accountName: input.accountName, plan: input.plan, ownerEmail: input.ownerEmail } }
      );
      await notifyOwner({ title: "New Account Provisioned", content: `Account "${input.accountName}" created on ${input.plan} plan by ${ctx.user.name || ctx.user.email}.` });
      return { accountId, orgId, slug, success: true };
    }),

  // ============================================================================
  // H-6: SUPER-ADMIN MANAGEMENT
  // ============================================================================
  listPlatformOwners: hubProcedure.query(async ({ ctx: _ctx }) => {
    const database = await getDb();
    if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    return await database.select({ id: users.id, name: users.name, email: users.email, role: users.role, platformOwner: users.platformOwner, profilePhotoUrl: users.profilePhotoUrl, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn }).from(users).where(eq(users.platformOwner, true)).orderBy(users.createdAt);
  }),

  listAllUsersForAdmin: hubProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ input, ctx: _ctx }) => {
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const conditions = [];
      if (input?.search) { const p = `%${input.search}%`; conditions.push(sql`(${users.name} LIKE ${p} OR ${users.email} LIKE ${p})`); }
      return await database.select({ id: users.id, name: users.name, email: users.email, role: users.role, platformOwner: users.platformOwner, profilePhotoUrl: users.profilePhotoUrl, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn }).from(users).where(conditions.length > 0 ? and(...conditions) : undefined).orderBy(desc(users.createdAt)).limit(100);
    }),

  hubGrantPlatformOwner: hubProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user.platformOwner) throw new TRPCError({ code: "FORBIDDEN", message: "Only platform owners can grant this access" });
      const target = await dbHelpers.getUserById(input.userId);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      await dbHelpers.updateUser(input.userId, { platformOwner: true });
      await logAuditEvent({ userId: ctx.user.id, userName: ctx.user.name ?? undefined, userEmail: ctx.user.email ?? undefined }, { action: "platform_owner_grant", entityType: "user", entityId: input.userId, details: { targetName: target.name, targetEmail: target.email } });
      await notifyOwner({ title: "Platform Owner Access Granted", content: `${ctx.user.name || ctx.user.email} granted platform owner access to ${target.name || target.email}.` });
      return { success: true };
    }),

  hubRevokePlatformOwner: hubProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user.platformOwner) throw new TRPCError({ code: "FORBIDDEN", message: "Only platform owners can revoke this access" });
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot revoke your own platform owner access" });
      const target = await dbHelpers.getUserById(input.userId);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      await dbHelpers.updateUser(input.userId, { platformOwner: false });
      await logAuditEvent({ userId: ctx.user.id, userName: ctx.user.name ?? undefined, userEmail: ctx.user.email ?? undefined }, { action: "platform_owner_revoke", entityType: "user", entityId: input.userId, details: { targetName: target.name, targetEmail: target.email } });
      await notifyOwner({ title: "Platform Owner Access Revoked", content: `${ctx.user.name || ctx.user.email} revoked platform owner access from ${target.name || target.email}.` });
      return { success: true };
    }),

  getPlatformOwnerAuditTrail: hubProcedure.query(async ({ ctx: _ctx }) => {
    const database = await getDb();
    if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    return await database.select().from(platformAuditLog).where(sql`${platformAuditLog.action} IN ('platform_owner_grant', 'platform_owner_revoke')`).orderBy(desc(platformAuditLog.timestamp)).limit(100);
  }),

  // ============================================================================
  // H-3e: ACCOUNT SECURITY — LOGIN HISTORY
  // ============================================================================
  getLoginHistory: hubProcedure
    .input(z.object({ userId: z.number().optional(), limit: z.number().min(1).max(200).default(50), offset: z.number().min(0).default(0) }).optional())
    .query(async ({ input, ctx }) => {
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const targetUserId = input?.userId ?? ctx.user.id;
      const entries = await database.select().from(loginHistory).where(eq(loginHistory.userId, targetUserId)).orderBy(desc(loginHistory.loginAt)).limit(input?.limit ?? 50).offset(input?.offset ?? 0);
      const [totalResult] = await database.select({ count: count() }).from(loginHistory).where(eq(loginHistory.userId, targetUserId));
      return { entries, total: totalResult?.count ?? 0 };
    }),

  getAccountLoginHistory: hubProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50), offset: z.number().min(0).default(0) }).optional())
    .query(async ({ input, ctx }) => {
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const account = await dbHelpers.getAccountByOwner(ctx.user.id);
      if (!account) return { entries: [], total: 0 };
      const orgs = await database.select({ id: organizations.id }).from(organizations).where(eq(organizations.accountId, account.id));
      const orgIds = orgs.map(o => o.id);
      if (orgIds.length === 0) return { entries: [], total: 0 };
      const members = await database.select({ userId: orgMemberships.userId }).from(orgMemberships).where(sql`${orgMemberships.organizationId} IN (${sql.join(orgIds.map(id => sql`${id}`), sql`, `)})`);
      const userIds = [...new Set(members.map(m => m.userId))];
      if (userIds.length === 0) return { entries: [], total: 0 };
      const entries = await database.select({ id: loginHistory.id, userId: loginHistory.userId, loginAt: loginHistory.loginAt, ipAddress: loginHistory.ipAddress, userAgent: loginHistory.userAgent, loginMethod: loginHistory.loginMethod, success: loginHistory.success, failureReason: loginHistory.failureReason, country: loginHistory.country, city: loginHistory.city, deviceType: loginHistory.deviceType, userName: users.name, userEmail: users.email }).from(loginHistory).innerJoin(users, eq(loginHistory.userId, users.id)).where(sql`${loginHistory.userId} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`).orderBy(desc(loginHistory.loginAt)).limit(input?.limit ?? 50).offset(input?.offset ?? 0);
      const [totalResult] = await database.select({ count: count() }).from(loginHistory).where(sql`${loginHistory.userId} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`);
      return { entries, total: totalResult?.count ?? 0 };
    }),

  recordLogin: hubProcedure
    .input(z.object({ userId: z.number(), ipAddress: z.string().optional(), userAgent: z.string().optional(), loginMethod: z.string().optional(), success: z.boolean().default(true), failureReason: z.string().optional(), deviceType: z.string().optional() }))
    .mutation(async ({ input }) => {
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await database.insert(loginHistory).values({ userId: input.userId, ipAddress: input.ipAddress || null, userAgent: input.userAgent || null, loginMethod: input.loginMethod || null, success: input.success, failureReason: input.failureReason || null, deviceType: input.deviceType || null });
      return { success: true };
    }),
});
