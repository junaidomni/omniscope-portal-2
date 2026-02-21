import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

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

describe("Meetings - Bulk Delete", () => {
  it("should have a bulkDelete procedure on the meetings router", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // The procedure should exist and be callable
    expect(typeof caller.meetings.bulkDelete).toBe("function");
  });

  it("should reject bulk delete with empty ids array", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.meetings.bulkDelete({ ids: [] })
    ).rejects.toThrow();
  });

  it("should handle bulk delete with non-existent meeting ids gracefully", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Non-existent IDs should not throw - they just won't delete anything
    const result = await caller.meetings.bulkDelete({ ids: [999999, 999998, 999997] });
    
    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("deleted");
    expect(result).toHaveProperty("total", 3);
    expect(typeof result.deleted).toBe("number");
  });

  it("should return correct count structure from bulk delete", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.meetings.bulkDelete({ ids: [888888] });
    
    expect(result.success).toBe(true);
    expect(result.total).toBe(1);
    // deleted could be 0 or 1 depending on whether the meeting exists
    expect(result.deleted).toBeGreaterThanOrEqual(0);
    expect(result.deleted).toBeLessThanOrEqual(1);
  });

  it("should require authentication for bulk delete", async () => {
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
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.meetings.bulkDelete({ ids: [1, 2, 3] })
    ).rejects.toThrow();
  });

  it("should validate that ids must be numbers", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // TypeScript would prevent this, but runtime validation should catch it
    await expect(
      // @ts-expect-error - testing runtime validation
      caller.meetings.bulkDelete({ ids: ["not-a-number"] })
    ).rejects.toThrow();
  });

  it("should validate minimum array length of 1", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.meetings.bulkDelete({ ids: [] })
    ).rejects.toThrow();
  });
});

describe("Meetings - Single Delete (existing)", () => {
  it("should have a delete procedure on the meetings router", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    expect(typeof caller.meetings.delete).toBe("function");
  });

  it("should require authentication for single delete", async () => {
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
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.meetings.delete({ id: 1 })
    ).rejects.toThrow();
  });
});
