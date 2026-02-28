import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";

describe("Communications Platform - Integration Tests", () => {
  let adminUserId: number;
  let regularUserId: number;
  let guestUserId: number;
  let orgId: number;
  let accountId: number;
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

    const { users, accounts, organizations, orgMemberships } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    await dbInstance.update(users).set({ role: "admin" }).where(eq(users.id, adminUserId));

    // Create test account first (organizations require accountId)
    await dbInstance.insert(accounts).values({
      name: "Test Account Integration",
      ownerUserId: adminUserId,
      plan: "starter",
    });
    const accts = await dbInstance.select().from(accounts).where(eq(accounts.name, "Test Account Integration"));
    accountId = accts[0].id;

    // Create test organization
    await dbInstance.insert(organizations).values({
      accountId,
      name: "Test Org Integration",
      slug: `test-org-integration-${Date.now()}`,
    });

    const orgs = await dbInstance.select().from(organizations).where(eq(organizations.accountId, accountId));
    orgId = orgs[0].id;

    // Add users to org using correct table (orgMemberships, not organizationMembers)
    await dbInstance.insert(orgMemberships).values({
      organizationId: orgId,
      userId: adminUserId,
      role: "org_admin",
    });

    await dbInstance.insert(orgMemberships).values({
      organizationId: orgId,
      userId: regularUserId,
      role: "member",
    });
  });

  afterAll(async () => {
    // Cleanup
    const dbInstance = await db.getDb();
    if (!dbInstance) return;

    const { accounts, organizations, users, orgMemberships, channels, channelMembers, messages } =
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
    await dbInstance.delete(orgMemberships).where(eq(orgMemberships.organizationId, orgId));
    await dbInstance.delete(organizations).where(eq(organizations.id, orgId));
    await dbInstance.delete(accounts).where(eq(accounts.id, accountId));
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
          createdAt: new Date(),
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
          createdAt: new Date(),
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
          createdAt: new Date(),
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
          createdAt: new Date(),
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
          createdAt: new Date(),
        },
        orgId,
      });

      const result = await caller.communications.inviteUsers({
        channelId,
        userIds: [regularUserId],
      });

      expect(result.success).toBe(true);
      expect(result.invited).toBe(1);
    });

    it("should create invite link for external users", async () => {
      const caller = appRouter.createCaller({
        user: {
          id: adminUserId,
          openId: "test-admin-integration",
          name: "Admin User Integration",
          email: "admin-integration@test.com",
          role: "admin",
          createdAt: new Date(),
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
          createdAt: new Date(),
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
          createdAt: new Date(),
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
          createdAt: new Date(),
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
          createdAt: new Date(),
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
          createdAt: new Date(),
        },
        orgId,
      });

      const result = await caller.communications.listMessages({
        channelId,
        limit: 50,
      });

      expect(result.messages.length).toBeGreaterThan(0);
      // Messages are returned in reverse chronological order
      const testMsg = result.messages.find((m: any) => m.content === "Test message from member");
      expect(testMsg).toBeTruthy();
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
          createdAt: new Date(),
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
          createdAt: new Date(),
        },
        orgId,
      });

      const channels = await caller.communications.listChannels();
      const subChannels = channels.filter((c) => c.parentChannelId === channelId);

      expect(subChannels.length).toBeGreaterThan(0);
      // Verify at least one sub-channel matches
      const hasSubChannel = subChannels.some((c) => c.id === subChannelId);
      expect(hasSubChannel).toBe(true);
    });
  });
});
