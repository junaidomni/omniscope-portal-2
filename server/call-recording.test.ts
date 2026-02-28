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
    // Cleanup
    if (channelId) {
      await db.deleteChannel(channelId);
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
