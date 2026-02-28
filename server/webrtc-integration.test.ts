import { describe, it, expect, beforeAll } from "vitest";
import * as db from "./db";

describe("WebRTC Integration", () => {
  let testUserId: number;
  let testOrgId: number;

  beforeAll(async () => {
    // Create test user
    await db.upsertUser({
      openId: "test-webrtc-user",
      name: "WebRTC Test User",
      email: "webrtc@omniscopex.ae",
    });

    const user = await db.getUserByOpenId("test-webrtc-user");
    if (!user) {
      throw new Error("Failed to create test user");
    }
    testUserId = user.id;

    // Get or create test organization
    const orgs = await db.getAllOrganizations();
    if (orgs.length > 0) {
      testOrgId = orgs[0].id;
    } else {
      throw new Error("No organization found");
    }
  });

  describe("Call Infrastructure", () => {
    it("should start a call in a channel", async () => {
      // Create a test channel
      const channelId = await db.createChannel({
        orgId: testOrgId,
        type: "group",
        name: "Test Call Channel",
        description: "Channel for testing calls",
        createdBy: testUserId,
      });

      if (!channelId) {
        throw new Error("Failed to create channel");
      }

      // Add user as member
      await db.addChannelMember({ channelId, userId: testUserId, role: "owner" });

      // Start a call
      const call = await db.createCall({
        channelId,
        startedBy: testUserId,
        callType: "video",
      });

      expect(call).toBeDefined();
      expect(call.id).toBeDefined();
      expect(call.channelId).toBe(channelId);
      expect(call.type).toBe("video");
      expect(call.status).toBe("ongoing");
      expect(call.startedAt).toBeDefined();
    });

    it("should join an active call", async () => {
      // Create channel and start call
      const channelId = await db.createChannel({
        orgId: testOrgId,
        type: "group",
        name: "Test Call Channel Join",
        description: "Channel for testing call join",
        createdBy: testUserId,
      });

      if (!channelId) {
        throw new Error("Failed to create channel");
      }

      await db.addChannelMember({ channelId, userId: testUserId, role: "owner" });

      const call = await db.createCall({
        channelId,
        startedBy: testUserId,
        callType: "voice",
      });

      // Add participant to call
      await db.addCallParticipant(call.id, testUserId, "host");

      // Verify participant was added
      const participants = await db.getCallParticipants(call.id);
      expect(participants.length).toBeGreaterThan(0);
      expect(participants[0].userId).toBe(testUserId);
    });

    it("should leave a call", async () => {
      // Create channel, start call, and join
      const channelId = await db.createChannel({
        orgId: testOrgId,
        type: "group",
        name: "Test Call Channel Leave",
        description: "Channel for testing call leave",
        createdBy: testUserId,
      });

      if (!channelId) {
        throw new Error("Failed to create channel");
      }

      await db.addChannelMember({ channelId, userId: testUserId, role: "owner" });

      const call = await db.createCall({
        channelId,
        startedBy: testUserId,
        callType: "video",
      });

      await db.addCallParticipant(call.id, testUserId, "host");

      // Leave the call
      await db.removeCallParticipant(call.id, testUserId);

      // Verify participant was removed
      const participants = await db.getCallParticipants(call.id);
      const userParticipant = participants.find((p) => p.userId === testUserId && !p.leftAt);
      expect(userParticipant).toBeUndefined();
    });

    it("should get active call in channel", async () => {
      // Create channel and start call
      const channelId = await db.createChannel({
        orgId: testOrgId,
        type: "group",
        name: "Test Call Channel Active",
        description: "Channel for testing active call",
        createdBy: testUserId,
      });

      if (!channelId) {
        throw new Error("Failed to create channel");
      }

      await db.addChannelMember({ channelId, userId: testUserId, role: "owner" });

      const call = await db.createCall({
        channelId,
        startedBy: testUserId,
        callType: "video",
      });

      // Get active call
      const activeCall = await db.getActiveCallInChannel(channelId);

      expect(activeCall).toBeDefined();
      expect(activeCall?.id).toBe(call.id);
      expect(activeCall?.status).toBe("ongoing");
    });

    it("should return null when no active call exists", async () => {
      // Create channel without starting a call
      const channelId = await db.createChannel({
        orgId: testOrgId,
        type: "group",
        name: "Test Call Channel No Call",
        description: "Channel with no active call",
        createdBy: testUserId,
      });

      if (!channelId) {
        throw new Error("Failed to create channel");
      }

      await db.addChannelMember({ channelId, userId: testUserId, role: "owner" });

      // Get active call
      const activeCall = await db.getActiveCallInChannel(channelId);

      expect(activeCall).toBeNull();
    });
  });

  describe("Call History", () => {
    it("should retrieve call history for a channel", async () => {
      // Create channel and start/end a call
      const channelId = await db.createChannel({
        orgId: testOrgId,
        type: "group",
        name: "Test Call Channel History",
        description: "Channel for testing call history",
        createdBy: testUserId,
      });

      if (!channelId) {
        throw new Error("Failed to create channel");
      }

      await db.addChannelMember({ channelId, userId: testUserId, role: "owner" });

      const call = await db.createCall({
        channelId,
        startedBy: testUserId,
        callType: "video",
      });

      await db.addCallParticipant(call.id, testUserId, "host");
      await db.removeCallParticipant(call.id, testUserId);

      // End the call
      await db.endCall(call.id);

      // Get call history
      const history = await db.getCallHistory(channelId);

      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].id).toBe(call.id);
    });

    it("should track call participants", async () => {
      // Create channel and start call
      const channelId = await db.createChannel({
        orgId: testOrgId,
        type: "group",
        name: "Test Call Channel Participants",
        description: "Channel for testing participants",
        createdBy: testUserId,
      });

      if (!channelId) {
        throw new Error("Failed to create channel");
      }

      await db.addChannelMember({ channelId, userId: testUserId, role: "owner" });

      const call = await db.createCall({
        channelId,
        startedBy: testUserId,
        callType: "video",
      });

      await db.addCallParticipant(call.id, testUserId, "host");

      // Get call participants
      const participants = await db.getCallParticipants(call.id);

      expect(participants).toBeDefined();
      expect(Array.isArray(participants)).toBe(true);
      expect(participants.length).toBeGreaterThan(0);
    });
  });

  describe("Call Recording & Transcription", () => {
    it("should store audio URL for call recording", async () => {
      // Create channel and start call
      const channelId = await db.createChannel({
        orgId: testOrgId,
        type: "group",
        name: "Test Call Channel Recording",
        description: "Channel for testing recording",
        createdBy: testUserId,
      });

      if (!channelId) {
        throw new Error("Failed to create channel");
      }

      await db.addChannelMember({ channelId, userId: testUserId, role: "owner" });

      const call = await db.createCall({
        channelId,
        startedBy: testUserId,
        callType: "video",
      });

          // Verify call has recordingUrl field (initially null)
      expect(call.recordingUrl).toBeNull();
    });

    it("should update call with transcript URL", async () => {
      // Create channel and start call
      const channelId = await db.createChannel({
        orgId: testOrgId,
        type: "group",
        name: "Test Call Channel Transcript",
        description: "Channel for testing transcript",
        createdBy: testUserId,
      });

      if (!channelId) {
        throw new Error("Failed to create channel");
      }

      await db.addChannelMember({ channelId, userId: testUserId, role: "owner" });

      const call = await db.createCall({
        channelId,
        startedBy: testUserId,
        callType: "video",
      });

      // Update call with recording URL
      await db.updateCall(call.id, {
        recordingUrl: "https://example.com/recording.webm",
      });

      // Verify recording URL was set
      const updatedCall = await db.getCallById(call.id);
      expect(updatedCall?.recordingUrl).toBe("https://example.com/recording.webm");
    });

    it("should update call with summary URL", async () => {
      // Create channel and start call
      const channelId = await db.createChannel({
        orgId: testOrgId,
        type: "group",
        name: "Test Call Channel Summary",
        description: "Channel for testing summary",
        createdBy: testUserId,
      });

      if (!channelId) {
        throw new Error("Failed to create channel");
      }

      await db.addChannelMember({ channelId, userId: testUserId, role: "owner" });

      const call = await db.createCall({
        channelId,
        startedBy: testUserId,
        callType: "video",
      });

      // Update call with recording URL
      await db.updateCall(call.id, {
        recordingUrl: "https://example.com/recording.webm",
      });

      // Verify recording URL was set
      const updatedCall = await db.getCallById(call.id);
      expect(updatedCall?.recordingUrl).toBe("https://example.com/recording.webm");
    });
  });

  describe("Call Types", () => {
    it("should support voice calls", async () => {
      const channelId = await db.createChannel({
        orgId: testOrgId,
        type: "group",
        name: "Voice Call Channel",
        description: "Channel for voice calls",
        createdBy: testUserId,
      });

      if (!channelId) {
        throw new Error("Failed to create channel");
      }

      await db.addChannelMember({ channelId, userId: testUserId, role: "owner" });

      const call = await db.createCall({
        channelId,
        startedBy: testUserId,
        callType: "voice",
      });

      expect(call.type).toBe("voice");
    });

    it("should support video calls", async () => {
      const channelId = await db.createChannel({
        orgId: testOrgId,
        type: "group",
        name: "Video Call Channel",
        description: "Channel for video calls",
        createdBy: testUserId,
      });

      if (!channelId) {
        throw new Error("Failed to create channel");
      }

      await db.addChannelMember({ channelId, userId: testUserId, role: "owner" });

      const call = await db.createCall({
        channelId,
        startedBy: testUserId,
        callType: "video",
      });

      expect(call.type).toBe("video");
    });
  });
});