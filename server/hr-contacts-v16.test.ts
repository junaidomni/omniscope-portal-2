import { describe, it, expect, vi } from "vitest";
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
    orgId: 1, // Add orgId so plan resolution works
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

// ============================================================================
// EMPLOYEES (HR) ROUTER TESTS
// ============================================================================

describe("employees router", () => {
  it("creates an employee and retrieves it", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const { id } = await caller.employees.create({
      firstName: "Test",
      lastName: "Employee",
      email: "test.employee@omniscope.ae",
      phone: "+971501234567",
      hireDate: "2025-01-15",
      jobTitle: "Software Engineer",
      department: "Engineering",
      employmentType: "full_time",
      salary: "5000",
      payFrequency: "monthly",
      currency: "USD",
    });

    expect(id).toBeGreaterThan(0);

    const emp = await caller.employees.getById({ id });
    expect(emp.firstName).toBe("Test");
    expect(emp.lastName).toBe("Employee");
    expect(emp.email).toBe("test.employee@omniscope.ae");
    expect(emp.jobTitle).toBe("Software Engineer");
    expect(emp.department).toBe("Engineering");

    // Clean up
    await caller.employees.delete({ id });
  });

  it("lists employees with optional filters", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const { id } = await caller.employees.create({
      firstName: "List",
      lastName: "TestEmp",
      email: "list.test@omniscope.ae",
      hireDate: "2025-06-01",
      jobTitle: "Analyst",
      department: "Operations",
    });

    const all = await caller.employees.list();
    const found = all.find((e: any) => e.id === id);
    expect(found).toBeDefined();

    const filtered = await caller.employees.list({ department: "Operations" });
    const foundFiltered = filtered.find((e: any) => e.id === id);
    expect(foundFiltered).toBeDefined();

    // Clean up
    await caller.employees.delete({ id });
  });

  it("updates an employee", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const { id } = await caller.employees.create({
      firstName: "Update",
      lastName: "TestEmp",
      email: "update.test@omniscope.ae",
      hireDate: "2025-03-01",
      jobTitle: "Junior Dev",
    });

    await caller.employees.update({
      id,
      jobTitle: "Senior Dev",
      department: "Engineering",
      salary: "8000",
    });

    const updated = await caller.employees.getById({ id });
    expect(updated.jobTitle).toBe("Senior Dev");
    expect(updated.department).toBe("Engineering");

    // Clean up
    await caller.employees.delete({ id });
  });

  it("searches employees by name or email", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const { id } = await caller.employees.create({
      firstName: "Searchable",
      lastName: "Person",
      email: "searchable@omniscope.ae",
      hireDate: "2025-01-01",
      jobTitle: "QA",
    });

    const results = await caller.employees.search({ query: "Searchable" });
    const found = results.find((e: any) => e.id === id);
    expect(found).toBeDefined();

    // Clean up
    await caller.employees.delete({ id });
  });

  it("gets departments list", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const departments = await caller.employees.departments();
    expect(Array.isArray(departments)).toBe(true);
  });
});

// ============================================================================
// PAYROLL ROUTER TESTS
// ============================================================================

describe("payroll router", () => {
  it("creates a payroll record and retrieves it", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create employee first
    const { id: empId } = await caller.employees.create({
      firstName: "Payroll",
      lastName: "TestEmp",
      email: "payroll.test@omniscope.ae",
      hireDate: "2025-01-01",
      jobTitle: "Accountant",
    });

    const { id } = await caller.payroll.create({
      employeeId: empId,
      payPeriodStart: "2025-01-01",
      payPeriodEnd: "2025-01-31",
      amount: "5000",
      currency: "USD",
      paymentMethod: "bank_transfer",
      notes: "January salary",
    });

    expect(id).toBeGreaterThan(0);

    const records = await caller.payroll.list();
    const found = records.find((r: any) => r.id === id);
    expect(found).toBeDefined();
    expect(found?.amount).toBe("5000");

    // Clean up
    await caller.payroll.delete({ id });
    await caller.employees.delete({ id: empId });
  });

  it("updates payroll status to paid", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const { id: empId } = await caller.employees.create({
      firstName: "PayStatus",
      lastName: "TestEmp",
      email: "paystatus.test@omniscope.ae",
      hireDate: "2025-01-01",
      jobTitle: "Dev",
    });

    const { id } = await caller.payroll.create({
      employeeId: empId,
      payPeriodStart: "2025-02-01",
      payPeriodEnd: "2025-02-28",
      amount: "6000",
      currency: "USD",
    });

    await caller.payroll.update({
      id,
      status: "paid",
      paymentDate: "2025-02-28",
    });

    const records = await caller.payroll.list({ status: "paid" });
    const found = records.find((r: any) => r.id === id);
    expect(found).toBeDefined();
    expect(found?.status).toBe("paid");

    // Clean up
    await caller.payroll.delete({ id });
    await caller.employees.delete({ id: empId });
  });
});

