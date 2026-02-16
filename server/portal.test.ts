import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "junaid@omniscopex.ae",
    name: "Junaid Qureshi",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
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
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("Portal Router Tests", () => {
  describe("auth.me", () => {
    it("returns null for unauthenticated users", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.auth.me();
      expect(result).toBeNull();
    });

    it("returns user data for authenticated users", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.auth.me();
      expect(result).toBeDefined();
      expect(result?.email).toBe("user@example.com");
      expect(result?.name).toBe("Regular User");
      expect(result?.role).toBe("user");
    });

    it("returns admin role for admin users", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.auth.me();
      expect(result).toBeDefined();
      expect(result?.role).toBe("admin");
    });
  });

  describe("meetings.list", () => {
    it("requires authentication", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.meetings.list({})).rejects.toThrow();
    });

    it("returns meetings for authenticated users", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.meetings.list({});
      expect(Array.isArray(result)).toBe(true);
    });

    it("supports limit parameter", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.meetings.list({ limit: 5 });
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(5);
    });
  });

  describe("meetings.getById", () => {
    it("requires authentication", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.meetings.getById({ id: 1 })).rejects.toThrow();
    });

    it("returns meeting data with expected fields", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      try {
        const result = await caller.meetings.getById({ id: 1 });
        expect(result).toBeDefined();
        expect(result).toHaveProperty("id");
        expect(result).toHaveProperty("meetingDate");
        expect(result).toHaveProperty("primaryLead");
        expect(result).toHaveProperty("participants");
        expect(result).toHaveProperty("executiveSummary");
        expect(result).toHaveProperty("sourceType");
        expect(result).toHaveProperty("brandedReportUrl");
        
        // Verify participants is valid JSON array
        const participants = JSON.parse(result.participants);
        expect(Array.isArray(participants)).toBe(true);
      } catch (e: any) {
        // Meeting might not exist in test DB, which is acceptable
        expect(e.code).toBe("NOT_FOUND");
      }
    });

    it("throws NOT_FOUND for non-existent meeting", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.meetings.getById({ id: 999999 })).rejects.toThrow("Meeting not found");
    });
  });

  describe("tasks.list", () => {
    it("requires authentication", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.tasks.list({})).rejects.toThrow();
    });

    it("returns tasks for authenticated users", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.tasks.list({});
      expect(Array.isArray(result)).toBe(true);
    });

    it("supports status filter", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.tasks.list({ status: "open" });
      expect(Array.isArray(result)).toBe(true);
      result.forEach(task => {
        expect(task.status).toBe("open");
      });
    });
  });

  describe("tags.list", () => {
    it("requires authentication", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.tags.list({})).rejects.toThrow();
    });

    it("returns tags for authenticated users", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.tags.list({});
      expect(Array.isArray(result)).toBe(true);
    });

    it("filters by sector type", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.tags.list({ type: "sector" });
      expect(Array.isArray(result)).toBe(true);
      result.forEach(tag => {
        expect(tag.type).toBe("sector");
      });
    });

    it("filters by jurisdiction type", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.tags.list({ type: "jurisdiction" });
      expect(Array.isArray(result)).toBe(true);
      result.forEach(tag => {
        expect(tag.type).toBe("jurisdiction");
      });
    });
  });

  describe("analytics.dashboard", () => {
    it("requires authentication", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.analytics.dashboard()).rejects.toThrow();
    });

    it("returns dashboard metrics", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.analytics.dashboard();
      expect(result).toBeDefined();
      expect(result).toHaveProperty("totalMeetings");
      expect(result).toHaveProperty("meetingsToday");
      expect(result).toHaveProperty("meetingsThisWeek");
      expect(result).toHaveProperty("meetingsThisMonth");
      expect(result).toHaveProperty("uniqueParticipants");
      expect(result).toHaveProperty("uniqueOrganizations");
      expect(result).toHaveProperty("openTasks");
      expect(result).toHaveProperty("topSectors");
      expect(result).toHaveProperty("topJurisdictions");
      expect(result).toHaveProperty("recentMeetings");
    });
  });

  describe("admin router", () => {
    it("blocks non-admin users from getAllUsers", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.admin.getAllUsers()).rejects.toThrow("Admin access required");
    });

    it("allows admin users to getAllUsers", async () => {
      const ctx = createAdminContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.admin.getAllUsers();
      expect(Array.isArray(result)).toBe(true);
    });

    it("blocks non-admin users from inviting users", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.admin.inviteUser({ email: "test@example.com", role: "user" })
      ).rejects.toThrow("Admin access required");
    });

    it("blocks non-admin users from updating roles", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.admin.updateUserRole({ userId: 1, role: "admin" })
      ).rejects.toThrow("Admin access required");
    });
  });

  describe("recap.generate", () => {
    it("requires authentication", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.recap.generate({ meetingId: 1 })).rejects.toThrow();
    });

    it("generates recap with expected fields for existing meeting", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      try {
        const result = await caller.recap.generate({ meetingId: 1 });
        expect(result).toBeDefined();
        expect(result).toHaveProperty("subject");
        expect(result).toHaveProperty("htmlBody");
        expect(result).toHaveProperty("plainTextBody");
        // HTML should contain OmniScope branding
        expect(result.htmlBody).toContain("OmniScope");
        expect(result.htmlBody).toContain("ALL MARKETS. ONE SCOPE.");
      } catch (e: any) {
        // Meeting might not exist
        expect(e.message).toContain("Meeting not found");
      }
    });
  });

  describe("ask.ask", () => {
    it("requires authentication", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.ask.ask({ query: "test" })).rejects.toThrow();
    });
  });

  describe("ingestion.webhook", () => {
    it("rejects invalid data format", async () => {
      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.ingestion.webhook({ invalid: "data" })
      ).rejects.toThrow("Invalid intelligence data format");
    });
  });
});
