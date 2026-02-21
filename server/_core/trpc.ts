import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

/**
 * Org-scoped procedure: requires authenticated user + selected org.
 * Provides ctx.orgId as a non-null number for all downstream logic.
 * Falls back gracefully when no org is selected (returns orgId as null)
 * so that "All Organizations" view still works.
 */
const requireUserWithOrg = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      orgId: ctx.orgId, // null when "All Organizations" is selected
    },
  });
});

export const orgScopedProcedure = t.procedure.use(requireUserWithOrg);

/**
 * Feature-gated procedure factory.
 * Usage: featureGatedProcedure("email").query(...)
 * Checks if the feature toggle is enabled for the current org before executing.
 */
export function featureGatedProcedure(featureKey: string) {
  return orgScopedProcedure.use(async (opts) => {
    const { ctx, next } = opts;
    // Lazy import to avoid circular dependency
    const { getFeatureToggle } = await import("../db");
    const toggle = await getFeatureToggle(featureKey, ctx.orgId ?? undefined);
    if (toggle && !toggle.enabled) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Feature "${featureKey}" is not enabled for this organization.`,
      });
    }
    // If toggle doesn't exist, allow access (feature not gated)
    return next({ ctx });
  });
}

/**
 * Plan-gated procedure factory.
 * Usage: planGatedProcedure("ai_insights").query(...)
 * Checks if the feature is included in the org's subscription plan.
 * Optionally checks usage limits before allowing mutations.
 */
export function planGatedProcedure(
  featureKey: string,
  options?: { checkLimit?: "contacts" | "meetings" | "users" | "organizations" | "storage" }
) {
  return orgScopedProcedure.use(async (opts) => {
    const { ctx, next } = opts;
    // Lazy import to avoid circular dependency
    const { enforceFeatureGate, enforceUsageLimit, resolvePlanForOrg } = await import("../planEnforcement");
    
    // Check feature access against plan
    await enforceFeatureGate(ctx.orgId, featureKey);
    
    // Check usage limit if specified
    if (options?.checkLimit) {
      await enforceUsageLimit(ctx.orgId, options.checkLimit);
    }
    
    // Resolve plan context and attach to ctx
    const planCtx = await resolvePlanForOrg(ctx.orgId);
    
    return next({
      ctx: {
        ...ctx,
        plan: planCtx,
      },
    });
  });
}

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

/**
 * Platform Owner procedure: requires authenticated user with platformOwner = true.
 * Bypasses orgId filtering — can view and manage all accounts on the platform.
 * Use this for super-admin routes that need cross-org visibility.
 */
const requirePlatformOwner = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  if (!ctx.user.platformOwner) {
    throw new TRPCError({ 
      code: "FORBIDDEN", 
      message: "This action requires platform owner access. Contact support if you believe this is an error." 
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      isPlatformOwner: true, // Flag for downstream logic
    },
  });
});

export const platformOwnerProcedure = t.procedure.use(requirePlatformOwner);

/**
 * Helper function to check if a user is a platform owner.
 * Use this in conditional logic where you need to bypass orgId filtering.
 */
export function isSuperAdmin(user: TrpcContext["user"]): boolean {
  return user?.platformOwner === true;
}
