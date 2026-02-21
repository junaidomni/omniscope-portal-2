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
} from "../../drizzle/schema";
import { eq, count, desc, and, gte, like } from "drizzle-orm";

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
});