// ============================================================================
// HR DOCUMENTS ROUTER TESTS
// ============================================================================

describe("hrDocuments router", () => {
  it("lists documents (empty initially for a new employee)", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const { id: empId } = await caller.employees.create({
      firstName: "Doc",
      lastName: "TestEmp",
      email: "doc.test@omniscope.ae",
      hireDate: "2025-01-01",
      jobTitle: "HR",
    });

    const docs = await caller.hrDocuments.list({ employeeId: empId });
    expect(Array.isArray(docs)).toBe(true);

    // Clean up
    await caller.employees.delete({ id: empId });
  });
});

// ============================================================================
// ENHANCED CONTACTS TESTS
// ============================================================================

describe("enhanced contacts", () => {
  it("creates a contact with category and toggles star", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const { id } = await caller.contacts.create({
      name: "Starred Test Contact",
      category: "client",
    });

    // Toggle star on
    await caller.contacts.toggleStar({ id });
    let profile = await caller.contacts.getProfile({ id });
    expect(profile.starred).toBe(true);

    // Toggle star off
    await caller.contacts.toggleStar({ id });
    profile = await caller.contacts.getProfile({ id });
    expect(profile.starred).toBe(false);

    // Clean up
    await caller.contacts.delete({ id });
  });

  it("adds and retrieves notes for a contact", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const { id } = await caller.contacts.create({
      name: "Notes Test Contact",
    });

    await caller.contacts.addNote({
      contactId: id,
      content: "First meeting went well, interested in BTC OTC desk.",
    });

    await caller.contacts.addNote({
      contactId: id,
      content: "Follow up scheduled for next week.",
    });

    const notes = await caller.contacts.getNotes({ contactId: id });
    expect(notes.length).toBe(2);
    // Notes may be in any order, just verify both exist
    const contents = notes.map((n: any) => n.content);
    expect(contents.some((c: string) => c.includes("Follow up"))).toBe(true);
    expect(contents.some((c: string) => c.includes("First meeting"))).toBe(true);

    // Delete a note
    await caller.contacts.deleteNote({ id: notes[0].id });
    const notesAfter = await caller.contacts.getNotes({ contactId: id });
    expect(notesAfter.length).toBe(1);

    // Clean up
    await caller.contacts.deleteNote({ id: notesAfter[0].id });
    await caller.contacts.delete({ id });
  });

  it("detects duplicate contacts", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const { id: id1 } = await caller.contacts.create({ name: "John Smith Duplicate" });
    const { id: id2 } = await caller.contacts.create({ name: "John Smith Duplicate" });

    const duplicates = await caller.contacts.detectDuplicates();
    // Should find at least one duplicate group
    const found = duplicates.some((d: any) =>
      d.group.some((c: any) => c.id === id1) && d.group.some((c: any) => c.id === id2)
    );
    expect(found).toBe(true);

    // Clean up
    await caller.contacts.delete({ id: id1 });
    await caller.contacts.delete({ id: id2 });
  });

  it("merges two contacts", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const { id: keepId } = await caller.contacts.create({
      name: "Keep Contact",
      email: "keep@test.com",
    });
    const { id: mergeId } = await caller.contacts.create({
      name: "Merge Contact",
      phone: "+1234567890",
      organization: "Merge Corp",
    });

    const result = await caller.contacts.mergeContacts({ keepId, mergeId });
    expect(result.success).toBe(true);

    // Verify the kept contact has merged fields
    const kept = await caller.contacts.getProfile({ id: keepId });
    expect(kept.phone).toBe("+1234567890");
    expect(kept.organization).toBe("Merge Corp");

    // Clean up
    await caller.contacts.delete({ id: keepId });
  });

  it("updates contact category", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const { id } = await caller.contacts.create({
      name: "Category Test",
      category: "prospect",
    });

    await caller.contacts.update({ id, category: "client" });
    const profile = await caller.contacts.getProfile({ id });
    expect(profile.category).toBe("client");

    // Clean up
    await caller.contacts.delete({ id });
  });
});

// ============================================================================
// AI INSIGHTS ROUTER TESTS
// ============================================================================

describe("aiInsights router", () => {
  it("returns follow-up reminders array", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const reminders = await caller.aiInsights.followUpReminders();
    expect(Array.isArray(reminders)).toBe(true);
  });

  it("returns upcoming birthdays array", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const birthdays = await caller.aiInsights.upcomingBirthdays();
    expect(Array.isArray(birthdays)).toBe(true);
  });
});
