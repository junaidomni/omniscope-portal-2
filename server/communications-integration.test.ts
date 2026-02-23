import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";

describe("Communications Platform - Integration Tests", () => {
  let adminUserId: number;
  let regularUserId: number;
  let guestUserId: number;
  let orgId: number;
  let channelId: number;
  let subChannelId: number;

  beforeAll(async () => {
    // Create test users using existing helper
    await db.upsertUser({
      openId: "test-admin-integration",
      name: "Admin User Integration",
      email: "admin-integration@test.com",
    });
    await db.upsertUser({
      openId: "test-regular-integration",
      name: "Regular User Integration",
      email: "regular-integration@test.com",
    });
    await db.upsertUser({
      openId: "test-guest-integration",
      name: "Guest User Integration",
      email: "guest-integration@test.com",
    });

    const admin = await db.getUserByOpenId("test-admin-integration");
    const regular = await db.getUserByOpenId("test-regular-integration");
    const guest = await db.getUserByOpenId("test-guest-integration");

    if (!admin || !regular || !guest) {
      throw new Error("Failed to create test users");
    }

    adminUserId = admin.id;
    regularUserId = regular.id;
    guestUserId = guest.id;

    // Update admin role
    const dbInstance = await db.getDb();
    if (!dbInstance) throw new Error("Database not available");

    const { users } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    await dbInstance.update(users).set({ role: "admin" }).where(eq(users.id, adminUserId));

    // Create test organization
    const { organizations } = await import("../drizzle/schema");
    await dbInstance.insert(organizations).values({
      name: "Test Org Integration",
      slug: "test-org-integration",
      createdAt: Date.now(),
    });

    const orgs = await dbInstance.select().from(organizations).where(eq(organizations.slug, "test-org-integration"));
    orgId = orgs[0].id;

    // Add users to org
    const { organizationMembers } = await import("../drizzle/schema");
    await dbInstance.insert(organizationMembers).values({
      organizationId: orgId,
      userId: adminUserId,
      role: "admin",
      joinedAt: Date.now(),
    });

    await dbInstance.insert(organizationMembers).values({
      organizationId: orgId,
      userId: regularUserId,
      role: "member",
      joinedAt: Date.now(),
    });
  });

  afterAll(async () => {
    // Cleanup
    const dbInstance = await db.getDb();
    if (!dbInstance) return;

    const { organizations, users, organizationMembers, channels, channelMembers, messages } =
      await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    // Delete in correct order to respect foreign keys
    if (channelId) {
      await dbInstance.delete(messages).where(eq(messages.channelId, channelId));
    }
    if (subChannelId) {
      await dbInstance.delete(messages).where(eq(messages.channelId, subChannelId));
    }
    if (channelId) {
      await dbInstance.delete(channelMembers).where(eq(channelMembers.channelId, channelId));
    }
    if (subChannelId) {
      await dbInstance.delete(channelMembers).where(eq(channelMembers.channelId, subChannelId));
    }
    await dbInstance.delete(channels).where(eq(channels.orgId, orgId));
    await dbInstance.delete(organizationMembers).where(eq(organizationMembers.organizationId, orgId));
    await dbInstance.delete(organizations).where(eq(organizations.id, orgId));
    await dbInstance.delete(users).where(eq(users.id, adminUserId));
    await dbInstance.delete(users).where(eq(users.id, regularUserId));
    await dbInstance.delete(users).where(eq(users.id, guestUserId));
  });

  describe("Channel Creation & Permissions", () => {
    it("should allow admin to create channel", async () => {
      const caller = appRouter.createCaller({
        user: {
          id: adminUserId,
          openId: "test-admin-integration",
          name: "Admin User Integration",
          email: "admin-integration@test.com",
          role: "admin",
          createdAt: Date.now(),
        },
        orgId,
      });

      const result = await caller.communications.createDealRoom({
        name: "Test Channel Integration",
        description: "Test channel description",
        vertical: "general",
      });

      expect(result.dealRoomId).toBeGreaterThan(0);
      channelId = result.dealRoomId;
    });

    it("should prevent regular user from creating channel", async () => {
      const caller = appRouter.createCaller({
        user: {
          id: regularUserId,
          openId: "test-regular-integration",
          name: "Regular User Integration",
          email: "regular-integration@test.com",
          role: "user",
          createdAt: Date.now(),
        },
        orgId,
      });

      await expect(
        caller.communications.createDealRoom({
          name: "Unauthorized Channel",
          description: "Should fail",
          vertical: "general",
        })
      ).rejects.toThrow();
    });
  });

  describe("Sub-channel Creation", () => {
    it("should allow channel owner to create sub-channel", async () => {
      const caller = appRouter.createCaller({
        user: {
          id: adminUserId,
          openId: "test-admin-integration",
          name: "Admin User Integration",
          email: "admin-integration@test.com",
          role: "admin",
          createdAt: Date.now(),
        },
        orgId,
      });

      const result = await caller.communications.createSubChannel({
        parentChannelId: channelId,
        name: "sub-channel-integration-test",
        description: "Test sub-channel",
      });

      expect(result.channelId).toBeGreaterThan(0);
      subChannelId = result.channelId;
    });

    it("should prevent non-member from creating sub-channel", async () => {
      const caller = appRouter.createCaller({
        user: {
          id: guestUserId,
          openId: "test-guest-integration",
          name: "Guest User Integration",
          email: "guest-integration@test.com",
          role: "user",
          createdAt: Date.now(),
        },
        orgId,
      });

      await expect(
        caller.communications.createSubChannel({
          parentChannelId: channelId,
          name: "unauthorized-sub",
          description: "Should fail",
        })
      ).rejects.toThrow();
    });
  });

  describe("User Invitations", () => {
    it("should allow channel owner to invite users directly", async () => {
      const caller = appRouter.createCaller({
        user: {
          id: adminUserId,
          openId: "test-admin-integration",
          name: "Admin User Integration",
          email: "admin-integration@test.com",
          role: "admin",
          createdAt: Date.now(),
        },
        orgId,
      });

      const result = await caller.communications.inviteUsers({
        channelId,
        userIds: [regularUserId],
      });

      expect(result.success).toBe(true);
      expect(result.addedCount).toBe(1);
    });

    it("should create invite link for external users", async () => {
      const caller = appRouter.createCaller({
        user: {
          id: adminUserId,
          openId: "test-admin-integration",
          name: "Admin User Integration",
          email: "admin-integration@test.com",
          role: "admin",
          createdAt: Date.now(),
        },
        orgId,
      });

      const result = await caller.communications.createInviteLink({
        channelId,
        expiresInDays: 7,
        maxUses: 10,
      });

      expect(result.token).toBeTruthy();
      expect(result.inviteUrl).toContain(result.token);
    });
  });

  describe("Access Control", () => {
    it("should show channel to members only", async () => {
      const memberCaller = appRouter.createCaller({
        user: {
          id: regularUserId,
          openId: "test-regular-integration",
          name: "Regular User Integration",
          email: "regular-integration@test.com",
          role: "user",
          createdAt: Date.now(),
        },
        orgId,
      });

      const channels = await memberCaller.communications.listChannels();
      const hasAccess = channels.some((c) => c.id === channelId);
      expect(hasAccess).toBe(true);
    });

    it("should not show channel to non-members", async () => {
      const guestCaller = appRouter.createCaller({
        user: {
          id: guestUserId,
          openId: "test-guest-integration",
          name: "Guest User Integration",
          email: "guest-integration@test.com",
          role: "user",
          createdAt: Date.now(),
        },
        orgId,
      });

      const channels = await guestCaller.communications.listChannels();
      const hasAccess = channels.some((c) => c.id === channelId);
      expect(hasAccess).toBe(false);
    });

    it("should prevent non-member from sending messages", async () => {
      const guestCaller = appRouter.createCaller({
        user: {
          id: guestUserId,
          openId: "test-guest-integration",
          name: "Guest User Integration",
          email: "guest-integration@test.com",
          role: "user",
          createdAt: Date.now(),
        },
        orgId,
      });

      await expect(
        guestCaller.communications.sendMessage({
          channelId,
          content: "Unauthorized message",
        })
      ).rejects.toThrow();
    });
  });

  describe("Messaging", () => {
    it("should allow member to send message", async () => {
      const caller = appRouter.createCaller({
        user: {
          id: regularUserId,
          openId: "test-regular-integration",
          name: "Regular User Integration",
          email: "regular-integration@test.com",
          role: "user",
          createdAt: Date.now(),
        },
        orgId,
      });

      const result = await caller.communications.sendMessage({
        channelId,
        content: "Test message from member",
      });

      expect(result.messageId).toBeGreaterThan(0);
    });

    it("should retrieve messages for channel members", async () => {
      const caller = appRouter.createCaller({
        user: {
          id: regularUserId,
          openId: "test-regular-integration",
          name: "Regular User Integration",
          email: "regular-integration@test.com",
          role: "user",
          createdAt: Date.now(),
        },
        orgId,
      });

      const messages = await caller.communications.getMessages({
        channelId,
        limit: 50,
      });

      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].content).toBe("Test message from member");
    });
  });

  describe("Channel Hierarchy", () => {
    it("should list channels with sub-channel counts", async () => {
      const caller = appRouter.createCaller({
        user: {
          id: adminUserId,
          openId: "test-admin-integration",
          name: "Admin User Integration",
          email: "admin-integration@test.com",
          role: "admin",
          createdAt: Date.now(),
        },
        orgId,
      });

      const dealRooms = await caller.communications.listDealRooms();
      const testChannel = dealRooms.find((dr) => dr.id === channelId);

      expect(testChannel).toBeTruthy();
      expect(testChannel?.subChannelCount).toBeGreaterThan(0);
    });

    it("should retrieve sub-channels for parent channel", async () => {
      const caller = appRouter.createCaller({
        user: {
          id: adminUserId,
          openId: "test-admin-integration",
          name: "Admin User Integration",
          email: "admin-integration@test.com",
          role: "admin",
          createdAt: Date.now(),
        },
        orgId,
      });

      const channels = await caller.communications.listChannels();
      const subChannels = channels.filter((c) => c.parentChannelId === channelId);

      expect(subChannels.length).toBeGreaterThan(0);
      expect(subChannels[0].id).toBe(subChannelId);
    });
  });
});
