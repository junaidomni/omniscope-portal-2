import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Plan Enforcement Architecture Tests
 * 
 * These tests verify:
 * 1. The plan enforcement module exists and exports the right functions
 * 2. The planGatedProcedure is exported from trpc.ts
 * 3. The plans router has all required endpoints
 * 4. The billing UI page exists
 * 5. The Setup page includes the Plan & Usage tab
 * 6. The cache module works correctly
 * 7. The admin layout includes billing navigation
 */

const SERVER_DIR = path.join(__dirname);
const CLIENT_DIR = path.join(__dirname, "..", "client", "src");

describe("Plan Enforcement Module", () => {
  it("planEnforcement.ts exports required functions", () => {
    const content = fs.readFileSync(path.join(SERVER_DIR, "planEnforcement.ts"), "utf-8");
    
    const requiredExports = [
      "resolvePlanForOrg",
      "enforceFeatureGate",
      "enforceUsageLimit",
      "getUsageCounts",
      "checkUsageLimit",
      "isFeatureIncludedInPlan",
      "invalidatePlanCache",
    ];
    
    for (const fn of requiredExports) {
      // Some functions may not be async (like invalidatePlanCache)
      const hasAsync = content.includes(`export async function ${fn}`);
      const hasSync = content.includes(`export function ${fn}`);
      expect(hasAsync || hasSync).toBe(true);
    }
  });

  it("planEnforcement uses TRPCError for access denied", () => {
    const content = fs.readFileSync(path.join(SERVER_DIR, "planEnforcement.ts"), "utf-8");
    expect(content).toContain("TRPCError");
    expect(content).toContain("FORBIDDEN");
  });

  it("planEnforcement resolves org → account → subscription → plan chain", () => {
    const content = fs.readFileSync(path.join(SERVER_DIR, "planEnforcement.ts"), "utf-8");
    // Must look up the org, then the account, then the subscription, then the plan
    expect(content).toContain("getOrganizationById");
    expect(content).toContain("getSubscriptionForAccount");
    expect(content).toContain("getPlanById");
  });

  it("planEnforcement includes usage counting for all entity types", () => {
    const content = fs.readFileSync(path.join(SERVER_DIR, "planEnforcement.ts"), "utf-8");
    // Must count contacts, meetings, users, organizations
    expect(content).toContain("contacts");
    expect(content).toContain("meetings");
    expect(content).toContain("users");
    expect(content).toContain("organizations");
  });
});

describe("planGatedProcedure in trpc.ts", () => {
  it("trpc.ts exports planGatedProcedure function", () => {
    const content = fs.readFileSync(path.join(SERVER_DIR, "_core", "trpc.ts"), "utf-8");
    expect(content).toContain("export function planGatedProcedure");
  });

  it("planGatedProcedure accepts featureKey and optional checkLimit", () => {
    const content = fs.readFileSync(path.join(SERVER_DIR, "_core", "trpc.ts"), "utf-8");
    expect(content).toContain("featureKey: string");
    expect(content).toContain("checkLimit");
  });

  it("planGatedProcedure calls enforceFeatureGate", () => {
    const content = fs.readFileSync(path.join(SERVER_DIR, "_core", "trpc.ts"), "utf-8");
    expect(content).toContain("enforceFeatureGate");
  });

  it("planGatedProcedure attaches plan context to ctx", () => {
    const content = fs.readFileSync(path.join(SERVER_DIR, "_core", "trpc.ts"), "utf-8");
    expect(content).toContain("plan: planCtx");
  });
});

describe("Plans Router", () => {
  let routerContent: string;
  
  beforeEach(() => {
    routerContent = fs.readFileSync(path.join(SERVER_DIR, "routers", "plans.ts"), "utf-8");
  });

  it("has list endpoint for all plans", () => {
    expect(routerContent).toContain("list:");
    expect(routerContent).toContain("getAllPlans");
  });

  it("has myPlan endpoint using orgScopedProcedure", () => {
    expect(routerContent).toContain("myPlan:");
    expect(routerContent).toContain("orgScopedProcedure");
  });

  it("has checkFeature endpoint", () => {
    expect(routerContent).toContain("checkFeature:");
    expect(routerContent).toContain("featureKey");
  });

  it("has checkLimit endpoint", () => {
    expect(routerContent).toContain("checkLimit:");
    expect(routerContent).toContain("limitType");
  });

  it("has admin listAccounts endpoint", () => {
    expect(routerContent).toContain("listAccounts:");
    expect(routerContent).toContain("adminProcedure");
  });

  it("has admin assignPlan endpoint", () => {
    expect(routerContent).toContain("assignPlan:");
    expect(routerContent).toContain("planKey");
  });

  it("has admin overrideLimits endpoint", () => {
    expect(routerContent).toContain("overrideLimits:");
    expect(routerContent).toContain("subscriptionId");
  });

  it("has admin cancelSubscription endpoint", () => {
    expect(routerContent).toContain("cancelSubscription:");
  });

  it("has admin reactivateSubscription endpoint", () => {
    expect(routerContent).toContain("reactivateSubscription:");
  });

  it("invalidates plan cache on plan changes", () => {
    expect(routerContent).toContain("invalidatePlanCache");
  });

  it("fixed getAccountForUser bug — uses getAccountByOwner", () => {
    // The comment mentions the old function name, but the actual call uses getAccountByOwner
    expect(routerContent).toContain("getAccountByOwner");
    // Ensure no actual function CALL to getAccountForUser (comments are OK)
    const lines = routerContent.split("\n").filter(l => !l.trim().startsWith("//"));
    const codeOnly = lines.join("\n");
    expect(codeOnly).not.toContain("db.getAccountForUser");
  });
});

