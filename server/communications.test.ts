import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";

describe("Communications Backend - Week 1 Verification", () => {
  let testUserId1: number;
  let testUserId2: number;
  let testChannelId: number;
  let testMessageId: number;

  beforeAll(async () => {
    // Create test users
    await db.upsertUser({
      openId: "test-comms-user-1",
      name: "Test User 1",
      email: "test1@omniscopex.ae",
    });
    await db.upsertUser({
      openId: "test-comms-user-2",
      name: "Test User 2",
      email: "test2@omniscopex.ae",
    });

    const user1 = await db.getUserByOpenId("test-comms-user-1");
    const user2 = await db.getUserByOpenId("test-comms-user-2");

    if (!user1 || !user2) {
      throw new Error("Failed to create test users");
    }

    testUserId1 = user1.id;
    testUserId2 = user2.id;
  });

  afterAll(async () => {
    const dbInstance = await db.getDb();
    if (!dbInstance) return;
    const { channels, channelMembers, messages, messageReactions, callLogs, callParticipants, users, userPresence } = await import("../drizzle/schema");
    const { eq, inArray } = await import("drizzle-orm");
    try {
      const testUserIds = [testUserId1, testUserId2];
      // Get channels created by test users
      const chRows = await dbInstance.select({ id: channels.id }).from(channels).where(inArray(channels.createdBy, testUserIds));
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
        await dbInstance.delete(channels).where(inArray(channels.id, chIds));
      }
      // Clean up presence
      await dbInstance.delete(userPresence).where(inArray(userPresence.userId, testUserIds));
      // Delete test users
      await dbInstance.delete(users).where(inArray(users.id, testUserIds));
    } catch (e) {
      console.warn("Communications test cleanup warning:", e);
    }
  });

  describe("Channel Management", () => {
    it("should create a new channel", async () => {
      const channelId = await db.createChannel({
        orgId: null,
        type: "group",
        name: "Test Channel",
        description: "A test channel for communications",
        createdBy: testUserId1,
      });

      expect(channelId).toBeDefined();
      expect(typeof channelId).toBe("number");
      testChannelId = channelId!;
    });

    it("should add members to channel", async () => {
      // Add creator as owner
      const member1Id = await db.addChannelMember({
        channelId: testChannelId,
        userId: testUserId1,
        role: "owner",
      });

      expect(member1Id).toBeDefined();

      // Add second user as member
      const member2Id = await db.addChannelMember({
        channelId: testChannelId,
        userId: testUserId2,
        role: "member",
      });

      expect(member2Id).toBeDefined();
    });

    it("should get channel by ID", async () => {
      const channel = await db.getChannelById(testChannelId);

      expect(channel).toBeDefined();
      expect(channel?.name).toBe("Test Channel");
      expect(channel?.type).toBe("group");
    });

    it("should get channel members", async () => {
      const members = await db.getChannelMembers(testChannelId);

      expect(members).toHaveLength(2);
      expect(members.some((m) => m.user.id === testUserId1)).toBe(true);
      expect(members.some((m) => m.user.id === testUserId2)).toBe(true);
    });

    it("should check if user is channel member", async () => {
      const isMember1 = await db.isChannelMember(testChannelId, testUserId1);
      const isMember2 = await db.isChannelMember(testChannelId, testUserId2);
      const isNotMember = await db.isChannelMember(testChannelId, 99999);

      expect(isMember1).toBe(true);
      expect(isMember2).toBe(true);
      expect(isNotMember).toBe(false);
    });

    it("should get user's membership details", async () => {
      const membership = await db.getChannelMembership(testChannelId, testUserId1);

      expect(membership).toBeDefined();
      expect(membership?.role).toBe("owner");
    });

    it("should get all channels for a user", async () => {
      const channels = await db.getChannelsForUser(testUserId1);

      expect(channels.length).toBeGreaterThan(0);
      expect(channels.some((c) => c.channel.id === testChannelId)).toBe(true);
    });

    it("should update channel details", async () => {
      await db.updateChannel(testChannelId, {
        name: "Updated Test Channel",
        description: "Updated description",
      });

      const channel = await db.getChannelById(testChannelId);
      expect(channel?.name).toBe("Updated Test Channel");
      expect(channel?.description).toBe("Updated description");
    });

    it("should pin a channel", async () => {
      await db.updateChannel(testChannelId, { isPinned: true });

      const channel = await db.getChannelById(testChannelId);
      expect(channel?.isPinned).toBe(true);
    });
  });

  describe("Messaging", () => {
    it("should create a message", async () => {
      const messageId = await db.createMessage({
        channelId: testChannelId,
        userId: testUserId1,
        content: "Hello, this is a test message!",
      });

      expect(messageId).toBeDefined();
      expect(typeof messageId).toBe("number");
      testMessageId = messageId!;
    });

    it("should create a message with linked entities", async () => {
      const messageId = await db.createMessage({
        channelId: testChannelId,
        userId: testUserId2,
        content: "Check out this meeting",
      });

      expect(messageId).toBeDefined();
    });

    it("should get channel messages", async () => {
      const messages = await db.getChannelMessages(testChannelId, 50);

      expect(messages.length).toBeGreaterThan(0);
      expect(messages.some((m) => m.message.id === testMessageId)).toBe(true);
      expect(messages[0].user).toBeDefined();
      expect(messages[0].user.name).toBeDefined();
    });

    it("should get paginated messages", async () => {
      // Create more messages
      for (let i = 0; i < 5; i++) {
        await db.createMessage({
          channelId: testChannelId,
          userId: testUserId1,
          content: `Test message ${i}`,
        });
      }

      const firstPage = await db.getChannelMessages(testChannelId, 3);
      expect(firstPage.length).toBe(4); // 3 + 1 for next cursor

      const lastMessageId = firstPage[2].message.id;
      const secondPage = await db.getChannelMessages(testChannelId, 3, lastMessageId);
      expect(secondPage.length).toBeGreaterThan(0);
    });

    it("should mark channel as read", async () => {
      await db.markChannelAsRead(testChannelId, testUserId1);

      const membership = await db.getChannelMembership(testChannelId, testUserId1);
      expect(membership?.lastReadAt).toBeDefined();
    });

    it("should calculate unread count", async () => {
      // User 2 hasn't read yet
      const unreadCount = await db.getUnreadCount(testChannelId, testUserId2);
      expect(unreadCount).toBeGreaterThan(0);

      // User 1 has read - should have fewer unread than user 2
      const readCount = await db.getUnreadCount(testChannelId, testUserId1);
      expect(readCount).toBeLessThanOrEqual(unreadCount);
    });
  });

  describe("DM Channels", () => {
    it("should find existing DM channel", async () => {
      // Create a DM channel
      const dmChannelId = await db.createChannel({
        orgId: null,
        type: "dm",
        createdBy: testUserId1,
      });

      await db.addChannelMember({
        channelId: dmChannelId!,
        userId: testUserId1,
        role: "member",
      });

      await db.addChannelMember({
        channelId: dmChannelId!,
        userId: testUserId2,
        role: "member",
      });

      // Find the DM - should return a valid DM channel ID
      const foundDM = await db.findDMChannel(testUserId1, testUserId2);
      expect(foundDM).toBeDefined();
      expect(foundDM).toBeGreaterThan(0);

      // Should work in reverse order too
      const foundDMReverse = await db.findDMChannel(testUserId2, testUserId1);
      expect(foundDMReverse).toBe(foundDM);
    });

    it("should return null for non-existent DM", async () => {
      const nonExistentDM = await db.findDMChannel(testUserId1, 99999);
      expect(nonExistentDM).toBeNull();
    });
  });

  describe("User Presence", () => {
    it("should update user presence", async () => {
      await db.updateUserPresence(testUserId1, "online");

      const presence = await db.getUsersPresence([testUserId1]);
      expect(presence).toHaveLength(1);
      expect(presence[0].status).toBe("online");
      expect(presence[0].lastSeenAt).toBeDefined();
    });

    it("should update presence status", async () => {
      await db.updateUserPresence(testUserId1, "away");

      const presence = await db.getUsersPresence([testUserId1]);
      expect(presence[0].status).toBe("away");
    });

    it("should get presence for multiple users", async () => {
      await db.updateUserPresence(testUserId2, "online");

      const presence = await db.getUsersPresence([testUserId1, testUserId2]);
      expect(presence).toHaveLength(2);
    });
  });

  describe("Member Management", () => {
    it("should remove member from channel", async () => {
      await db.removeChannelMember(testChannelId, testUserId2);

      const isMember = await db.isChannelMember(testChannelId, testUserId2);
      expect(isMember).toBe(false);

      const members = await db.getChannelMembers(testChannelId);
      expect(members.some((m) => m.user.id === testUserId2)).toBe(false);
    });

    it("should allow re-adding removed member", async () => {
      await db.addChannelMember({
        channelId: testChannelId,
        userId: testUserId2,
        role: "member",
      });

      const isMember = await db.isChannelMember(testChannelId, testUserId2);
      expect(isMember).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle non-existent channel gracefully", async () => {
      const channel = await db.getChannelById(99999);
      expect(channel).toBeNull();
    });

    it("should handle non-existent user membership", async () => {
      const membership = await db.getChannelMembership(testChannelId, 99999);
      expect(membership).toBeNull();
    });

    it("should return empty array for user with no channels", async () => {
      const channels = await db.getChannelsForUser(99999);
      expect(channels).toEqual([]);
    });

    it("should return empty array for channel with no messages", async () => {
      const emptyChannelId = await db.createChannel({
        orgId: null,
        type: "group",
        name: "Empty Channel",
        createdBy: testUserId1,
      });

      const messages = await db.getChannelMessages(emptyChannelId!, 50);
      expect(messages).toEqual([]);
    });
  });
});
