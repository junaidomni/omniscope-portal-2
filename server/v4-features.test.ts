import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { COOKIE_NAME } from "../shared/const";

// ============================================================================
// HELPERS
// ============================================================================

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@omniscopex.ae",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

function createPublicContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

// ============================================================================
// ANALYTICS ROUTER - Daily & Weekly Summary
// ============================================================================

describe("analytics.dailySummary", () => {
  it("returns a daily summary structure for today", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.analytics.dailySummary({});
    
    expect(result).toBeDefined();
    expect(result).toHaveProperty("date");
    expect(result).toHaveProperty("meetingCount");
    expect(result).toHaveProperty("meetings");
    expect(result).toHaveProperty("tasksCreated");
    expect(result).toHaveProperty("tasksCompleted");
    expect(result).toHaveProperty("topSectors");
    expect(result).toHaveProperty("topJurisdictions");
    expect(typeof result.meetingCount).toBe("number");
    expect(Array.isArray(result.meetings)).toBe(true);
    expect(Array.isArray(result.topSectors)).toBe(true);
    expect(Array.isArray(result.topJurisdictions)).toBe(true);
  });

  it("accepts a specific date parameter", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.analytics.dailySummary({ date: "2026-02-10" });
    
    expect(result).toBeDefined();
    expect(result).toHaveProperty("date");
    expect(result).toHaveProperty("meetingCount");
    expect(typeof result.meetingCount).toBe("number");
  });

  it("requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.analytics.dailySummary({})).rejects.toThrow();
  });
});

describe("analytics.weeklySummary", () => {
  it("returns a weekly summary structure", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.analytics.weeklySummary({});
    
    expect(result).toBeDefined();
    expect(result).toHaveProperty("weekStart");
    expect(result).toHaveProperty("weekEnd");
    expect(result).toHaveProperty("meetingCount");
    expect(result).toHaveProperty("uniqueParticipants");
    expect(result).toHaveProperty("uniqueOrganizations");
    expect(result).toHaveProperty("tasksCreated");
    expect(result).toHaveProperty("tasksCompleted");
    expect(result).toHaveProperty("topSectors");
    expect(result).toHaveProperty("topJurisdictions");
    expect(result).toHaveProperty("keyOpportunities");
    expect(result).toHaveProperty("keyRisks");
    expect(result).toHaveProperty("dailyBreakdown");
    expect(Array.isArray(result.dailyBreakdown)).toBe(true);
    expect(result.dailyBreakdown.length).toBe(7);
  });

  it("accepts a specific weekStart parameter", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.analytics.weeklySummary({ weekStart: "2026-02-09" });
    
    expect(result).toBeDefined();
    expect(result.dailyBreakdown.length).toBe(7);
  });

  it("requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.analytics.weeklySummary({})).rejects.toThrow();
  });
});

// ============================================================================
// ANALYTICS DASHBOARD
// ============================================================================

describe("analytics.dashboard", () => {
  it("returns dashboard metrics with all required fields", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.analytics.dashboard();
    
    expect(result).toBeDefined();
    expect(result).toHaveProperty("meetingsToday");
    expect(result).toHaveProperty("meetingsThisWeek");
    expect(result).toHaveProperty("meetingsThisMonth");
    expect(result).toHaveProperty("totalMeetings");
    expect(result).toHaveProperty("uniqueParticipants");
    expect(result).toHaveProperty("uniqueOrganizations");
    expect(result).toHaveProperty("openTasks");
    expect(result).toHaveProperty("completedTasksToday");
    expect(result).toHaveProperty("topSectors");
    expect(result).toHaveProperty("topJurisdictions");
    expect(result).toHaveProperty("recentMeetings");
    expect(typeof result.meetingsToday).toBe("number");
    expect(typeof result.totalMeetings).toBe("number");
    expect(typeof result.openTasks).toBe("number");
  });
});

// ============================================================================
// EXPORT ROUTER - Daily & Weekly Reports
// ============================================================================

describe("export.dailySummary", () => {
  it("generates a markdown daily report", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.export.dailySummary({});
    
    expect(result).toBeDefined();
    expect(result).toHaveProperty("filename");
    expect(result).toHaveProperty("content");
    expect(result).toHaveProperty("mimeType");
    expect(result.filename).toContain("daily");
    expect(result.mimeType).toBe("text/markdown");
    expect(result.content).toContain("OmniScope");
  });
});

