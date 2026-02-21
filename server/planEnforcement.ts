/**
 * Plan Enforcement Module
 * 
 * Resolves the chain: org → account → subscription → plan
 * Provides helpers for checking feature access and usage limits.
 * 
 * Usage in routers:
 *   import { planGatedProcedure } from "../_core/trpc";
 *   planGatedProcedure("ai_insights").query(...)
 *   planGatedProcedure("email", { checkLimit: "contacts" }).mutation(...)
 */

import { TRPCError } from "@trpc/server";

// Types for plan context
export interface PlanContext {
  planKey: string;
  planTier: number;
  planName: string;
  accountId: number;
  subscriptionId: number | null;
  subscriptionStatus: string;
  limits: PlanLimits;
}

export interface PlanLimits {
  maxContacts: number;       // -1 = unlimited
  maxMeetingsPerMonth: number; // -1 = unlimited
  maxUsersPerOrg: number;    // -1 = unlimited
  maxOrganizations: number;  // -1 = unlimited
  maxStorageGb: number;      // -1 = unlimited
}

export interface UsageCounts {
  contacts: number;
  meetingsThisMonth: number;
  usersInOrg: number;
  organizations: number;
  storageUsedGb: number;
}

// Cache for plan resolution to avoid repeated DB queries within a request
const planCache = new Map<number, { plan: PlanContext; timestamp: number }>();
const PLAN_CACHE_TTL = 60_000; // 1 minute

/**
 * Resolve the full plan context for an organization.
 * Chain: orgId → org.accountId → subscription → plan
 */
export async function resolvePlanForOrg(orgId: number | null): Promise<PlanContext> {
  if (!orgId) {
    // No org selected — return starter defaults
    return getStarterDefaults();
  }

  // Check cache
  const cached = planCache.get(orgId);
  if (cached && Date.now() - cached.timestamp < PLAN_CACHE_TTL) {
    return cached.plan;
  }

  // Lazy import to avoid circular dependency
  const db = await import("./db");

  // Step 1: Get org → accountId
  const org = await db.getOrganizationById(orgId);
  if (!org) {
    return getStarterDefaults();
  }

  // Step 2: Get account → subscription
  const subscription = await db.getSubscriptionForAccount(org.accountId);
  
  if (!subscription) {
    // No subscription — use the account's plan field as fallback
    const account = await db.getAccountById(org.accountId);
    const planKey = account?.plan || "starter";
    const plan = await db.getPlanByKey(planKey);
    
    const ctx: PlanContext = {
      planKey,
      planTier: plan?.tier ?? 0,
      planName: plan?.name ?? "Starter",
      accountId: org.accountId,
      subscriptionId: null,
      subscriptionStatus: "active",
      limits: {
        maxContacts: plan?.maxContacts ?? 500,
        maxMeetingsPerMonth: plan?.maxMeetingsPerMonth ?? 50,
        maxUsersPerOrg: plan?.maxUsersPerOrg ?? 5,
        maxOrganizations: plan?.maxOrganizations ?? 1,
        maxStorageGb: plan?.maxStorageGb ?? 5,
      },
    };

    planCache.set(orgId, { plan: ctx, timestamp: Date.now() });
    return ctx;
  }

  // Step 3: Get plan details
  const plan = await db.getPlanById(subscription.planId);
  if (!plan) {
    return getStarterDefaults();
  }

  const ctx: PlanContext = {
    planKey: plan.key,
    planTier: plan.tier,
    planName: plan.name,
    accountId: org.accountId,
    subscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    limits: {
      maxContacts: subscription.overrideMaxContacts ?? plan.maxContacts,
      maxMeetingsPerMonth: plan.maxMeetingsPerMonth,
      maxUsersPerOrg: subscription.overrideMaxUsersPerOrg ?? plan.maxUsersPerOrg,
      maxOrganizations: subscription.overrideMaxOrgs ?? plan.maxOrganizations,
      maxStorageGb: subscription.overrideMaxStorageGb ?? plan.maxStorageGb,
    },
  };

  planCache.set(orgId, { plan: ctx, timestamp: Date.now() });
  return ctx;
}

/**
 * Check if a specific feature is included in the org's plan.
 * Uses the plan_features table for fine-grained control.
 */
export async function isFeatureIncludedInPlan(
  orgId: number | null,
  featureKey: string
): Promise<{ included: boolean; requiredPlan: string | null; currentPlan: string }> {
  const planCtx = await resolvePlanForOrg(orgId);
  
  const db = await import("./db");
  
  // Check plan_features table
  const allPlans = await db.getAllPlans();
  const currentPlan = allPlans.find(p => p.key === planCtx.planKey);
  
  if (!currentPlan) {
    return { included: false, requiredPlan: "starter", currentPlan: planCtx.planKey };
  }

  // Get features for the current plan
  const planFeatures = await db.getPlanFeaturesForPlan(currentPlan.id);
  const feature = planFeatures.find(f => f.featureKey === featureKey);
  
  if (feature) {
    return { included: feature.included, requiredPlan: null, currentPlan: planCtx.planKey };
  }

  // Feature not in plan_features — find the minimum plan that includes it
  for (const plan of allPlans.sort((a, b) => a.tier - b.tier)) {
    const pf = await db.getPlanFeaturesForPlan(plan.id);
    if (pf.some(f => f.featureKey === featureKey && f.included)) {
      return { included: false, requiredPlan: plan.key, currentPlan: planCtx.planKey };
    }
  }

  // Feature not gated at all — allow access
  return { included: true, requiredPlan: null, currentPlan: planCtx.planKey };
}

