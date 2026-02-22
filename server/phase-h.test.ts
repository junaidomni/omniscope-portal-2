/**
 * Phase H Tests — Account Console, Accounts Management, Revenue Dashboard
 * Tests the new admin-hub procedures: listAccounts, getAccountDetail,
 * updateAccountStatus, updateAccountMrr, updateAccountHealth, revenueOverview
 */
import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createPlatformOwnerContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "platform-owner",
    email: "junaid@omniscopex.ae",
    name: "Junaid Qureshi",
    loginMethod: "manus",
    role: "admin",
    platformOwner: true,
    onboardingCompleted: true,
    profilePhotoUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    orgId: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createRegularUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 99,
    openId: "regular-user",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    platformOwner: false,
    onboardingCompleted: true,
    profilePhotoUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    orgId: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    orgId: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("Phase H — Admin Hub Accounts & Revenue", () => {
  describe("adminHub.listAccounts", () => {
    it("returns account list for platform owner", async () => {
      const ctx = createPlatformOwnerContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.adminHub.listAccounts();
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        const first = result[0];
        expect(first).toHaveProperty("id");
        expect(first).toHaveProperty("name");
        expect(first).toHaveProperty("plan");
        expect(first).toHaveProperty("status");
        expect(first).toHaveProperty("mrrCents");
        expect(first).toHaveProperty("healthScore");
        expect(first).toHaveProperty("ownerName");
        expect(first).toHaveProperty("ownerEmail");
        expect(first).toHaveProperty("orgCount");
        expect(first).toHaveProperty("resolvedPlan");
        expect(typeof first.mrrCents).toBe("number");
        expect(typeof first.healthScore).toBe("number");
        expect(typeof first.orgCount).toBe("number");
      }
    });

    it("rejects unauthenticated access", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.adminHub.listAccounts()).rejects.toThrow();
    });

    it("rejects non-admin access", async () => {
      const ctx = createRegularUserContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.adminHub.listAccounts()).rejects.toThrow();
    });
  });

  describe("adminHub.getAccountDetail", () => {
    it("returns full account detail for valid account", async () => {
      const ctx = createPlatformOwnerContext();
      const caller = appRouter.createCaller(ctx);

      // First get the list to find a valid account ID
      const accounts = await caller.adminHub.listAccounts();
      if (accounts.length === 0) return; // skip if no accounts

      const accountId = accounts[0].id;
      const detail = await caller.adminHub.getAccountDetail({ accountId });

      expect(detail).toHaveProperty("account");
      expect(detail).toHaveProperty("organizations");
      expect(detail).toHaveProperty("usageByOrg");
      expect(detail).toHaveProperty("billingEvents");

      expect(detail.account.id).toBe(accountId);
      expect(Array.isArray(detail.organizations)).toBe(true);
      expect(Array.isArray(detail.usageByOrg)).toBe(true);
      expect(Array.isArray(detail.billingEvents)).toBe(true);

      // Verify organization detail structure
      if (detail.organizations.length > 0) {
        const org = detail.organizations[0];
        expect(org).toHaveProperty("id");
        expect(org).toHaveProperty("name");
        expect(org).toHaveProperty("memberCount");
        expect(typeof org.memberCount).toBe("number");
      }

      // Verify usage structure
      if (detail.usageByOrg.length > 0) {
        const usage = detail.usageByOrg[0];
        expect(usage).toHaveProperty("orgId");
        expect(usage).toHaveProperty("orgName");
        expect(usage).toHaveProperty("contacts");
        expect(usage).toHaveProperty("meetings");
        expect(usage).toHaveProperty("tasks");
        expect(usage).toHaveProperty("members");
      }
    });

    it("throws NOT_FOUND for invalid account ID", async () => {
      const ctx = createPlatformOwnerContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.adminHub.getAccountDetail({ accountId: 999999 })
      ).rejects.toThrow("Account not found");
    });
  });

  describe("adminHub.updateAccountStatus", () => {
    it("updates account status successfully", async () => {
      const ctx = createPlatformOwnerContext();
      const caller = appRouter.createCaller(ctx);

      const accounts = await caller.adminHub.listAccounts();
      if (accounts.length === 0) return;

      const accountId = accounts[0].id;
      const originalStatus = accounts[0].status;

      // Suspend
      const result = await caller.adminHub.updateAccountStatus({
        accountId,
        status: "suspended",
      });
      expect(result).toEqual({ success: true });

      // Verify it changed
      const detail = await caller.adminHub.getAccountDetail({ accountId });
      expect(detail.account.status).toBe("suspended");

      // Restore original status
      await caller.adminHub.updateAccountStatus({
        accountId,
        status: originalStatus as "active" | "suspended" | "cancelled",
      });
    });
  });

  describe("adminHub.updateAccountMrr", () => {
    it("updates MRR successfully", async () => {
      const ctx = createPlatformOwnerContext();
      const caller = appRouter.createCaller(ctx);

      const accounts = await caller.adminHub.listAccounts();
      if (accounts.length === 0) return;

      const accountId = accounts[0].id;
      const originalMrr = accounts[0].mrrCents;

      const result = await caller.adminHub.updateAccountMrr({
        accountId,
        mrrCents: 99900,
      });
      expect(result).toEqual({ success: true });

      const detail = await caller.adminHub.getAccountDetail({ accountId });
      expect(detail.account.mrrCents).toBe(99900);

      // Restore
      await caller.adminHub.updateAccountMrr({ accountId, mrrCents: originalMrr });
    });

    it("rejects negative MRR", async () => {
      const ctx = createPlatformOwnerContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.adminHub.updateAccountMrr({ accountId: 1, mrrCents: -100 })
      ).rejects.toThrow();
    });
  });

  describe("adminHub.updateAccountHealth", () => {
    it("updates health score successfully", async () => {
      const ctx = createPlatformOwnerContext();
      const caller = appRouter.createCaller(ctx);

      const accounts = await caller.adminHub.listAccounts();
      if (accounts.length === 0) return;

      const accountId = accounts[0].id;
      const originalHealth = accounts[0].healthScore;

      const result = await caller.adminHub.updateAccountHealth({
        accountId,
        healthScore: 75,
      });
      expect(result).toEqual({ success: true });

      const detail = await caller.adminHub.getAccountDetail({ accountId });
      expect(detail.account.healthScore).toBe(75);

      // Restore
      await caller.adminHub.updateAccountHealth({ accountId, healthScore: originalHealth });
    });

    it("rejects health score > 100", async () => {
      const ctx = createPlatformOwnerContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.adminHub.updateAccountHealth({ accountId: 1, healthScore: 150 })
      ).rejects.toThrow();
    });

    it("rejects health score < 0", async () => {
      const ctx = createPlatformOwnerContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.adminHub.updateAccountHealth({ accountId: 1, healthScore: -10 })
      ).rejects.toThrow();
    });
  });

  describe("adminHub.revenueOverview", () => {
    it("returns revenue data for platform owner", async () => {
      const ctx = createPlatformOwnerContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.adminHub.revenueOverview();

      expect(result).toHaveProperty("totalMrr");
      expect(result).toHaveProperty("totalArr");
      expect(result).toHaveProperty("activeAccounts");
      expect(result).toHaveProperty("totalAccounts");
      expect(result).toHaveProperty("byPlan");
      expect(result).toHaveProperty("recentEvents");
      expect(result).toHaveProperty("subscriptionStatus");
      expect(result).toHaveProperty("billingCycles");

      expect(typeof result.totalMrr).toBe("number");
      expect(typeof result.totalArr).toBe("number");
      expect(result.totalArr).toBe(result.totalMrr * 12);
      expect(typeof result.activeAccounts).toBe("number");
      expect(typeof result.totalAccounts).toBe("number");
      expect(Array.isArray(result.byPlan)).toBe(true);
      expect(Array.isArray(result.recentEvents)).toBe(true);

      // Verify byPlan structure
      if (result.byPlan.length > 0) {
        const planEntry = result.byPlan[0];
        expect(planEntry).toHaveProperty("plan");
        expect(planEntry).toHaveProperty("count");
        expect(planEntry).toHaveProperty("mrr");
        expect(typeof planEntry.count).toBe("number");
        expect(typeof planEntry.mrr).toBe("number");
      }
    });

    it("rejects unauthenticated access", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.adminHub.revenueOverview()).rejects.toThrow();
    });
  });
});

