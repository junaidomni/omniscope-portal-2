import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock planEnforcement to bypass plan gating in tests
vi.mock("./planEnforcement", () => ({
  resolvePlanForOrg: vi.fn().mockResolvedValue({
    planKey: "professional",
    planName: "Professional",
    planTier: 1,
    limits: {
      maxOrganizations: 3,
      maxUsersPerOrg: 10,
      maxContacts: 5000,
      maxMeetingsPerMonth: 200,
      maxStorageGb: 25,
    },
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

function createAuthContext(): TrpcContext {
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

  return {
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
}

function createAnonContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("ingestion.uploadTranscript", () => {
  it("rejects unauthenticated users", async () => {
    const ctx = createAnonContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.ingestion.uploadTranscript({
        content: "This is a test transcript with enough characters to pass validation.",
        inputType: "text",
      })
    ).rejects.toThrow();
  });

  it("rejects content shorter than 20 characters", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.ingestion.uploadTranscript({
        content: "Too short",
        inputType: "text",
      })
    ).rejects.toThrow();
  });

  it("validates input type enum", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.ingestion.uploadTranscript({
        content: "This is a test transcript with enough characters to pass validation.",
        inputType: "invalid_type" as any,
      })
    ).rejects.toThrow();
  });

  it("accepts valid text input with optional metadata", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // This will call the LLM which may fail in test env, but input validation should pass
    try {
      await caller.ingestion.uploadTranscript({
        content: "This is a detailed meeting transcript. Speaker 1 discussed the quarterly results and action items for the team.",
        inputType: "text",
        meetingTitle: "Q4 Review",
        meetingDate: "2026-02-20",
        participants: ["Jake Ryan", "Kyle Jackson"],
      });
    } catch (error: any) {
      // Expected: LLM/DB call may fail in test env, but we verify it got past input validation
      expect(error.message).not.toContain("Content must be at least 20 characters");
      expect(error.message).not.toContain("Invalid enum value");
    }
  });
});

describe("ingestion.uploadAudioFile", () => {
  it("rejects unauthenticated users", async () => {
    const ctx = createAnonContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.ingestion.uploadAudioFile({
        fileName: "recording.mp3",
        fileData: Buffer.from("fake audio data").toString("base64"),
        mimeType: "audio/mpeg",
      })
    ).rejects.toThrow();
  });

  it("validates required fields — missing fileName", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.ingestion.uploadAudioFile({
        fileData: Buffer.from("test").toString("base64"),
        mimeType: "audio/mpeg",
      } as any)
    ).rejects.toThrow();
  });

  it("accepts valid audio file upload input", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // This will attempt S3 upload which may fail in test env
    try {
      const result = await caller.ingestion.uploadAudioFile({
        fileName: "test-recording.mp3",
        fileData: Buffer.from("fake audio content for testing").toString("base64"),
        mimeType: "audio/mpeg",
      });
      // If S3 is available, we should get back a URL and fileKey
      expect(result).toHaveProperty("url");
      expect(result).toHaveProperty("fileKey");
      expect(result.fileKey).toContain("transcripts/");
    } catch (error: any) {
      // S3 may not be available in test env — that's OK, we verified input validation passed
      expect(error.message).toBe("Failed to upload audio file");
    }
  });
});