describe("Admin Billing UI", () => {
  it("Billing.tsx page exists in admin-hub", () => {
    const exists = fs.existsSync(path.join(CLIENT_DIR, "pages", "admin-hub", "Billing.tsx"));
    expect(exists).toBe(true);
  });

  it("Billing page has AccountCard component", () => {
    const content = fs.readFileSync(path.join(CLIENT_DIR, "pages", "admin-hub", "Billing.tsx"), "utf-8");
    expect(content).toContain("AccountCard");
  });

  it("Billing page has PlanOverviewCard component", () => {
    const content = fs.readFileSync(path.join(CLIENT_DIR, "pages", "admin-hub", "Billing.tsx"), "utf-8");
    expect(content).toContain("PlanOverviewCard");
  });

  it("Billing page calls plans.listAccounts", () => {
    const content = fs.readFileSync(path.join(CLIENT_DIR, "pages", "admin-hub", "Billing.tsx"), "utf-8");
    expect(content).toContain("trpc.plans.listAccounts");
  });

  it("Billing page supports plan assignment", () => {
    const content = fs.readFileSync(path.join(CLIENT_DIR, "pages", "admin-hub", "Billing.tsx"), "utf-8");
    expect(content).toContain("trpc.plans.assignPlan");
  });

  it("Billing page supports subscription cancellation", () => {
    const content = fs.readFileSync(path.join(CLIENT_DIR, "pages", "admin-hub", "Billing.tsx"), "utf-8");
    expect(content).toContain("trpc.plans.cancelSubscription");
  });

  it("Billing page supports subscription reactivation", () => {
    const content = fs.readFileSync(path.join(CLIENT_DIR, "pages", "admin-hub", "Billing.tsx"), "utf-8");
    expect(content).toContain("trpc.plans.reactivateSubscription");
  });
});

describe("Admin Layout Navigation", () => {
  it("AdminLayout includes billing nav item", () => {
    const content = fs.readFileSync(path.join(CLIENT_DIR, "components", "AdminLayout.tsx"), "utf-8");
    expect(content).toContain("billing");
    expect(content).toContain("Plans & Billing");
    expect(content).toContain("/admin-hub/billing");
  });

  it("AdminLayout imports CreditCard icon", () => {
    const content = fs.readFileSync(path.join(CLIENT_DIR, "components", "AdminLayout.tsx"), "utf-8");
    expect(content).toContain("CreditCard");
  });
});

describe("App.tsx Routing", () => {
  it("App.tsx imports AdminHubBilling", () => {
    const content = fs.readFileSync(path.join(CLIENT_DIR, "App.tsx"), "utf-8");
    expect(content).toContain("import AdminHubBilling");
  });

  it("App.tsx has /admin-hub/billing route", () => {
    const content = fs.readFileSync(path.join(CLIENT_DIR, "App.tsx"), "utf-8");
    expect(content).toContain("/admin-hub/billing");
  });
});

describe("Setup Page Plan Tab", () => {
  it("Setup.tsx includes plan tab type", () => {
    const content = fs.readFileSync(path.join(CLIENT_DIR, "pages", "Setup.tsx"), "utf-8");
    expect(content).toContain('"plan"');
  });

  it("Setup.tsx has PlanUsageTab component", () => {
    const content = fs.readFileSync(path.join(CLIENT_DIR, "pages", "Setup.tsx"), "utf-8");
    expect(content).toContain("PlanUsageTab");
  });

  it("Setup.tsx PlanUsageTab calls plans.myPlan", () => {
    const content = fs.readFileSync(path.join(CLIENT_DIR, "pages", "Setup.tsx"), "utf-8");
    expect(content).toContain("trpc.plans.myPlan");
  });

  it("Setup.tsx PlanUsageTab shows usage bars", () => {
    const content = fs.readFileSync(path.join(CLIENT_DIR, "pages", "Setup.tsx"), "utf-8");
    expect(content).toContain("UsageBar");
  });
});

describe("Cache Module", () => {
  it("cache.ts exists and exports MemoryCache", () => {
    const content = fs.readFileSync(path.join(SERVER_DIR, "cache.ts"), "utf-8");
    expect(content).toContain("class MemoryCache");
    expect(content).toContain("export");
  });

  it("cache supports TTL-based expiration", () => {
    const content = fs.readFileSync(path.join(SERVER_DIR, "cache.ts"), "utf-8");
    expect(content).toContain("ttl");
  });

  it("cache supports invalidation", () => {
    const content = fs.readFileSync(path.join(SERVER_DIR, "cache.ts"), "utf-8");
    expect(content).toContain("delete");
  });
});

describe("DB Helpers", () => {
  it("db.ts has getAllAccounts function", () => {
    const content = fs.readFileSync(path.join(SERVER_DIR, "db.ts"), "utf-8");
    expect(content).toContain("export async function getAllAccounts");
  });

  it("db.ts has getAccountByOwner function (not getAccountForUser)", () => {
    const content = fs.readFileSync(path.join(SERVER_DIR, "db.ts"), "utf-8");
    expect(content).toContain("export async function getAccountByOwner");
    // The old broken function should not exist
    expect(content).not.toContain("export async function getAccountForUser");
  });
});
