import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";

describe("Call Recording & Notifications", () => {
  let testUserId: number;
  let channelId: number;
  let callId: number;

  beforeAll(async () => {
    // Create test user
    const openId = `test-call-${Date.now()}`;
    await db.upsertUser({
      openId,
      name: "Test User",
      email: `test-${Date.now()}@test.com`,
    });

    const user = await db.getUserByOpenId(openId);
    if (!user) {
      throw new Error("Failed to create test user");
    }
    testUserId = user.id;

    // Create test channel
    channelId = (await db.createChannel({
      name: `Test Channel ${Date.now()}`,
      type: "group",
      createdBy: testUserId,
    }))!;

    // Add user as member
    await db.addChannelMember({ channelId, userId: testUserId, role: "owner" });
  });

  afterAll(async () => {
    const dbInstance = await db.getDb();
    if (!dbInstance) return;
    const { channels, channelMembers, messages, messageReactions, callLogs, callParticipants, users } = await import("../drizzle/schema");
    const { eq, inArray } = await import("drizzle-orm");
    try {
      if (channelId) {
        // Clean up call data
        const callRows = await dbInstance.select({ id: callLogs.id }).from(callLogs).where(eq(callLogs.channelId, channelId));
        if (callRows.length > 0) {
          await dbInstance.delete(callParticipants).where(inArray(callParticipants.callId, callRows.map(r => r.id)));
        }
        await dbInstance.delete(callLogs).where(eq(callLogs.channelId, channelId));
        const msgRows = await dbInstance.select({ id: messages.id }).from(messages).where(eq(messages.channelId, channelId));
        if (msgRows.length > 0) {
          await dbInstance.delete(messageReactions).where(inArray(messageReactions.messageId, msgRows.map(r => r.id)));
        }
        await dbInstance.delete(messages).where(eq(messages.channelId, channelId));
        await dbInstance.delete(channelMembers).where(eq(channelMembers.channelId, channelId));
        await dbInstance.delete(channels).where(eq(channels.id, channelId));
      }
      // Delete test user
      if (testUserId) {
        await dbInstance.delete(users).where(eq(users.id, testUserId));
      }
    } catch (e) {
      console.warn("Call recording test cleanup warning:", e);
    }
  });

  describe("Call Creation", () => {
    it("should create a call successfully", async () => {
      const call = await db.createCall({
        channelId,
        startedBy: testUserId,
        callType: "voice",
      });

      expect(call).toBeDefined();
      expect(call.channelId).toBe(channelId);
      expect(call.initiatorId).toBe(testUserId);
      expect(call.type).toBe("voice");
      expect(call.status).toBe("ongoing");

      callId = call.id;
    });

    it("should get active call in channel", async () => {
      const activeCall = await db.getActiveCall(channelId);

      expect(activeCall).toBeDefined();
      expect(activeCall?.id).toBe(callId);
      expect(activeCall?.status).toBe("ongoing");
    });
  });

  describe("Call Participants", () => {
    it("should add participant to call", async () => {
      const participantId = await db.addCallParticipant(
        callId,
        testUserId,
        "host"
      );

      expect(participantId).toBeDefined();
      expect(typeof participantId).toBe("number");
    });

    it("should get call participants", async () => {
      const participants = await db.getCallParticipants(callId);

      expect(participants).toBeDefined();
      expect(participants.length).toBeGreaterThan(0);
      expect(participants[0].userId).toBe(testUserId);
    });

    it("should remove participant from call", async () => {
      await db.removeCallParticipant(callId, testUserId);

      const participant = await db.getCallParticipant(callId, testUserId);
      expect(participant?.leftAt).toBeDefined();
    });
  });

  describe("Call Recording", () => {
    it("should update call with audio URL", async () => {
      const audioUrl = "https://example.com/recording.webm";

      await db.updateCall(callId, { recordingUrl: audioUrl });

      const call = await db.getCallById(callId);
      expect(call?.recordingUrl).toBe(audioUrl);
    });

    it("should update call with transcript URL", async () => {
      const transcriptUrl = "https://example.com/transcript.json";

      await db.updateCall(callId, { transcriptUrl });

      const call = await db.getCallById(callId);
      expect(call?.transcriptUrl).toBe(transcriptUrl);
    });

    it("should update call with recording URL", async () => {
      const recordingUrl = "https://example.com/recording2.webm";

      await db.updateCall(callId, { recordingUrl });

      const call = await db.getCallById(callId);
      expect(call?.recordingUrl).toBe(recordingUrl);
    });
  });

  describe("Call Ending", () => {
    it("should end call successfully", async () => {
      await db.endCall(callId);

      const call = await db.getCallById(callId);
      expect(call?.status).toBe("ended");
      expect(call?.endedAt).toBeDefined();
      expect(call?.duration).toBeGreaterThanOrEqual(0);
    });

    it("should not return ended call as active", async () => {
      const activeCall = await db.getActiveCall(channelId);
      expect(activeCall).toBeNull();
    });
  });

  describe("Call History", () => {
    it("should retrieve call history for channel", async () => {
      const history = await db.getCallHistory(channelId);

      expect(history).toBeDefined();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].id).toBe(callId);
      expect(history[0].status).toBe("ended");
    });
  });
});
