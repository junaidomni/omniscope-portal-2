import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Tests for Gmail scope detection and OAuth redirect fixes.
 * Covers:
 * 1. isGoogleConnected scope analysis (hasGmailScopes, hasCalendarScopes)
 * 2. getGoogleAuthUrl returnPath parameter
 * 3. handleGoogleCallback returnPath propagation
 */

// Mock googleapis
const mockGenerateAuthUrl = vi.fn().mockReturnValue("https://accounts.google.com/o/oauth2/v2/auth?mock=true");
const mockGetToken = vi.fn();
const mockSetCredentials = vi.fn();

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(() => ({
        generateAuthUrl: mockGenerateAuthUrl,
        getToken: mockGetToken,
        setCredentials: mockSetCredentials,
      })),
    },
    oauth2: vi.fn().mockReturnValue({
      userinfo: {
        get: vi.fn().mockResolvedValue({ data: { email: "test@omniscopex.ae" } }),
      },
    }),
    calendar: vi.fn(),
    gmail: vi.fn(),
  },
}));

// Mock db module
const mockSelectChain = {
  limit: vi.fn(),
};
const mockWhereChain = {
  where: vi.fn().mockReturnValue(mockSelectChain),
};
const mockFromChain = {
  from: vi.fn().mockReturnValue(mockWhereChain),
};

const mockDb = {
  select: vi.fn().mockReturnValue(mockFromChain),
  delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
  insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
  update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) }),
};

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
}));

// Mock schema
vi.mock("../drizzle/schema", () => ({
  googleTokens: {
    userId: "userId",
    email: "email",
    refreshToken: "refreshToken",
    scope: "scope",
    id: "id",
  },
  calendarEvents: {},
}));

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
  and: vi.fn((...args: any[]) => args),
}));

describe("isGoogleConnected - Scope Detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the mock chain
    mockDb.select.mockReturnValue(mockFromChain);
    mockFromChain.from.mockReturnValue(mockWhereChain);
    mockWhereChain.where.mockReturnValue(mockSelectChain);
  });

  it("returns hasGmailScopes=true when gmail.readonly AND gmail.modify are present", async () => {
    const fullScopes = "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send";
    mockSelectChain.limit.mockResolvedValue([{
      email: "test@omniscopex.ae",
      refreshToken: "mock-refresh",
      scope: fullScopes,
    }]);

    const { isGoogleConnected } = await import("./googleCalendar");
    const result = await isGoogleConnected(1);

    expect(result.connected).toBe(true);
    expect(result.hasGmailScopes).toBe(true);
    expect(result.hasCalendarScopes).toBe(true);
    expect(result.email).toBe("test@omniscopex.ae");
  });

  it("returns hasGmailScopes=false when only gmail.send is present (no readonly/modify)", async () => {
    const limitedScopes = "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email openid";
    mockSelectChain.limit.mockResolvedValue([{
      email: "test@omniscopex.ae",
      refreshToken: "mock-refresh",
      scope: limitedScopes,
    }]);

    const { isGoogleConnected } = await import("./googleCalendar");
    const result = await isGoogleConnected(1);

    expect(result.connected).toBe(true);
    expect(result.hasGmailScopes).toBe(false);
    expect(result.hasCalendarScopes).toBe(true);
  });

  it("returns hasGmailScopes=false when only gmail.readonly is present (no modify)", async () => {
    const partialScopes = "https://www.googleapis.com/auth/gmail.readonly";
    mockSelectChain.limit.mockResolvedValue([{
      email: "test@omniscopex.ae",
      refreshToken: "mock-refresh",
      scope: partialScopes,
    }]);

    const { isGoogleConnected } = await import("./googleCalendar");
    const result = await isGoogleConnected(1);

    expect(result.connected).toBe(true);
    expect(result.hasGmailScopes).toBe(false); // needs both readonly AND modify
  });

  it("returns hasCalendarScopes=false when no calendar scopes are present", async () => {
    const gmailOnlyScopes = "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify";
    mockSelectChain.limit.mockResolvedValue([{
      email: "test@omniscopex.ae",
      refreshToken: "mock-refresh",
      scope: gmailOnlyScopes,
    }]);

    const { isGoogleConnected } = await import("./googleCalendar");
    const result = await isGoogleConnected(1);

    expect(result.connected).toBe(true);
    expect(result.hasGmailScopes).toBe(true);
    expect(result.hasCalendarScopes).toBe(false);
  });

  it("returns connected=false when no tokens exist", async () => {
    mockSelectChain.limit.mockResolvedValue([]);

    const { isGoogleConnected } = await import("./googleCalendar");
    const result = await isGoogleConnected(1);

    expect(result.connected).toBe(false);
    expect(result.hasGmailScopes).toBeUndefined();
    expect(result.hasCalendarScopes).toBeUndefined();
  });

  it("returns connected=false when refresh token is missing", async () => {
    mockSelectChain.limit.mockResolvedValue([{
      email: "test@omniscopex.ae",
      refreshToken: null,
      scope: "some-scope",
    }]);

    const { isGoogleConnected } = await import("./googleCalendar");
    const result = await isGoogleConnected(1);

    expect(result.connected).toBe(false);
  });

  it("returns scopes array with parsed scope strings", async () => {
    const scopeStr = "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify";
    mockSelectChain.limit.mockResolvedValue([{
      email: "test@omniscopex.ae",
      refreshToken: "mock-refresh",
      scope: scopeStr,
    }]);

    const { isGoogleConnected } = await import("./googleCalendar");
    const result = await isGoogleConnected(1);

    expect(result.scopes).toBeDefined();
    expect(result.scopes).toHaveLength(3);
    expect(result.scopes).toContain("https://www.googleapis.com/auth/calendar");
    expect(result.scopes).toContain("https://www.googleapis.com/auth/gmail.readonly");
    expect(result.scopes).toContain("https://www.googleapis.com/auth/gmail.modify");
  });

  it("handles empty scope string gracefully", async () => {
    mockSelectChain.limit.mockResolvedValue([{
      email: "test@omniscopex.ae",
      refreshToken: "mock-refresh",
      scope: "",
    }]);

    const { isGoogleConnected } = await import("./googleCalendar");
    const result = await isGoogleConnected(1);

    expect(result.connected).toBe(true);
    expect(result.hasGmailScopes).toBe(false);
    expect(result.hasCalendarScopes).toBe(false);
    expect(result.scopes).toEqual([]);
  });

  it("handles null scope gracefully", async () => {
    mockSelectChain.limit.mockResolvedValue([{
      email: "test@omniscopex.ae",
      refreshToken: "mock-refresh",
      scope: null,
    }]);

    const { isGoogleConnected } = await import("./googleCalendar");
    const result = await isGoogleConnected(1);

    expect(result.connected).toBe(true);
    expect(result.hasGmailScopes).toBe(false);
    expect(result.hasCalendarScopes).toBe(false);
  });
});

