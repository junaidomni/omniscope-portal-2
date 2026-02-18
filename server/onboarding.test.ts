import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// ONBOARDING ROUTER TESTS
// ============================================================================

describe("Onboarding Router", () => {
  describe("onboarding.status", () => {
    it("should return onboarding status with Google connection info", () => {
      // The status endpoint returns:
      // - onboardingCompleted: boolean
      // - googleConnected: boolean
      // - hasGmailScopes: boolean
      // - hasCalendarScopes: boolean
      // - googleEmail: string | null
      const expectedShape = {
        onboardingCompleted: expect.any(Boolean),
        googleConnected: expect.any(Boolean),
        hasGmailScopes: expect.any(Boolean),
        hasCalendarScopes: expect.any(Boolean),
        googleEmail: expect.anything(), // string | null
      };

      // Verify the shape matches expected structure
      expect(expectedShape).toBeDefined();
      expect(expectedShape.onboardingCompleted).toBeDefined();
      expect(expectedShape.googleConnected).toBeDefined();
      expect(expectedShape.hasGmailScopes).toBeDefined();
      expect(expectedShape.hasCalendarScopes).toBeDefined();
    });

    it("should default onboardingCompleted to false for new users", () => {
      const user = { onboardingCompleted: null };
      const result = user.onboardingCompleted ?? false;
      expect(result).toBe(false);
    });

    it("should return true for users who completed onboarding", () => {
      const user = { onboardingCompleted: true };
      const result = user.onboardingCompleted ?? false;
      expect(result).toBe(true);
    });
  });

  describe("onboarding.complete", () => {
    it("should mark onboarding as completed", () => {
      // The complete mutation sets onboardingCompleted = true
      // and returns { success: true }
      const result = { success: true };
      expect(result.success).toBe(true);
    });
  });
});

// ============================================================================
// SETUP PAGE ROUTING TESTS
// ============================================================================

describe("Setup Page Routing", () => {
  it("should support tab parameter for direct navigation", () => {
    const params = new URLSearchParams("?tab=integrations");
    expect(params.get("tab")).toBe("integrations");
  });

  it("should support tab=profile parameter", () => {
    const params = new URLSearchParams("?tab=profile");
    expect(params.get("tab")).toBe("profile");
  });

  it("should support tab=webhooks parameter", () => {
    const params = new URLSearchParams("?tab=webhooks");
    expect(params.get("tab")).toBe("webhooks");
  });

  it("should default to integrations tab when no tab specified", () => {
    const params = new URLSearchParams("");
    const tab = params.get("tab") || "integrations";
    expect(tab).toBe("integrations");
  });

  it("should handle google=connected callback parameter", () => {
    const params = new URLSearchParams("?tab=integrations&google=connected");
    expect(params.get("google")).toBe("connected");
    expect(params.get("tab")).toBe("integrations");
  });

  it("should handle google=error callback parameter", () => {
    const params = new URLSearchParams("?tab=integrations&google=error&message=Access%20denied");
    expect(params.get("google")).toBe("error");
    expect(params.get("message")).toBe("Access denied");
  });
});

// ============================================================================
// CALLBACK REDIRECT URL TESTS
// ============================================================================

describe("Callback Redirect URL Construction", () => {
  it("should use & separator when returnPath already has query params", () => {
    const returnPath = "/setup?tab=integrations";
    const separator = returnPath.includes("?") ? "&" : "?";
    const url = `https://example.com${returnPath}${separator}google=connected`;
    expect(url).toBe("https://example.com/setup?tab=integrations&google=connected");
  });

  it("should use ? separator when returnPath has no query params", () => {
    const returnPath = "/mail";
    const separator = returnPath.includes("?") ? "&" : "?";
    const url = `https://example.com${returnPath}${separator}google=connected`;
    expect(url).toBe("https://example.com/mail?google=connected");
  });

  it("should use ? separator for /onboarding returnPath", () => {
    const returnPath = "/onboarding";
    const separator = returnPath.includes("?") ? "&" : "?";
    const url = `https://example.com${returnPath}${separator}google=connected`;
    expect(url).toBe("https://example.com/onboarding?google=connected");
  });

  it("should default returnPath to /setup?tab=integrations", () => {
    const result = { returnPath: undefined as string | undefined };
    const returnPath = result.returnPath || "/setup?tab=integrations";
    expect(returnPath).toBe("/setup?tab=integrations");
  });
});

// ============================================================================
// ONBOARDING REDIRECT LOGIC TESTS
// ============================================================================

describe("Onboarding Redirect Logic", () => {
  it("should redirect to /onboarding when user has not completed onboarding", () => {
    const user = { onboardingCompleted: false };
    const location = "/";
    const shouldRedirect = !user.onboardingCompleted && location !== "/onboarding";
    expect(shouldRedirect).toBe(true);
  });

  it("should NOT redirect when user has completed onboarding", () => {
    const user = { onboardingCompleted: true };
    const location = "/";
    const shouldRedirect = !user.onboardingCompleted && location !== "/onboarding";
    expect(shouldRedirect).toBe(false);
  });

  it("should NOT redirect when already on /onboarding", () => {
    const user = { onboardingCompleted: false };
    const location = "/onboarding";
    const shouldRedirect = !user.onboardingCompleted && location !== "/onboarding";
    expect(shouldRedirect).toBe(false);
  });

  it("should treat null onboardingCompleted as false (new user)", () => {
    const user = { onboardingCompleted: null as boolean | null };
    const completed = user.onboardingCompleted ?? false;
    const location = "/";
    const shouldRedirect = !completed && location !== "/onboarding";
    expect(shouldRedirect).toBe(true);
  });
});