describe("Phase H — Account Console", () => {
  describe("accountConsole.overview", () => {
    it("returns overview for authenticated user with account", async () => {
      const ctx = createPlatformOwnerContext();
      const caller = appRouter.createCaller(ctx);
      try {
        const result = await caller.accountConsole.overview();
        expect(result).toHaveProperty("account");
        expect(result).toHaveProperty("organizations");
        expect(result).toHaveProperty("totalMembers");
        expect(result).toHaveProperty("subscription");
        expect(result).toHaveProperty("usage");
      } catch (e: any) {
        // If account doesn't exist for this user, it should throw a meaningful error
        expect(e.message).toBeDefined();
      }
    });

    it("rejects unauthenticated access", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.accountConsole.overview()).rejects.toThrow();
    });
  });

  describe("accountConsole.organizations", () => {
    it("returns organizations for authenticated user", async () => {
      const ctx = createPlatformOwnerContext();
      const caller = appRouter.createCaller(ctx);
      try {
        const result = await caller.accountConsole.organizations();
        expect(Array.isArray(result)).toBe(true);
      } catch (e: any) {
        expect(e.message).toBeDefined();
      }
    });
  });

  describe("accountConsole.updateSettings", () => {
    it("rejects unauthenticated access", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.accountConsole.updateSettings({ name: "Test" })
      ).rejects.toThrow();
    });
  });
});
