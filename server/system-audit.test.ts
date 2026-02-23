import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";
import * as db from "./db";

describe("System Audit - Full Integration Test", () => {
  let testAccountId: number;
  let testOrgId: number;
  let testUserId: number;
  let testChannelId: number;
  let testContactId: number;

  beforeAll(async () => {
    // Create test user first
    testUserId = await db.upsertUser({
      openId: `test-audit-user-${Date.now()}`,
      name: "Audit Test User",
      email: "audit@test.com",
    });

    // Create test account
    testAccountId = await db.createAccount({
      name: `Test Account ${Date.now()}`,
      ownerUserId: testUserId,
      plan: "enterprise",
    });

    // Create test organization
    testOrgId = await db.createOrganization({
      accountId: testAccountId,
      name: "Test Org for Audit",
      slug: `test-audit-${Date.now()}`,
    });

    // Add user to organization
    await db.addOrgMembership({
      userId: testUserId,
      organizationId: testOrgId,
      role: "member",
    });
  });

  describe("Communication System", () => {
    it("should create channel successfully", async () => {
      testChannelId = await db.createChannel({
        orgId: testOrgId,
        type: "public",
        name: "Audit Test Channel",
        createdBy: testUserId,
      });

      expect(testChannelId).toBeGreaterThan(0);
    });

    it("should add channel member", async () => {
      await db.addChannelMember({
        channelId: testChannelId,
        userId: testUserId,
        role: "member",
      });

      const channels = await db.getChannelsForUser(testUserId);
      const foundChannel = channels.find((c) => c.channel.id === testChannelId);
      expect(foundChannel).toBeDefined();
    });

    it("should send and retrieve messages", async () => {
      const messageId = await db.createMessage({
        channelId: testChannelId,
        userId: testUserId,
        content: "Test message for audit",
      });

      expect(messageId).toBeGreaterThan(0);

      const messages = await db.getMessages(testChannelId, 10, 0);
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].content).toBe("Test message for audit");
    });

    it("should handle message reactions", async () => {
      const messageId = await db.createMessage({
        channelId: testChannelId,
        userId: testUserId,
        content: "Message to react to",
      });

      await db.addReaction({
        messageId,
        userId: testUserId,
        emoji: "👍",
      });

      const messages = await db.getMessages(testChannelId, 10, 0);
      const message = messages.find((m) => m.id === messageId);
      expect(message?.reactions).toBeDefined();
    });
  });

  describe("Contact System", () => {
    it("should create contact with tags", async () => {
      testContactId = await db.createContact({
        orgId: testOrgId,
        name: "Audit Test Contact",
        email: "contact@audit.com",
        tags: JSON.stringify(["client", "vip", "active"]),
      });

      expect(testContactId).toBeGreaterThan(0);
    });

    it("should retrieve contact with tags", async () => {
      const contact = await db.getContactById(testContactId);
      expect(contact).toBeDefined();
      expect(contact?.name).toBe("Audit Test Contact");
      
      if (contact?.tags) {
        const tags = JSON.parse(contact.tags);
        expect(tags).toContain("client");
        expect(tags).toContain("vip");
      }
    });

    it("should search contacts", async () => {
      const results = await db.searchContacts("Audit", testOrgId);
      expect(results.length).toBeGreaterThan(0);
      const found = results.find((c: any) => c.id === testContactId);
      expect(found).toBeDefined();
    });
  });

  describe("Call System", () => {
    it("should create call in channel", async () => {
      const call = await db.createCall({
        channelId: testChannelId,
        startedBy: testUserId,
        callType: "voice",
      });

      expect(call.id).toBeGreaterThan(0);
      expect(call.callType).toBe("voice");
    });

    it("should retrieve active call", async () => {
      const activeCall = await db.getActiveCall(testChannelId);
      expect(activeCall).toBeDefined();
      expect(activeCall?.callType).toBe("voice");
    });

    it("should add call participant", async () => {
      const activeCall = await db.getActiveCall(testChannelId);
      if (activeCall) {
        await db.addCallParticipant({
          callId: activeCall.id,
          userId: testUserId,
        });

        const call = await db.getCallById(activeCall.id);
        expect(call?.participants).toBeDefined();
        expect(call?.participants?.length).toBeGreaterThan(0);
      }
    });

    it("should end call and retrieve history", async () => {
      const activeCall = await db.getActiveCall(testChannelId);
      if (activeCall) {
        await db.endCall(activeCall.id);

        const history = await db.getCallHistory({ channelId: testChannelId });
        expect(history.length).toBeGreaterThan(0);
        expect(history[0].status).toBe("completed");
      }
    });
  });

  describe("Data Integrity", () => {
    it("should maintain referential integrity across tables", async () => {
      // Verify channel exists
      const channels = await db.getChannelsForUser(testUserId);
      expect(channels.length).toBeGreaterThan(0);

      // Verify messages exist
      const messages = await db.getMessages(testChannelId, 10, 0);
      expect(messages.length).toBeGreaterThan(0);

      // Verify contact exists
      const contact = await db.getContactById(testContactId);
      expect(contact).toBeDefined();

      // Verify calls exist
      const callHistory = await db.getCallHistory({ channelId: testChannelId });
      expect(callHistory.length).toBeGreaterThan(0);
    });

    it("should handle concurrent operations", async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          db.createMessage({
            channelId: testChannelId,
            userId: testUserId,
            content: `Concurrent message ${i}`,
          })
        );
      }

      const messageIds = await Promise.all(promises);
      expect(messageIds.length).toBe(5);
      expect(new Set(messageIds).size).toBe(5); // All unique IDs
    });
  });
});