/**
 * Get current usage counts for an organization.
 */
export async function getUsageCounts(orgId: number | null): Promise<UsageCounts> {
  const empty: UsageCounts = { contacts: 0, meetingsThisMonth: 0, usersInOrg: 0, organizations: 0, storageUsedGb: 0 };
  if (!orgId) return empty;

  try {
    const db = await import("./db");

    // Count contacts
    let contacts = 0;
    try {
      const allContacts = await db.getAllContacts(orgId);
      contacts = allContacts.length;
    } catch { /* ignore */ }

    // Count meetings this month
    let meetingsThisMonth = 0;
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const allMeetings = await db.getAllMeetings({ orgId });
      meetingsThisMonth = allMeetings.filter(
        (m: any) => m.meetingDate && new Date(m.meetingDate) >= monthStart
      ).length;
    } catch { /* ignore */ }

    // Count users in org
    let usersInOrg = 0;
    let organizations = 0;
    try {
      const org = await db.getOrganizationById(orgId);
      if (org) {
        const memberships = await db.getOrgMembers(orgId);
        usersInOrg = memberships.length;
        const orgs = await db.getOrganizationsByAccount(org.accountId);
        organizations = orgs.length;
      }
    } catch { /* ignore */ }

    // Storage — approximate (we don't track file sizes yet)
    const storageUsedGb = 0; // TODO: implement when file storage tracking is added

    return { contacts, meetingsThisMonth, usersInOrg, organizations, storageUsedGb };
  } catch {
    return empty;
  }
}

/**
 * Check if a usage limit would be exceeded.
 * Returns null if OK, or an error message if limit would be exceeded.
 */
export async function checkUsageLimit(
  orgId: number | null,
  limitType: "contacts" | "meetings" | "users" | "organizations" | "storage"
): Promise<{ allowed: boolean; current: number; max: number; limitType: string }> {
  const planCtx = await resolvePlanForOrg(orgId);
  const usage = await getUsageCounts(orgId);

  const limitMap: Record<string, { current: number; max: number }> = {
    contacts: { current: usage.contacts, max: planCtx.limits.maxContacts },
    meetings: { current: usage.meetingsThisMonth, max: planCtx.limits.maxMeetingsPerMonth },
    users: { current: usage.usersInOrg, max: planCtx.limits.maxUsersPerOrg },
    organizations: { current: usage.organizations, max: planCtx.limits.maxOrganizations },
    storage: { current: usage.storageUsedGb, max: planCtx.limits.maxStorageGb },
  };

  const { current, max } = limitMap[limitType];

  // -1 means unlimited
  if (max === -1) {
    return { allowed: true, current, max, limitType };
  }

  return {
    allowed: current < max,
    current,
    max,
    limitType,
  };
}

/**
 * Enforce a feature gate. Throws TRPCError if feature is not included in plan.
 */
export async function enforceFeatureGate(orgId: number | null, featureKey: string): Promise<void> {
  const { included, requiredPlan, currentPlan } = await isFeatureIncludedInPlan(orgId, featureKey);
  
  if (!included) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `This feature requires the ${requiredPlan ? capitalize(requiredPlan) : "a higher"} plan. Your current plan is ${capitalize(currentPlan)}.`,
      cause: {
        type: "PLAN_UPGRADE_REQUIRED",
        currentPlan,
        requiredPlan,
        featureKey,
      },
    });
  }
}

/**
 * Enforce a usage limit. Throws TRPCError if limit would be exceeded.
 */
export async function enforceUsageLimit(
  orgId: number | null,
  limitType: "contacts" | "meetings" | "users" | "organizations" | "storage"
): Promise<void> {
  const result = await checkUsageLimit(orgId, limitType);
  
  if (!result.allowed) {
    const planCtx = await resolvePlanForOrg(orgId);
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You've reached the ${limitType} limit for your ${planCtx.planName} plan (${result.current}/${result.max}). Upgrade your plan to continue.`,
      cause: {
        type: "USAGE_LIMIT_EXCEEDED",
        currentPlan: planCtx.planKey,
        limitType,
        current: result.current,
        max: result.max,
      },
    });
  }
}

/**
 * Clear the plan cache for an org (call after plan changes).
 */
export function invalidatePlanCache(orgId?: number) {
  if (orgId) {
    planCache.delete(orgId);
  } else {
    planCache.clear();
  }
}

// Helper
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getStarterDefaults(): PlanContext {
  return {
    planKey: "starter",
    planTier: 0,
    planName: "Starter",
    accountId: 0,
    subscriptionId: null,
    subscriptionStatus: "active",
    limits: {
      maxContacts: 500,
      maxMeetingsPerMonth: 50,
      maxUsersPerOrg: 5,
      maxOrganizations: 1,
      maxStorageGb: 5,
    },
  };
}