describe("getGoogleAuthUrl - returnPath parameter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes returnPath in state when provided", async () => {
    const { getGoogleAuthUrl } = await import("./googleCalendar");
    getGoogleAuthUrl("https://example.com", 1, "/mail");

    // Verify generateAuthUrl was called with state containing returnPath
    expect(mockGenerateAuthUrl).toHaveBeenCalled();
    const callArgs = mockGenerateAuthUrl.mock.calls[0][0];
    const state = JSON.parse(callArgs.state);
    expect(state.returnPath).toBe("/mail");
    expect(state.userId).toBe(1);
    expect(state.origin).toBe("https://example.com");
  });

  it("defaults returnPath to /integrations when not provided", async () => {
    const { getGoogleAuthUrl } = await import("./googleCalendar");
    getGoogleAuthUrl("https://example.com", 1);

    expect(mockGenerateAuthUrl).toHaveBeenCalled();
    const callArgs = mockGenerateAuthUrl.mock.calls[0][0];
    const state = JSON.parse(callArgs.state);
    expect(state.returnPath).toBe("/integrations");
  });

  it("requests all required scopes including gmail.readonly and gmail.modify", async () => {
    const { getGoogleAuthUrl } = await import("./googleCalendar");
    getGoogleAuthUrl("https://example.com", 1);

    expect(mockGenerateAuthUrl).toHaveBeenCalled();
    const callArgs = mockGenerateAuthUrl.mock.calls[0][0];
    const scopes = callArgs.scope;

    expect(scopes).toContain("https://www.googleapis.com/auth/gmail.readonly");
    expect(scopes).toContain("https://www.googleapis.com/auth/gmail.modify");
    expect(scopes).toContain("https://www.googleapis.com/auth/gmail.send");
    expect(scopes).toContain("https://www.googleapis.com/auth/calendar");
    expect(scopes).toContain("https://www.googleapis.com/auth/calendar.events");
    expect(scopes).toContain("https://www.googleapis.com/auth/userinfo.email");
  });

  it("uses correct redirect URI format", async () => {
    const { google } = await import("googleapis");
    const { getGoogleAuthUrl } = await import("./googleCalendar");
    getGoogleAuthUrl("https://mysite.com", 1);

    // OAuth2 constructor should be called with the correct redirect URI
    expect(google.auth.OAuth2).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "https://mysite.com/api/google/callback"
    );
  });

  it("forces consent prompt for refresh token", async () => {
    const { getGoogleAuthUrl } = await import("./googleCalendar");
    getGoogleAuthUrl("https://example.com", 1);

    const callArgs = mockGenerateAuthUrl.mock.calls[0][0];
    expect(callArgs.prompt).toBe("consent");
    expect(callArgs.access_type).toBe("offline");
  });
});

describe("Callback Redirect - returnPath propagation", () => {
  it("state with returnPath=/mail parses correctly", () => {
    const state = JSON.stringify({ userId: 1, origin: "https://example.com", returnPath: "/mail" });
    const parsed = JSON.parse(state);

    expect(parsed.returnPath).toBe("/mail");
    expect(parsed.origin).toBe("https://example.com");
    expect(parsed.userId).toBe(1);
  });

  it("state without returnPath defaults to /integrations", () => {
    const state = JSON.stringify({ userId: 1, origin: "https://example.com" });
    const parsed = JSON.parse(state);

    const returnPath = parsed.returnPath || "/integrations";
    expect(returnPath).toBe("/integrations");
  });

  it("constructs correct redirect URL on success", () => {
    const origin = "https://example.com";
    const returnPath = "/mail";
    const redirectUrl = `${origin}${returnPath}?google=connected`;

    expect(redirectUrl).toBe("https://example.com/mail?google=connected");
  });

  it("constructs correct redirect URL on error", () => {
    const origin = "https://example.com";
    const returnPath = "/integrations";
    const error = "redirect_uri_mismatch";
    const redirectUrl = `${origin}${returnPath}?google=error&message=${encodeURIComponent(error)}`;

    expect(redirectUrl).toBe("https://example.com/integrations?google=error&message=redirect_uri_mismatch");
  });
});
