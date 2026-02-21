import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock planEnforcement to bypass plan gating in tests
vi.mock("./planEnforcement", () => ({
  resolvePlanForOrg: vi.fn().mockResolvedValue({
    planKey: "professional",
    planName: "Professional",
    planTier: 1,
    limits: { maxOrganizations: 3, maxUsersPerOrg: 10, maxContacts: 5000, maxMeetingsPerMonth: 200, maxStorageGb: 25 },
    features: ["ai_insights", "email", "integrations"],
  }),
  enforceFeatureGate: vi.fn().mockResolvedValue(undefined),
  enforceUsageLimit: vi.fn().mockResolvedValue(undefined),
  checkUsageLimit: vi.fn().mockResolvedValue({ allowed: true, current: 0, max: 5000, limitType: "contacts" }),
  isFeatureIncludedInPlan: vi.fn().mockResolvedValue({ included: true, requiredPlan: null, currentPlan: "professional" }),
  getUsageCounts: vi.fn().mockResolvedValue({ contacts: 0, meetingsThisMonth: 0, usersInOrg: 1, organizations: 1, storageUsedGb: 0 }),
  invalidatePlanCache: vi.fn(),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@omniscope.ae",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    orgId: 1,
    req: {
      protocol: "https",
      headers: { "x-org-id": "1" },
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("contacts router", () => {
  it("creates a contact and retrieves it", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const { id } = await caller.contacts.create({
      name: "Test Contact Vitest",
      email: "vitest@test.com",
      phone: "+1234567890",
      organization: "Test Corp",
      title: "CEO",
    });

    expect(id).toBeGreaterThan(0);

    const contact = await caller.contacts.getById({ id });
    expect(contact.name).toBe("Test Contact Vitest");
    expect(contact.email).toBe("vitest@test.com");
    expect(contact.organization).toBe("Test Corp");

    // Clean up
    await caller.contacts.delete({ id });
  });

  it("updates contact with new fields (dateOfBirth, address, website, linkedin)", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const { id } = await caller.contacts.create({
      name: "Update Test Contact",
    });

    await caller.contacts.update({
      id,
      email: "updated@test.com",
      dateOfBirth: "01/15/1990",
      address: "123 Test St, Dubai, UAE",
      website: "https://test.com",
      linkedin: "https://linkedin.com/in/test",
    });

    const profile = await caller.contacts.getProfile({ id });
    expect(profile.email).toBe("updated@test.com");
    expect(profile.dateOfBirth).toBe("01/15/1990");
    expect(profile.address).toBe("123 Test St, Dubai, UAE");
    expect(profile.website).toBe("https://test.com");
    expect(profile.linkedin).toBe("https://linkedin.com/in/test");

    // Clean up
    await caller.contacts.delete({ id });
  });

  it("lists contacts with enriched data", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const { id } = await caller.contacts.create({
      name: "List Test Contact",
      organization: "List Corp",
    });

    const list = await caller.contacts.list();
    const found = list.find((c: any) => c.id === id);
    expect(found).toBeDefined();
    expect(found?.meetingCount).toBeDefined();

    // Clean up
    await caller.contacts.delete({ id });
  });

  it("syncFromMeetings returns result", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.contacts.syncFromMeetings();
    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("linked");
    expect(result).toHaveProperty("meetings");
  });
});

describe("tasks router", () => {
  it("creates and deletes a task", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const { id } = await caller.tasks.create({
      title: "Vitest Task",
      priority: "high",
      assignedName: "Junaid",
    });

    expect(id).toBeGreaterThan(0);

    const task = await caller.tasks.getById({ id });
    expect(task.title).toBe("Vitest Task");
    expect(task.assignedName).toBe("Junaid");

    await caller.tasks.delete({ id });
  });

  it("bulk deletes multiple tasks", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const { id: id1 } = await caller.tasks.create({ title: "Bulk Delete 1" });
    const { id: id2 } = await caller.tasks.create({ title: "Bulk Delete 2" });
    const { id: id3 } = await caller.tasks.create({ title: "Bulk Delete 3" });

    const result = await caller.tasks.bulkDelete({ ids: [id1, id2, id3] });
    expect(result.success).toBe(true);
    expect(result.deleted).toBe(3);
  });

  it("updates task status and assignee", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const { id } = await caller.tasks.create({
      title: "Status Test Task",
      assignedName: "Kyle",
    });

    await caller.tasks.update({
      id,
      status: "in_progress",
      assignedName: "Jake",
    });

    const updated = await caller.tasks.getById({ id });
    expect(updated.status).toBe("in_progress");
    expect(updated.assignedName).toBe("Jake");

    // Clean up
    await caller.tasks.delete({ id });
  });
});
