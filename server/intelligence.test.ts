import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(user?: Partial<AuthenticatedUser>): TrpcContext {
  const defaultUser: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@omniscopex.ae",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...user,
  };

  return {
    user: defaultUser,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Intelligence Portal - Meetings", () => {
  it("should list meetings for authenticated users", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.meetings.list();
    
    expect(Array.isArray(result)).toBe(true);
  });

  it("should search meetings by query", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.meetings.search({ query: "test", limit: 10 });
    
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Intelligence Portal - Tasks", () => {
  it("should list tasks for authenticated users", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.tasks.list();
    
    expect(Array.isArray(result)).toBe(true);
  });

  it("should filter tasks by status", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.tasks.list({ status: "open" });
    
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Intelligence Portal - Tags", () => {
  it("should list all tags", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.tags.list();
    
    expect(Array.isArray(result)).toBe(true);
  });

  it("should filter tags by type", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const sectorTags = await caller.tags.list({ type: "sector" });
    const jurisdictionTags = await caller.tags.list({ type: "jurisdiction" });
    
    expect(Array.isArray(sectorTags)).toBe(true);
    expect(Array.isArray(jurisdictionTags)).toBe(true);
  });
});

describe("Intelligence Portal - Data Ingestion", () => {
  it("should accept valid intelligence data through webhook", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const testData = {
      meetingDate: new Date().toISOString(),
      primaryLead: "Kyle",
      participants: ["Kyle", "Client A"],
      organizations: ["Test Corp"],
      jurisdictions: ["UAE"],
      executiveSummary: "Test meeting summary",
      strategicHighlights: ["Key point 1", "Key point 2"],
      opportunities: ["Opportunity 1"],
      risks: ["Risk 1"],
      keyQuotes: ["Important quote"],
      fullTranscript: "Full meeting transcript here",
      sourceType: "plaud" as const,
      sourceId: `test-${Date.now()}`,
      sectors: ["OTC Liquidity"],
      jurisdictionTags: ["UAE"],
      actionItems: [
        "Follow up with client - Send proposal by Friday",
      ],
    };

    const result = await caller.ingestion.webhook(testData);
    
    expect(result.success).toBe(true);
    expect(result.meetingId).toBeDefined();
  });

  it("should reject invalid intelligence data", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const invalidData = {
      // Missing required fields
      meetingDate: new Date().toISOString(),
    };

    await expect(caller.ingestion.webhook(invalidData)).rejects.toThrow();
  });

  it("should detect duplicate meetings by sourceId", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const sourceId = `duplicate-test-${Date.now()}`;
    
    const testData = {
      meetingDate: new Date().toISOString(),
      primaryLead: "Kyle",
      participants: ["Kyle", "Client B"],
      executiveSummary: "Duplicate test meeting",
      sourceType: "plaud" as const,
      sourceId,
    };

    // First submission should succeed
    const result1 = await caller.ingestion.webhook(testData);
    expect(result1.success).toBe(true);

    // Second submission with same sourceId should be detected as duplicate
    const result2 = await caller.ingestion.webhook(testData);
    expect(result2.success).toBe(false);
    expect(result2.reason).toBe("duplicate");
  });
});

describe("Intelligence Portal - Authentication", () => {
  it("should return current user for authenticated requests", async () => {
    const ctx = createAuthContext({ name: "Test Admin", role: "admin" });
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();
    
    expect(result).toBeDefined();
    expect(result?.name).toBe("Test Admin");
    expect(result?.role).toBe("admin");
  });

  it("should handle logout correctly", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();
    
    expect(result.success).toBe(true);
  });
});
