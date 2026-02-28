import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import * as db from "./db";

describe("System Audit - Full Integration Test", () => {
  let testAccountId: number;
  let testOrgId: number;
  let testUserId: number;
  let testChannelId: number;
  let testContactId: number;

  const testOpenId = `test-audit-user-${Date.now()}`;

  beforeAll(async () => {
    // Create test user first (upsertUser returns void)
    await db.upsertUser({
      openId: testOpenId,
      name: "Audit Test User",
      email: "audit@test.com",
    });

    // Look up the user ID
    const user = await db.getUserByOpenId(testOpenId);
    if (!user) throw new Error("Failed to create test user");
    testUserId = user.id;

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

  afterAll(async () => {
    const dbInstance = await db.getDb();
    if (!dbInstance) return;
    const { channels, channelMembers, channelInvites, messages, messageReactions, callLogs, callParticipants, organizations, accounts, orgMemberships, contacts, users } = await import("../drizzle/schema");
    const { eq, inArray, sql } = await import("drizzle-orm");
    try {
      // Clean up channels in test org
      const chRows = await dbInstance.select({ id: channels.id }).from(channels).where(eq(channels.orgId, testOrgId));
      const chIds = chRows.map(r => r.id);
      if (chIds.length > 0) {
        const msgRows = await dbInstance.select({ id: messages.id }).from(messages).where(inArray(messages.channelId, chIds));
        if (msgRows.length > 0) {
          await dbInstance.delete(messageReactions).where(inArray(messageReactions.messageId, msgRows.map(r => r.id)));
        }
        await dbInstance.delete(messages).where(inArray(messages.channelId, chIds));
        await dbInstance.delete(channelMembers).where(inArray(channelMembers.channelId, chIds));
        const callRows = await dbInstance.select({ id: callLogs.id }).from(callLogs).where(inArray(callLogs.channelId, chIds));
        if (callRows.length > 0) {
          await dbInstance.delete(callParticipants).where(inArray(callParticipants.callId, callRows.map(r => r.id)));
        }
        await dbInstance.delete(callLogs).where(inArray(callLogs.channelId, chIds));
        await dbInstance.execute(sql`DELETE FROM channels WHERE channelParentId IS NOT NULL AND channelOrgId = ${testOrgId}`);
        await dbInstance.delete(channels).where(eq(channels.orgId, testOrgId));
      }
      // Clean up contacts
      if (testContactId) await dbInstance.delete(contacts).where(eq(contacts.id, testContactId));
      await dbInstance.delete(orgMemberships).where(eq(orgMemberships.organizationId, testOrgId));
      await dbInstance.delete(organizations).where(eq(organizations.id, testOrgId));
      await dbInstance.delete(accounts).where(eq(accounts.id, testAccountId));
      await dbInstance.delete(users).where(eq(users.id, testUserId));
    } catch (e) {
      console.warn("System audit test cleanup warning:", e);
    }
  });

  describe("Communication System", () => {
    it("should create channel successfully", async () => {
      testChannelId = await db.createChannel({
        orgId: testOrgId,
        type: "group",
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

      const messages = await db.getChannelMessages(testChannelId, 10);
      expect(messages.length).toBeGreaterThan(0);
      expect(messages.some((m: any) => m.message.content === "Test message for audit")).toBe(true);
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

      const messages = await db.getChannelMessages(testChannelId, 10);
      const message = messages.find((m: any) => m.message.id === messageId);
      expect(message).toBeDefined();
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
      expect(call.type).toBe("voice");
    });

    it("should retrieve active call", async () => {
      const activeCall = await db.getActiveCall(testChannelId);
      expect(activeCall).toBeDefined();
      expect(activeCall?.type).toBe("voice");
    });

    it("should add call participant", async () => {
      const activeCall = await db.getActiveCall(testChannelId);
      if (activeCall) {
        await db.addCallParticipant(activeCall.id, testUserId, "participant");

        const participants = await db.getCallParticipants(activeCall.id);
        expect(participants).toBeDefined();
        expect(participants.length).toBeGreaterThan(0);
      }
    });

    it("should end call and retrieve history", async () => {
      const activeCall = await db.getActiveCall(testChannelId);
      if (activeCall) {
        await db.endCall(activeCall.id);

        const history = await db.getCallHistory(testChannelId);
        expect(history.length).toBeGreaterThan(0);
        expect(history[0].status).toBe("ended");
      }
    });
  });

  describe("Data Integrity", () => {
    it("should maintain referential integrity across tables", async () => {
      // Verify channel exists
      const channels = await db.getChannelsForUser(testUserId);
      expect(channels.length).toBeGreaterThan(0);

      // Verify messages exist
      const msgs = await db.getChannelMessages(testChannelId, 10);
      expect(msgs.length).toBeGreaterThan(0);

      // Verify contact exists
      const contact = await db.getContactById(testContactId);
      expect(contact).toBeDefined();

      // Verify calls exist
      const callHistory = await db.getCallHistory(testChannelId);
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
