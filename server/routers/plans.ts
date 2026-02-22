import { z } from "zod";
import { adminProcedure, orgScopedProcedure, protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import {
  resolvePlanForOrg,
  getUsageCounts,
  checkUsageLimit,
  invalidatePlanCache,
} from "../planEnforcement";

export const plansRouter = router({
  /** List all available plans with their features (for pricing page) */
  list: protectedProcedure.query(async ({ ctx }) => {
    const allPlans = await db.getAllPlans();
    // Enrich each plan with its feature keys
    const enriched = await Promise.all(
      allPlans.map(async (plan) => {
        const features = await db.getPlanFeaturesForPlan(plan.id);
        return {
          ...plan,
          features: features.map((f) => f.featureKey),
        };
      })
    );
    return enriched;
  }),

  /** Get a single plan by key with its features */
  getByKey: protectedProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ ctx, input }) => {
      const plan = await db.getPlanByKey(input.key);
      if (!plan) return null;
      const features = await db.getPlanFeaturesForPlan(plan.id);
      return { ...plan, features };
    }),

  /** Get the current org's plan context, subscription, and usage */
  myPlan: orgScopedProcedure.query(async ({ ctx }) => {
    try {
      const planCtx = await resolvePlanForOrg(ctx.orgId);
      
      // Get usage counts (resilient to DB errors)
      const usage = await getUsageCounts(ctx.orgId);

      // Get subscription details if exists
      let subscription = null;
      if (planCtx.accountId) {
        try {
          subscription = await db.getSubscriptionForAccount(planCtx.accountId);
        } catch { /* no subscription */ }
      }

      // Get the full plan record
      let plan = null;
      let features: string[] = [];
      try {
        plan = await db.getPlanByKey(planCtx.planKey);
        if (plan) {
          const pf = await db.getPlanFeaturesForPlan(plan.id);
          features = pf.map((f) => f.featureKey);
        }
      } catch { /* use defaults */ }

      return {
        plan: plan ? { ...plan, features } : null,
        subscription,
        context: planCtx,
        usage: {
          contacts: usage.contacts,
          meetings: usage.meetingsThisMonth,
          users: usage.usersInOrg,
          organizations: usage.organizations,
        },
        limits: planCtx.limits,
      };
    } catch (err) {
      // Graceful fallback — return starter defaults
      return {
        plan: null,
        subscription: null,
        context: { planKey: "starter", planTier: 0, planName: "Starter", accountId: 0, subscriptionId: null, subscriptionStatus: "active", limits: { maxContacts: 500, maxMeetingsPerMonth: 50, maxUsersPerOrg: 5, maxOrganizations: 1, maxStorageGb: 5 } },
        usage: { contacts: 0, meetings: 0, users: 0, organizations: 0 },
        limits: { maxContacts: 500, maxMeetingsPerMonth: 50, maxUsersPerOrg: 5, maxOrganizations: 1, maxStorageGb: 5 },
      };
    }
  }),

  /** Check if a specific feature is available on the current plan */
  checkFeature: orgScopedProcedure
    .input(z.object({ featureKey: z.string() }))
    .query(async ({ ctx, input }) => {
      const { isFeatureIncludedInPlan } = await import("../planEnforcement");
      return isFeatureIncludedInPlan(ctx.orgId, input.featureKey);
    }),

  /** Check usage against a specific limit */
  checkLimit: orgScopedProcedure
    .input(z.object({
      limitType: z.enum(["contacts", "meetings", "users", "organizations", "storage"]),
    }))
    .query(async ({ ctx, input }) => {
      return checkUsageLimit(ctx.orgId, input.limitType);
    }),

  /** Get the current user's account subscription (legacy — uses account owner lookup) */
  mySubscription: protectedProcedure.query(async ({ ctx }) => {
    // Use getAccountByOwner instead of the non-existent getAccountForUser
    const account = await db.getAccountByOwner(ctx.user.id);
    if (!account) {
      // Try auto-provisioning
      const provisioned = await db.autoProvisionUserAccount(ctx.user.id, ctx.user.name || "User");
      if (!provisioned) return { plan: null, subscription: null, limits: null };
      const subscription = await db.getSubscriptionForAccount(provisioned.id);
      const limits = await db.getEffectiveLimits(provisioned.id);
      let plan = null;
      if (subscription) {
        plan = await db.getPlanById(subscription.planId);
      }
      return { plan, subscription, limits };
    }
    const subscription = await db.getSubscriptionForAccount(account.id);
    const limits = await db.getEffectiveLimits(account.id);
    let plan = null;
    if (subscription) {
      plan = await db.getPlanById(subscription.planId);
    }
    return { plan, subscription, limits };
  }),

  // ─── Admin-only procedures ──────────────────────────────────────────────

  /** Admin: List all accounts with their subscription status */
  listAccounts: adminProcedure.query(async ({ ctx }) => {
    const allAccounts = await db.getAllAccounts();
    const enriched = await Promise.all(
      allAccounts.map(async (account) => {
        const subscription = await db.getSubscriptionForAccount(account.id);
        const limits = await db.getEffectiveLimits(account.id);
        const orgs = await db.getOrganizationsByAccount(account.id);
        let plan = null;
        if (subscription) {
          plan = await db.getPlanById(subscription.planId);
        }
        return {
          ...account,
          subscription,
          plan,
          limits,
          orgCount: orgs.length,
          orgs: orgs.map((o) => ({ id: o.id, name: o.name, slug: o.slug, status: o.status })),
        };
      })
    );
    return enriched;
  }),

  /** Admin: Get subscription details for a specific account */
  getAccountSubscription: adminProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ ctx, input }) => {
      const subscription = await db.getSubscriptionForAccount(input.accountId);
      const limits = await db.getEffectiveLimits(input.accountId);
      const orgs = await db.getOrganizationsByAccount(input.accountId);
      let plan = null;
      if (subscription) {
        plan = await db.getPlanById(subscription.planId);
      }
      // Get usage for each org
      const orgUsage = await Promise.all(
        orgs.map(async (org) => ({
          orgId: org.id,
          orgName: org.name,
          usage: await getUsageCounts(org.id),
        }))
      );
      return { plan, subscription, limits, orgUsage };
    }),

  /** Admin: Assign a plan to an account (create or update subscription) */
  assignPlan: adminProcedure
    .input(z.object({
      accountId: z.number(),
      planKey: z.string(),
      billingCycle: z.enum(["monthly", "annual", "custom"]).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const plan = await db.getPlanByKey(input.planKey);
      if (!plan) throw new Error(`Plan "${input.planKey}" not found`);

      const existing = await db.getSubscriptionForAccount(input.accountId);
      let result;
      if (existing) {
        await db.updateSubscription(existing.id, {
          planId: plan.id,
          billingCycle: input.billingCycle,
          notes: input.notes,
          status: "active",
        });
        result = { subscriptionId: existing.id, action: "updated" as const };
      } else {
        const subId = await db.createSubscription({
          accountId: input.accountId,
          planId: plan.id,
          billingCycle: input.billingCycle || "monthly",
          notes: input.notes,
        });
        result = { subscriptionId: subId, action: "created" as const };
      }

      // Invalidate plan cache for all orgs under this account
      const orgs = await db.getOrganizationsByAccount(input.accountId);
      orgs.forEach((org) => invalidatePlanCache(org.id));

      return result;
    }),

  /** Admin: Override limits for a specific subscription */
  overrideLimits: adminProcedure
    .input(z.object({
      subscriptionId: z.number(),
      overrideMaxOrgs: z.number().nullable().optional(),
      overrideMaxUsersPerOrg: z.number().nullable().optional(),
      overrideMaxContacts: z.number().nullable().optional(),
      overrideMaxStorageGb: z.number().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { subscriptionId, ...overrides } = input;
      await db.updateSubscription(subscriptionId, overrides);
      // Invalidate all plan caches since we don't know which org this affects
      invalidatePlanCache();
      return { success: true };
    }),

  /** Admin: Cancel a subscription */
  cancelSubscription: adminProcedure
    .input(z.object({ subscriptionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.updateSubscription(input.subscriptionId, {
        status: "cancelled",
        cancelledAt: new Date(),
      });
      invalidatePlanCache();
      return { success: true };
    }),

  /** Admin: Reactivate a cancelled subscription */
  reactivateSubscription: adminProcedure
    .input(z.object({ subscriptionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.updateSubscription(input.subscriptionId, {
        status: "active",
        cancelledAt: null,
      });
      invalidatePlanCache();
      return { success: true };
    }),
});
