import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const plansRouter = router({
  /** List all available plans (public for pricing page) */
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.getAllPlans();
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

  /** Get the current user's account subscription and effective limits */
  mySubscription: protectedProcedure.query(async ({ ctx }) => {
    const account = await db.getAccountForUser(ctx.user.id, ctx.user.name || "User");
    if (!account) return { plan: null, subscription: null, limits: null };
    const subscription = await db.getSubscriptionForAccount(account.id);
    const limits = await db.getEffectiveLimits(account.id);
    let plan = null;
    if (subscription) {
      plan = await db.getPlanById(subscription.planId);
    }
    return { plan, subscription, limits };
  }),

  // ─── Admin-only procedures ──────────────────────────────────────────────

  /** Admin: Get subscription details for a specific account */
  getAccountSubscription: adminProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ input }) => {
      const subscription = await db.getSubscriptionForAccount(input.accountId);
      const limits = await db.getEffectiveLimits(input.accountId);
      let plan = null;
      if (subscription) {
        plan = await db.getPlanById(subscription.planId);
      }
      return { plan, subscription, limits };
    }),

  /** Admin: Assign a plan to an account (create or update subscription) */
  assignPlan: adminProcedure
    .input(z.object({
      accountId: z.number(),
      planKey: z.string(),
      billingCycle: z.enum(["monthly", "annual", "custom"]).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const plan = await db.getPlanByKey(input.planKey);
      if (!plan) throw new Error(`Plan "${input.planKey}" not found`);

      const existing = await db.getSubscriptionForAccount(input.accountId);
      if (existing) {
        await db.updateSubscription(existing.id, {
          planId: plan.id,
          billingCycle: input.billingCycle,
          notes: input.notes,
        });
        return { subscriptionId: existing.id, action: "updated" };
      } else {
        const subId = await db.createSubscription({
          accountId: input.accountId,
          planId: plan.id,
          billingCycle: input.billingCycle || "monthly",
          notes: input.notes,
        });
        return { subscriptionId: subId, action: "created" };
      }
    }),

  /** Admin: Override limits for a specific subscription */
  overrideLimits: adminProcedure
    .input(z.object({
      subscriptionId: z.number(),
      overrideMaxOrgs: z.number().optional(),
      overrideMaxUsersPerOrg: z.number().optional(),
      overrideMaxContacts: z.number().optional(),
      overrideMaxStorageGb: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const { subscriptionId, ...overrides } = input;
      await db.updateSubscription(subscriptionId, overrides);
      return { success: true };
    }),

  /** Admin: Cancel a subscription */
  cancelSubscription: adminProcedure
    .input(z.object({ subscriptionId: z.number() }))
    .mutation(async ({ input }) => {
      await db.updateSubscription(input.subscriptionId, {
        status: "cancelled",
        cancelledAt: new Date(),
      });
      return { success: true };
    }),
});
