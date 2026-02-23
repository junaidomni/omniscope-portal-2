import { router, protectedProcedure, publicProcedure, orgScopedProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "crypto";

/**
 * Communications router - handles channels, messages, presence, and typing
 */
export const communicationsRouter = router({
  // ============================================================================
  // CHANNELS
  // ============================================================================

  /**
   * List all channels for current user
   */
  listChannels: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const userChannels = await db.getChannelsForUser(userId);
    
    // Enrich with unread counts
    const enriched = await Promise.all(
      userChannels.map(async (uc) => {
        const unreadCount = await db.getUnreadCount(uc.channel.id, userId);
        return {
          ...uc.channel,
          membership: uc.membership,
          unreadCount,
        };
      })
    );
    
    return enriched;
  }),

  /**
   * Get channel details with members
   */
  getChannel: protectedProcedure
    .input(z.object({ channelId: z.number() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Check if user is member of this channel
      const isMember = await db.isChannelMember(input.channelId, userId);
      if (!isMember) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this channel",
        });
      }

      // Get channel details
      const channel = await db.getChannelById(input.channelId);
      if (!channel) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Channel not found",
        });
      }

      // Get all members
      const members = await db.getChannelMembers(input.channelId);

      return {
        ...channel,
        members: members.map((m) => ({
          ...m.membership,
          user: m.user,
        })),
      };
    }),

  /**
   * Create a new channel (DM, group, or deal room)
   */
  createChannel: protectedProcedure
    .input(
      z.object({
        type: z.enum(["dm", "group", "deal_room", "announcement"]),
        name: z.string().optional(),
        description: z.string().optional(),
        avatar: z.string().optional(),
        memberIds: z.array(z.number()), // User IDs to add as members
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const orgId = ctx.orgId;

      // For DMs, check if channel already exists
      if (input.type === "dm") {
        if (input.memberIds.length !== 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "DM must have exactly 1 other member",
          });
        }

        const otherUserId = input.memberIds[0];
        const existingDM = await db.findDMChannel(userId, otherUserId);
        
        if (existingDM) {
          return { channelId: existingDM, existed: true };
        }
      }

      // Create channel
      const channelId = await db.createChannel({
        orgId: input.type === "dm" ? null : orgId, // DMs are cross-org
        type: input.type,
        name: input.name,
        description: input.description,
        avatar: input.avatar,
        createdBy: userId,
      });

      if (!channelId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create channel",
        });
      }

      // Add creator as owner
      await db.addChannelMember({
        channelId,
        userId,
        role: "owner",
      });

      // Add other members
      if (input.memberIds.length > 0) {
        for (const memberId of input.memberIds) {
          await db.addChannelMember({
            channelId,
            userId: memberId,
            role: "member",
          });
        }
      }

      return { channelId, existed: false };
    }),

  /**
   * Update channel (name, description, avatar)
   */
  updateChannel: protectedProcedure
    .input(
      z.object({
        channelId: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        avatar: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Check if user is admin or owner
      const membership = await db.getChannelMembership(input.channelId, userId);
      
      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this channel",
        });
      }

      if (membership.role !== "owner" && membership.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins and owners can update channels",
        });
      }

      // Update channel
      await db.updateChannel(input.channelId, {
        name: input.name,
        description: input.description,
        avatar: input.avatar,
      });

      return { success: true };
    }),

  /**
   * Add member to channel
   */
  addMember: protectedProcedure
    .input(
      z.object({
        channelId: z.number(),
        userId: z.number(),
        role: z.enum(["owner", "admin", "member", "guest"]).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const requesterId = ctx.user.id;

      // Check if requester is admin or owner
      const membership = await db.getChannelMembership(input.channelId, requesterId);
      
      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this channel",
        });
      }

      if (membership.role !== "owner" && membership.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins and owners can add members",
        });
      }

      // Check if user is already a member
      const existingMember = await db.isChannelMember(input.channelId, input.userId);
      if (existingMember) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "User is already a member",
        });
      }

      // Add member
      await db.addChannelMember({
        channelId: input.channelId,
        userId: input.userId,
        role: input.role || "member",
      });

      // Create system message
      const requesterName = ctx.user.name || "Someone";
      const addedUser = await db.getUserById(input.userId);
      const addedUserName = addedUser?.name || "Unknown";

      await db.createMessage({
        channelId: input.channelId,
        userId: requesterId,
        content: `${requesterName} added ${addedUserName} to the channel`,
        type: "system",
      });

      return { success: true };
    }),

  /**
   * Remove member from channel
   */
  removeMember: protectedProcedure
    .input(
      z.object({
        channelId: z.number(),
        userId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const requesterId = ctx.user.id;

      // Check if requester is admin or owner
      const membership = await db.getChannelMembership(input.channelId, requesterId);
      
      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this channel",
        });
      }

      if (membership.role !== "owner" && membership.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins and owners can remove members",
        });
      }

      // Remove member
      await db.removeChannelMember(input.channelId, input.userId);

      // Create system message
      const requesterName = ctx.user.name || "Someone";
      const removedUser = await db.getUserById(input.userId);
      const removedUserName = removedUser?.name || "Unknown";

      await db.createMessage({
        channelId: input.channelId,
        userId: requesterId,
        content: `${requesterName} removed ${removedUserName} from the channel`,
        type: "system",
      });

      return { success: true };
    }),

  /**
   * Leave channel
   */
  leaveChannel: protectedProcedure
    .input(z.object({ channelId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Check if user is member
      const isMember = await db.isChannelMember(input.channelId, userId);
      if (!isMember) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this channel",
        });
      }

      // Remove membership
      await db.removeChannelMember(input.channelId, userId);

      // Create system message
      const userName = ctx.user.name || "Someone";
      await db.createMessage({
        channelId: input.channelId,
        userId,
        content: `${userName} left the channel`,
        type: "system",
      });

      return { success: true };
    }),

  /**
   * Pin/unpin channel
   */
  pinChannel: protectedProcedure
    .input(
      z.object({
        channelId: z.number(),
        isPinned: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Check if user is member
      const isMember = await db.isChannelMember(input.channelId, userId);
      if (!isMember) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this channel",
        });
      }

      // Update channel
      await db.updateChannel(input.channelId, { isPinned: input.isPinned });

      return { success: true };
    }),

  // ============================================================================
  // MESSAGES
  // ============================================================================

  /**
   * List messages for a channel (paginated)
   */
  listMessages: protectedProcedure
    .input(
      z.object({
        channelId: z.number(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.number().optional(), // Message ID to start from
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Check if user is member
      const isMember = await db.isChannelMember(input.channelId, userId);
      if (!isMember) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this channel",
        });
      }

      // Get messages
      const messagesList = await db.getChannelMessages(
        input.channelId,
        input.limit,
        input.cursor
      );

      let nextCursor: number | undefined;
      if (messagesList.length > input.limit) {
        const nextItem = messagesList.pop();
        nextCursor = nextItem?.message.id;
      }

      return {
        messages: messagesList.map((m) => ({
          ...m.message,
          user: m.user,
        })),
        nextCursor,
      };
    }),

  /**
   * Send a message
   */
  sendMessage: protectedProcedure
    .input(
      z.object({
        channelId: z.number(),
        content: z.string().min(1),
        replyToId: z.number().optional(),
        linkedMeetingId: z.number().optional(),
        linkedContactId: z.number().optional(),
        linkedTaskId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Check if user is member
      const isMember = await db.isChannelMember(input.channelId, userId);
      if (!isMember) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this channel",
        });
      }

      // Create message
      const messageId = await db.createMessage({
        channelId: input.channelId,
        userId,
        content: input.content,
        replyToId: input.replyToId,
        linkedMeetingId: input.linkedMeetingId,
        linkedContactId: input.linkedContactId,
        linkedTaskId: input.linkedTaskId,
      });

      return { messageId };
    }),

  /**
   * Mark messages as read
   */
  markRead: protectedProcedure
    .input(z.object({ channelId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      await db.markChannelAsRead(input.channelId, userId);
      return { success: true };
    }),

  // ============================================================================
  // PRESENCE & TYPING
  // ============================================================================

  /**
   * Update user presence status
   */
  updatePresence: protectedProcedure
    .input(z.object({ status: z.enum(["online", "away", "offline"]) }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      await db.updateUserPresence(userId, input.status);
      return { success: true };
    }),

  /**
   * Get presence for list of users
   */
  getPresence: protectedProcedure
    .input(z.object({ userIds: z.array(z.number()) }))
    .query(async ({ input }) => {
      return await db.getUsersPresence(input.userIds);
    }),

  // ============================================================================
  // DEAL ROOMS
  // ============================================================================

  /**
   * Create a deal room channel
   */
  createDealRoom: protectedProcedure
    .input(z.object({
      name: z.string(),
      description: z.string().optional(),
      vertical: z.string(), // e.g., "gold", "real-estate", "carbon-credits"
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const orgId = ctx.user.orgId;

      // Create deal room channel
      const channelId = await db.createChannel({
        orgId,
        type: "deal_room",
        name: input.name,
        description: input.description || `${input.vertical} deal room`,
        createdBy: userId,
      });

      // Add creator as owner
      await db.addChannelMember(channelId, userId, "owner", false);

      return { channelId };
    }),

  /**
   * Generate invite link for deal room
   */
  createInviteLink: protectedProcedure
    .input(z.object({
      channelId: z.number(),
      expiresInDays: z.number().optional(), // NULL = never expires
      maxUses: z.number().optional(), // NULL = unlimited
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Check if user is admin/owner of this channel
      const membership = await db.getChannelMembership(input.channelId, userId);
      if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only channel owners/admins can create invite links",
        });
      }

      // Generate secure token
      const token = randomBytes(32).toString("hex");

      // Calculate expiry
      const expiresAt = input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
        : null;

      // Create invite
      const inviteId = await db.createChannelInvite({
        channelId: input.channelId,
        token,
        createdBy: userId,
        expiresAt,
        maxUses: input.maxUses || null,
      });

      return {
        inviteId,
        token,
        inviteUrl: `${process.env.VITE_APP_URL || 'http://localhost:3000'}/invite/${token}`,
      };
    }),

  /**
   * Get invite details (public - no auth required)
   */
  getInviteDetails: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const invite = await db.getChannelInviteByToken(input.token);

      if (!invite) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invite not found",
        });
      }

      // Check if expired
      if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invite has expired",
        });
      }

      // Check if max uses reached
      if (invite.maxUses && invite.usedCount >= invite.maxUses) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invite has reached maximum uses",
        });
      }

      // Check if active
      if (!invite.isActive) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invite has been deactivated",
        });
      }

      return {
        channelName: invite.channel.name,
        channelDescription: invite.channel.description,
        createdBy: invite.creator.name,
      };
    }),

  /**
   * Accept invite and join deal room as guest
   */
  acceptInvite: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const invite = await db.getChannelInviteByToken(input.token);

      if (!invite) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invite not found",
        });
      }

      // Validate invite (same checks as getInviteDetails)
      if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invite has expired" });
      }
      if (invite.maxUses && invite.usedCount >= invite.maxUses) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invite has reached maximum uses" });
      }
      if (!invite.isActive) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invite has been deactivated" });
      }

      // Check if already a member
      const isMember = await db.isChannelMember(invite.channelId, userId);
      if (isMember) {
        return { channelId: invite.channelId, alreadyMember: true };
      }

      // Add user as guest
      await db.addChannelMember(invite.channelId, userId, "guest", true);

      // Increment used count
      await db.incrementInviteUsedCount(invite.id);

      return { channelId: invite.channelId, alreadyMember: false };
    }),

  /**
   * Remove guest from deal room
   */
  removeGuest: protectedProcedure
    .input(z.object({
      channelId: z.number(),
      userId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const requesterId = ctx.user.id;

      // Check if requester is admin/owner
      const membership = await db.getChannelMembership(input.channelId, requesterId);
      if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only channel owners/admins can remove guests",
        });
      }

      // Remove member
      await db.removeChannelMember(input.channelId, input.userId);

      return { success: true };
    }),
});
