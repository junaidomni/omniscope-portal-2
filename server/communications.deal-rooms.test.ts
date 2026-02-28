import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import type { TrpcContext } from "./_core/context";

function createTestContext(user: any, orgId: number | null): TrpcContext {
  return {
    user,
    orgId,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Communications - Deal Rooms", () => {
  let testUserId: number;
  let testOrgId: number;
  let testUser2Id: number;
  let testAccountId: number;

  beforeEach(async () => {
    // Create test users
    await db.upsertUser({
      openId: "test-user-deal-rooms",
      name: "Test User Deal Rooms",
      email: "test-deal-rooms@omniscopex.ae",
      role: "admin",
    });
    const user = await db.getUserByOpenId("test-user-deal-rooms");
    testUserId = user!.id;

    await db.upsertUser({
      openId: "test-user-2-deal-rooms",
      name: "Test User 2 Deal Rooms",
      email: "test2-deal-rooms@omniscopex.ae",
      role: "user",
    });
    const user2 = await db.getUserByOpenId("test-user-2-deal-rooms");
    testUser2Id = user2!.id;

    // Create test account
    const accountId = await db.createAccount({
      name: "Test Account Deal Rooms",
      ownerUserId: testUserId,
      plan: "starter",
    });
    testAccountId = accountId;

    // Create test organization with unique slug
    const uniqueSlug = `test-org-deal-rooms-${Date.now()}`;
    const orgId = await db.createOrganization({
      accountId: testAccountId,
      name: "Test Org Deal Rooms",
      slug: uniqueSlug,
      createdBy: testUserId,
    });
    testOrgId = orgId;

    // Add users to org
    await db.addOrgMembership({ userId: testUserId, organizationId: testOrgId, role: "account_owner", isDefault: false });
    await db.addOrgMembership({ userId: testUser2Id, organizationId: testOrgId, role: "member", isDefault: false });
  });

  afterEach(async () => {
    // Clean up test data in correct FK order
    const dbInstance = await db.getDb();
    if (!dbInstance) return;
    const { channels, channelMembers, channelInvites, messages, messageReactions, callLogs, callParticipants, organizations, accounts, orgMemberships, users } = await import("../drizzle/schema");
    const { eq, inArray, sql } = await import("drizzle-orm");
    try {
      // Get all channels in this test org
      const chRows = await dbInstance.select({ id: channels.id }).from(channels).where(eq(channels.orgId, testOrgId));
      const chIds = chRows.map(r => r.id);
      if (chIds.length > 0) {
        // Delete reactions, messages, members, invites, call data for these channels
        const msgRows = await dbInstance.select({ id: messages.id }).from(messages).where(inArray(messages.channelId, chIds));
        if (msgRows.length > 0) {
          await dbInstance.delete(messageReactions).where(inArray(messageReactions.messageId, msgRows.map(r => r.id)));
        }
        await dbInstance.delete(messages).where(inArray(messages.channelId, chIds));
        await dbInstance.delete(channelMembers).where(inArray(channelMembers.channelId, chIds));
        await dbInstance.delete(channelInvites).where(inArray(channelInvites.channelId, chIds));
        const callRows = await dbInstance.select({ id: callLogs.id }).from(callLogs).where(inArray(callLogs.channelId, chIds));
        if (callRows.length > 0) {
          await dbInstance.delete(callParticipants).where(inArray(callParticipants.callId, callRows.map(r => r.id)));
        }
        await dbInstance.delete(callLogs).where(inArray(callLogs.channelId, chIds));
        // Delete sub-channels first, then parent channels
        await dbInstance.execute(sql`DELETE FROM channels WHERE channelParentId IS NOT NULL AND channelOrgId = ${testOrgId}`);
        await dbInstance.delete(channels).where(eq(channels.orgId, testOrgId));
      }
      await dbInstance.delete(orgMemberships).where(eq(orgMemberships.organizationId, testOrgId));
      await dbInstance.delete(organizations).where(eq(organizations.id, testOrgId));
      await dbInstance.delete(accounts).where(eq(accounts.id, testAccountId));
      // Clean up all test users
      const user3 = await db.getUserByOpenId("test-user-3-deal-rooms");
      if (user3) await dbInstance.delete(users).where(eq(users.id, user3.id));
      await dbInstance.delete(users).where(eq(users.id, testUserId));
      await dbInstance.delete(users).where(eq(users.id, testUser2Id));
    } catch (e) {
      // Cleanup errors shouldn't fail tests
      console.warn("Deal rooms test cleanup warning:", e);
    }
  });

  function adminCaller() {
    return appRouter.createCaller(createTestContext({
      id: testUserId,
      openId: "test-user-deal-rooms",
      name: "Test User Deal Rooms",
      email: "test-deal-rooms@omniscopex.ae",
      role: "admin",
      platformOwner: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    }, testOrgId));
  }

  function user2Caller() {
    return appRouter.createCaller(createTestContext({
      id: testUser2Id,
      openId: "test-user-2-deal-rooms",
      name: "Test User 2 Deal Rooms",
      email: "test2-deal-rooms@omniscopex.ae",
      role: "user",
      platformOwner: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    }, testOrgId));
  }

  describe("createDealRoom", () => {
    it("should create a deal room with correct type and description", async () => {
      const caller = adminCaller();

      const result = await caller.communications.createDealRoom({
        name: "Gold Trading Q1 2026",
        description: "Dubai gold transaction deal room",
        vertical: "gold",
      });

      expect(result.dealRoomId).toBeDefined();
      expect(typeof result.dealRoomId).toBe("number");

      // Verify channel was created correctly
      const channel = await db.getChannelById(result.dealRoomId);
      expect(channel).toBeDefined();
      expect(channel?.type).toBe("deal_room");
      expect(channel?.name).toBe("Gold Trading Q1 2026");
      expect(channel?.description).toBe("Dubai gold transaction deal room");
      expect(channel?.orgId).toBe(testOrgId);

      // Verify creator is added as owner
      const membership = await db.getChannelMembership(result.dealRoomId, testUserId);
      expect(membership).toBeDefined();
      expect(membership?.role).toBe("owner");
      expect(membership?.isGuest).toBe(false);
    });

    it("should create general sub-channel automatically", async () => {
      const caller = adminCaller();

      const result = await caller.communications.createDealRoom({
        name: "Real Estate Deal",
        vertical: "real-estate",
      });

      expect(result.generalChannelId).toBeDefined();
      if (result.generalChannelId) {
        const generalChannel = await db.getChannelById(result.generalChannelId);
        expect(generalChannel?.name).toBe("general");
        expect(generalChannel?.type).toBe("group");
      }
    });
  });

  describe("createInviteLink", () => {
    let dealRoomId: number;

    beforeEach(async () => {
      const caller = adminCaller();
      const result = await caller.communications.createDealRoom({
        name: "Test Deal Room",
        vertical: "gold",
      });
      dealRoomId = result.dealRoomId;
    });

    it("should generate invite link with expiry and max uses", async () => {
      const caller = adminCaller();

      const result = await caller.communications.createInviteLink({
        channelId: dealRoomId,
        expiresInDays: 7,
        maxUses: 5,
      });

      expect(result.inviteId).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.inviteUrl).toContain(result.token);
      expect(typeof result.token).toBe("string");
      expect(result.token.length).toBeGreaterThan(0);
    });

    it("should generate invite link with no expiry or max uses", async () => {
      const caller = adminCaller();

      const result = await caller.communications.createInviteLink({
        channelId: dealRoomId,
      });

      expect(result.inviteId).toBeDefined();
      expect(result.token).toBeDefined();

      // Verify invite in database
      const invite = await db.getChannelInviteByToken(result.token);
      expect(invite).toBeDefined();
      expect(invite?.expiresAt).toBeNull();
      expect(invite?.maxUses).toBeNull();
      expect(invite?.usedCount).toBe(0);
      expect(invite?.isActive).toBe(true);
    });

    it("should reject non-owner/admin from creating invite links", async () => {
      const caller = user2Caller();

      await expect(
        caller.communications.createInviteLink({
          channelId: dealRoomId,
        })
      ).rejects.toThrow("Only channel owners/admins can create invite links");
    });
  });

  describe("getInviteDetails", () => {
    let dealRoomId: number;
    let inviteToken: string;

    beforeEach(async () => {
      const caller = adminCaller();

      const dealRoom = await caller.communications.createDealRoom({
        name: "Test Deal Room",
        description: "Test description",
        vertical: "gold",
      });
      dealRoomId = dealRoom.dealRoomId;

      const invite = await caller.communications.createInviteLink({
        channelId: dealRoomId,
        expiresInDays: 7,
        maxUses: 5,
      });
      inviteToken = invite.token;
    });

    it("should return invite details for valid token (public endpoint)", async () => {
      // Public procedure - no auth required
      const caller = appRouter.createCaller(createTestContext(null, null));

      const result = await caller.communications.getInviteDetails({
        token: inviteToken,
      });

      expect(result.channelName).toBe("Test Deal Room");
      expect(result.channelDescription).toBe("Test description");
      expect(result.createdBy).toBe("Test User Deal Rooms");
    });

    it("should reject invalid token", async () => {
      const caller = appRouter.createCaller(createTestContext(null, null));

      await expect(
        caller.communications.getInviteDetails({
          token: "invalid-token-12345",
        })
      ).rejects.toThrow("Invite not found");
    });

    it("should reject expired invite", async () => {
      // Create expired invite
      const expiredToken = `expired-token-${Date.now()}`;
      await db.createChannelInvite({
        channelId: dealRoomId,
        token: expiredToken,
        createdBy: testUserId,
        expiresAt: new Date(Date.now() - 1000), // 1 second ago
        maxUses: null,
      });

      const caller = appRouter.createCaller(createTestContext(null, null));

      await expect(
        caller.communications.getInviteDetails({
          token: expiredToken,
        })
      ).rejects.toThrow("Invite has expired");
    });
  });

  describe("acceptInvite", () => {
    let dealRoomId: number;
    let inviteToken: string;

    beforeEach(async () => {
      const caller = adminCaller();

      const dealRoom = await caller.communications.createDealRoom({
        name: "Test Deal Room",
        vertical: "gold",
      });
      dealRoomId = dealRoom.dealRoomId;

      const invite = await caller.communications.createInviteLink({
        channelId: dealRoomId,
        expiresInDays: 7,
        maxUses: 5,
      });
      inviteToken = invite.token;
    });

    it("should add user as guest when accepting invite", async () => {
      const caller = user2Caller();

      const result = await caller.communications.acceptInvite({
        token: inviteToken,
      });

      expect(result.channelId).toBe(dealRoomId);
      expect(result.alreadyMember).toBe(false);

      // Verify user is added as guest
      const membership = await db.getChannelMembership(dealRoomId, testUser2Id);
      expect(membership).toBeDefined();
      expect(membership?.role).toBe("guest");
      expect(membership?.isGuest).toBe(true);
    });

    it("should increment used count after accepting invite", async () => {
      const invite = await db.getChannelInviteByToken(inviteToken);
      const initialUsedCount = invite?.usedCount || 0;

      const caller = user2Caller();

      await caller.communications.acceptInvite({
        token: inviteToken,
      });

      const updatedInvite = await db.getChannelInviteByToken(inviteToken);
      expect(updatedInvite?.usedCount).toBe(initialUsedCount + 1);
    });

    it("should return alreadyMember=true if user is already a member", async () => {
      const caller = adminCaller();

      const result = await caller.communications.acceptInvite({
        token: inviteToken,
      });

      expect(result.channelId).toBe(dealRoomId);
      expect(result.alreadyMember).toBe(true);
    });

    it("should reject invite at max uses", async () => {
      // Create invite with maxUses=1
      const limitedInvite = await adminCaller().communications.createInviteLink({
        channelId: dealRoomId,
        maxUses: 1,
      });

      // Use the invite once
      await user2Caller().communications.acceptInvite({
        token: limitedInvite.token,
      });

      // Try to use it again with a different user
      await db.upsertUser({
        openId: "test-user-3-deal-rooms",
        name: "Test User 3",
        email: "test3@omniscopex.ae",
        role: "user",
      });
      const user3 = await db.getUserByOpenId("test-user-3-deal-rooms");

      const user3Caller = appRouter.createCaller(createTestContext({
        id: user3!.id,
        openId: "test-user-3-deal-rooms",
        name: "Test User 3",
        email: "test3@omniscopex.ae",
        role: "user",
        platformOwner: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      }, testOrgId));

      await expect(
        user3Caller.communications.acceptInvite({
          token: limitedInvite.token,
        })
      ).rejects.toThrow("Invite has reached maximum uses");
    });
  });

  describe("removeGuest", () => {
    let dealRoomId: number;
    let guestUserId: number;

    beforeEach(async () => {
      // Create deal room
      const caller = adminCaller();

      const dealRoom = await caller.communications.createDealRoom({
        name: "Test Deal Room",
        vertical: "gold",
      });
      dealRoomId = dealRoom.dealRoomId;

      // Create invite and add guest
      const invite = await caller.communications.createInviteLink({
        channelId: dealRoomId,
      });

      await user2Caller().communications.acceptInvite({
        token: invite.token,
      });

      guestUserId = testUser2Id;
    });

    it("should allow owner to remove guest", async () => {
      const caller = adminCaller();

      const result = await caller.communications.removeGuest({
        channelId: dealRoomId,
        userId: guestUserId,
      });

      expect(result.success).toBe(true);

      // Verify guest is removed
      const membership = await db.getChannelMembership(dealRoomId, guestUserId);
      expect(membership).toBeNull();
    });

    it("should reject non-owner/admin from removing guests", async () => {
      // Create another user
      await db.upsertUser({
        openId: "test-user-3-deal-rooms",
        name: "Test User 3",
        email: "test3@omniscopex.ae",
        role: "user",
      });
      const user3 = await db.getUserByOpenId("test-user-3-deal-rooms");

      const user3Caller = appRouter.createCaller(createTestContext({
        id: user3!.id,
        openId: "test-user-3-deal-rooms",
        name: "Test User 3",
        email: "test3@omniscopex.ae",
        role: "user",
        platformOwner: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      }, testOrgId));

      await expect(
        user3Caller.communications.removeGuest({
          channelId: dealRoomId,
          userId: guestUserId,
        })
      ).rejects.toThrow("Only channel owners/admins can remove guests");
    });
  });
});