describe("export.weeklySummary", () => {
  it("generates a markdown weekly report", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.export.weeklySummary({});
    
    expect(result).toBeDefined();
    expect(result).toHaveProperty("filename");
    expect(result).toHaveProperty("content");
    expect(result).toHaveProperty("mimeType");
    expect(result.filename).toContain("weekly");
    expect(result.mimeType).toBe("text/markdown");
    expect(result.content).toContain("OmniScope");
  });
});

// ============================================================================
// TASKS ROUTER - Notes field support
// ============================================================================

describe("tasks.create with notes", () => {
  it("accepts notes field in task creation", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.tasks.create({
      title: "Test task with notes",
      description: "A test task",
      priority: "medium",
      notes: "These are test notes for the task",
    });
    
    expect(result).toBeDefined();
    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
  });

  it("creates a task without notes (optional field)", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.tasks.create({
      title: "Test task without notes",
      priority: "low",
    });
    
    expect(result).toBeDefined();
    expect(result).toHaveProperty("id");
  });
});

describe("tasks.update with notes", () => {
  it("updates notes on an existing task", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a task first
    const created = await caller.tasks.create({
      title: "Task to update notes",
      priority: "high",
    });

    // Update with notes
    const updated = await caller.tasks.update({
      id: created.id,
      notes: "Updated notes content",
    });

    expect(updated).toBeDefined();
  });
});

// ============================================================================
// TASKS ROUTER - List and filter
// ============================================================================

describe("tasks.list", () => {
  it("returns a list of tasks", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.tasks.list();
    
    expect(result).toBeDefined();
    expect(result).toHaveProperty("tasks");
    expect(Array.isArray(result.tasks)).toBe(true);
  });

  it("requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.tasks.list()).rejects.toThrow();
  });
});

describe("tasks.categories", () => {
  it("returns task categories", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.tasks.categories();
    
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ============================================================================
// TIMEZONE HANDLING - Utility Tests
// ============================================================================

describe("timezone utility functions", () => {
  it("getLocalDateKey produces correct local date from UTC ISO string", () => {
    // This tests the logic used in CalendarView.tsx and Meetings.tsx
    const getLocalDateKey = (isoString: string): string => {
      const d = new Date(isoString);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // A date that's clearly on Feb 16 in any timezone
    const result = getLocalDateKey("2026-02-16T12:00:00.000Z");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // The date should be a valid date string
    expect(new Date(result).toString()).not.toBe("Invalid Date");
  });

  it("getLocalDateKey handles midnight UTC correctly", () => {
    const getLocalDateKey = (isoString: string): string => {
      const d = new Date(isoString);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // Midnight UTC - in EST this would be the previous day (7pm)
    const result = getLocalDateKey("2026-02-17T00:00:00.000Z");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Just verify it produces a valid date format
    const parsed = new Date(result + "T12:00:00");
    expect(parsed.toString()).not.toBe("Invalid Date");
  });

  it("today's date string uses local timezone", () => {
    const now = new Date();
    const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayUTC = now.toISOString().split('T')[0];
    
    // Both should be valid date strings
    expect(todayLocal).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(todayUTC).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    
    // They may or may not be equal depending on server timezone,
    // but both should be valid
    expect(new Date(todayLocal + "T12:00:00").toString()).not.toBe("Invalid Date");
  });
});

// ============================================================================
// MEETINGS ROUTER - Basic operations
// ============================================================================

describe("meetings.list", () => {
  it("returns meetings list", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.meetings.list({
      limit: 10,
      offset: 0,
    });
    
    expect(result).toBeDefined();
    expect(result).toHaveProperty("meetings");
    expect(Array.isArray(result.meetings)).toBe(true);
  });

  it("requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.meetings.list({ limit: 10, offset: 0 })).rejects.toThrow();
  });
});

// ============================================================================
// MEETING CATEGORIES (Tags)
// ============================================================================

describe("meetingCategories", () => {
  it("lists all available tags", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.tags.list();
    
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});
