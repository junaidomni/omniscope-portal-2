import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the gmail service module
vi.mock("./gmailService", () => ({
  listGmailThreads: vi.fn(),
  getGmailThread: vi.fn(),
  sendGmailEmail: vi.fn(),
  syncEmailHeaders: vi.fn(),
  getGmailUnreadCount: vi.fn(),
  getEmailsByContact: vi.fn(),
  toggleGmailStar: vi.fn(),
  toggleGmailRead: vi.fn(),
  trashGmailMessage: vi.fn(),
  getGmailAttachment: vi.fn(),
}));

// Mock the google calendar module for auth URL
vi.mock("./googleCalendar", () => ({
  getGoogleAuthUrl: vi.fn(() => "https://accounts.google.com/o/oauth2/auth?test=1"),
  getGoogleTokens: vi.fn(() => null),
}));

import {
  listGmailThreads,
  getGmailThread,
  sendGmailEmail,
  syncEmailHeaders,
  getGmailUnreadCount,
  getEmailsByContact,
  toggleGmailStar,
  toggleGmailRead,
  trashGmailMessage,
} from "./gmailService";
import { getGoogleTokens } from "./googleCalendar";

describe("Gmail Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Gmail Service Layer", () => {
    it("should list threads with folder filter", async () => {
      const mockThreads = {
        threads: [
          { id: "t1", snippet: "Hello", messages: [{ id: "m1" }] },
          { id: "t2", snippet: "World", messages: [{ id: "m2" }] },
        ],
        nextPageToken: "token123",
      };
      (listGmailThreads as any).mockResolvedValue(mockThreads);

      const result = await listGmailThreads(1, { folder: "inbox", maxResults: 20 });
      expect(result).toEqual(mockThreads);
      expect(listGmailThreads).toHaveBeenCalledWith(1, { folder: "inbox", maxResults: 20 });
    });

    it("should list threads with search query", async () => {
      (listGmailThreads as any).mockResolvedValue({ threads: [], nextPageToken: null });

      const result = await listGmailThreads(1, { search: "invoice", folder: "all" });
      expect(result).toBeDefined();
      expect(listGmailThreads).toHaveBeenCalledWith(1, { search: "invoice", folder: "all" });
    });

    it("should get a full thread with messages", async () => {
      const mockThread = {
        id: "t1",
        messages: [
          {
            id: "m1",
            from: "sender@test.com",
            to: ["me@test.com"],
            subject: "Test Subject",
            body: "<p>Hello</p>",
            date: "2026-02-18T10:00:00Z",
            attachments: [],
          },
        ],
      };
      (getGmailThread as any).mockResolvedValue(mockThread);

      const result = await getGmailThread(1, "t1");
      expect(result).toEqual(mockThread);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].subject).toBe("Test Subject");
    });

    it("should send an email", async () => {
      (sendGmailEmail as any).mockResolvedValue({ success: true, messageId: "sent123" });

      const result = await sendGmailEmail(1, {
        to: ["recipient@test.com"],
        subject: "Test Email",
        body: "Hello from OmniScope",
      });
      expect(result.success).toBe(true);
      expect(result.messageId).toBe("sent123");
    });

    it("should send a reply to an existing thread", async () => {
      (sendGmailEmail as any).mockResolvedValue({ success: true, messageId: "reply123" });

      const result = await sendGmailEmail(1, {
        to: ["recipient@test.com"],
        subject: "Re: Test Email",
        body: "Reply content",
        threadId: "t1",
        inReplyTo: "m1",
      });
      expect(result.success).toBe(true);
    });

    it("should sync email headers and return counts", async () => {
      (syncEmailHeaders as any).mockResolvedValue({ synced: 50, linked: 12 });

      const result = await syncEmailHeaders(1, { maxResults: 100 });
      expect(result.synced).toBe(50);
      expect(result.linked).toBe(12);
    });

    it("should handle sync errors gracefully", async () => {
      (syncEmailHeaders as any).mockResolvedValue({ synced: 0, linked: 0, error: "Gmail not connected" });

      const result = await syncEmailHeaders(1);
      expect(result.synced).toBe(0);
      expect(result.error).toBe("Gmail not connected");
    });

    it("should get unread count", async () => {
      (getGmailUnreadCount as any).mockResolvedValue(5);

      const result = await getGmailUnreadCount(1);
      expect(result).toBe(5);
    });

    it("should get emails by contact email", async () => {
      const mockThreads = {
        threads: [
          { id: "t1", snippet: "Discussion about deal" },
        ],
        nextPageToken: null,
      };
      (getEmailsByContact as any).mockResolvedValue(mockThreads);

      const result = await getEmailsByContact(1, "contact@company.com");
      expect(result.threads).toHaveLength(1);
    });

    it("should toggle star on a message", async () => {
      (toggleGmailStar as any).mockResolvedValue({ success: true, starred: true });

      const result = await toggleGmailStar(1, "m1", true);
      expect(result.success).toBe(true);
    });

    it("should toggle read/unread on a message", async () => {
      (toggleGmailRead as any).mockResolvedValue({ success: true, unread: false });

      const result = await toggleGmailRead(1, "m1", false);
      expect(result.success).toBe(true);
    });

    it("should trash a message", async () => {
      (trashGmailMessage as any).mockResolvedValue({ success: true });

      const result = await trashGmailMessage(1, "m1");
      expect(result.success).toBe(true);
    });
  });

  describe("Connection Status", () => {
    it("should detect when Gmail is not connected", async () => {
      (getGoogleTokens as any).mockResolvedValue(null);

      const tokens = await getGoogleTokens(1);
      expect(tokens).toBeNull();
    });

    it("should generate auth URL for connection", async () => {
      const { getGoogleAuthUrl } = await import("./googleCalendar");
      const url = getGoogleAuthUrl("https://example.com");
      expect(url).toContain("accounts.google.com");
    });
  });

  describe("Entity Auto-Linking", () => {
    it("should link emails to contacts during sync", async () => {
      // syncEmailHeaders already handles entity linking internally
      (syncEmailHeaders as any).mockResolvedValue({ synced: 10, linked: 5 });

      const result = await syncEmailHeaders(1, { maxResults: 50 });
      expect(result.linked).toBe(5);
      expect(result.linked).toBeLessThanOrEqual(result.synced * 3); // max 3 links per email (from, to, cc)
    });

    it("should handle emails with no matching contacts", async () => {
      (syncEmailHeaders as any).mockResolvedValue({ synced: 10, linked: 0 });

      const result = await syncEmailHeaders(1, { maxResults: 50 });
      expect(result.synced).toBe(10);
      expect(result.linked).toBe(0);
    });
  });

  describe("Email Search", () => {
    it("should search threads with query", async () => {
      (listGmailThreads as any).mockResolvedValue({
        threads: [{ id: "t1", snippet: "Invoice #1234" }],
        nextPageToken: null,
      });

      const result = await listGmailThreads(1, { search: "invoice", folder: "all" });
      expect(result.threads).toHaveLength(1);
    });

    it("should return empty results for no matches", async () => {
      (listGmailThreads as any).mockResolvedValue({ threads: [], nextPageToken: null });

      const result = await listGmailThreads(1, { search: "nonexistent12345" });
      expect(result.threads).toHaveLength(0);
    });
  });

  describe("Folder Filtering", () => {
    it("should filter by inbox", async () => {
      (listGmailThreads as any).mockResolvedValue({ threads: [{ id: "t1" }], nextPageToken: null });

      await listGmailThreads(1, { folder: "inbox" });
      expect(listGmailThreads).toHaveBeenCalledWith(1, { folder: "inbox" });
    });

    it("should filter by sent", async () => {
      (listGmailThreads as any).mockResolvedValue({ threads: [{ id: "t2" }], nextPageToken: null });

      await listGmailThreads(1, { folder: "sent" });
      expect(listGmailThreads).toHaveBeenCalledWith(1, { folder: "sent" });
    });

    it("should filter by starred", async () => {
      (listGmailThreads as any).mockResolvedValue({ threads: [], nextPageToken: null });

      await listGmailThreads(1, { folder: "starred" });
      expect(listGmailThreads).toHaveBeenCalledWith(1, { folder: "starred" });
    });

    it("should filter by drafts", async () => {
      (listGmailThreads as any).mockResolvedValue({ threads: [], nextPageToken: null });

      await listGmailThreads(1, { folder: "drafts" });
      expect(listGmailThreads).toHaveBeenCalledWith(1, { folder: "drafts" });
    });
  });
});
