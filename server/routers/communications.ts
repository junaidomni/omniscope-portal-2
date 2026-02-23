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
    
    // Always use getChannelsForUser to include DMs (which have orgId = null)
    // Platform owners will see all channels they're members of, including DMs
    const userChannels = await db.getChannelsForUser(userId);
    
    // Enrich with unread counts and personalize DM names
    const enriched = await Promise.all(
      userChannels.map(async (uc) => {
        const unreadCount = await db.getUnreadCount(uc.channel.id, userId);
        
        // Personalize DM names: show the other person's name
        let displayName = uc.channel.name;
        if (uc.channel.type === "dm") {
          // Get the other user in this DM
          const members = await db.getChannelMembers(uc.channel.id);
          const otherMember = members.find(m => m.user.id !== userId);
          if (otherMember) {
            displayName = otherMember.user.name || "Unknown User";
          }
        }
        
        return {
          ...uc.channel,
          name: displayName, // Override with personalized name
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
      const isPlatformOwner = ctx.user.role === "admin";

      // Check if user is member of this channel (platform owners bypass this)
      if (!isPlatformOwner) {
        const isMember = await db.isChannelMember(input.channelId, userId);
        if (!isMember) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You are not a member of this channel",
          });
        }
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

      // Personalize DM names: show the other person's name
      let displayName = channel.name;
      if (channel.type === "dm") {
        const otherMember = members.find(m => m.user.id !== userId);
        if (otherMember) {
          displayName = otherMember.user.name || "Unknown User";
        }
      }

      return {
        ...channel,
        name: displayName, // Override with personalized name
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

      // Add reply counts to messages
      const messagesWithReplyCounts = await Promise.all(
        messagesList.map(async (m) => {
          const replyCount = await db.getReplyCount(m.message.id);
          return {
            ...m.message,
            user: m.user,
            replyCount,
          };
        })
      );

      return {
        messages: messagesWithReplyCounts,
        nextCursor,
      };
    }),

  /**
   * Get thread messages (replies to a parent message)
   */
  getThread: protectedProcedure
    .input(
      z.object({
        parentMessageId: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Get parent message to check channel membership
      const parentMessage = await db.getMessageById(input.parentMessageId);
      if (!parentMessage) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Parent message not found",
        });
      }

      // Check if user is member of the channel
      const isMember = await db.isChannelMember(parentMessage.channelId, userId);
      if (!isMember) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this channel",
        });
      }

      // Get thread messages
      const threadMessages = await db.getThreadMessages(input.parentMessageId);

      return {
        parentMessage,
        replies: threadMessages,
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
  // CHANNEL CREATION
  // ============================================================================

  /**
   * Create a direct message channel (1-on-1)
   */
  createDirectMessage: protectedProcedure
    .input(z.object({
      recipientId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const orgId = ctx.orgId;

      // Check if DM already exists between these two users
      const existingDM = await db.findDMChannel(userId, input.recipientId);
      if (existingDM) {
        return { channelId: existingDM.id, existed: true };
      }

      // Get both users' details for name generation
      const currentUser = await db.getUserById(userId);
      const recipient = await db.getUserById(input.recipientId);
      
      if (!recipient) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Recipient not found",
        });
      }

      if (!currentUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Current user not found",
        });
      }

      // Generate DM name from both users' names
      const dmName = `${currentUser.name || "User"} & ${recipient.name || "User"}`;

      // Create DM channel (orgId is NULL for cross-org DMs)
      const channelId = await db.createChannel({
        orgId: null, // DMs can be cross-org
        type: "dm",
        name: dmName,
        description: null,
        createdBy: userId,
      });

      if (!channelId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create DM channel",
        });
      }

      // Add both users as members
      await db.addChannelMember({
        channelId,
        userId,
        role: "member",
        isGuest: false,
      });

      await db.addChannelMember({
        channelId,
        userId: input.recipientId,
        role: "member",
        isGuest: false,
      });

      return { channelId, existed: false };
    }),

  /**
   * Create a direct message (DM) channel between two users
   */
  createDM: protectedProcedure
    .input(z.object({
      recipientId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const { recipientId } = input;

      if (recipientId === userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot create DM with yourself",
        });
      }

      // Check if DM already exists between these two users
      const existingDM = await db.findDMBetweenUsers(userId, recipientId);
      if (existingDM) {
        return { channelId: existingDM.id, existed: true };
      }

      // Create new DM channel (orgId = null for cross-org DMs)
      const channelId = await db.createChannel({
        orgId: null, // DMs are not org-specific
        type: "dm",
        name: null, // DM names are personalized per user
        createdBy: userId,
      });

      if (!channelId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create DM",
        });
      }

      // Add both users as members
      await db.addChannelMember({
        channelId,
        userId,
        role: "member",
        isGuest: false,
      });

      await db.addChannelMember({
        channelId,
        userId: recipientId,
        role: "member",
        isGuest: false,
      });

      return { channelId, existed: false };
    }),

  /**
   * Create a group chat channel (multi-user)
   */
  createGroupChat: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      memberIds: z.array(z.number()).min(1), // At least one other member
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const orgId = ctx.orgId;

      // Create group channel
      const channelId = await db.createChannel({
        orgId,
        type: "group",
        name: input.name,
        description: input.description,
        createdBy: userId,
      });

      if (!channelId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create group chat",
        });
      }

      // Add creator as owner
      await db.addChannelMember({
        channelId,
        userId,
        role: "owner",
        isGuest: false,
      });

      // Add all selected members
      for (const memberId of input.memberIds) {
        if (memberId !== userId) { // Don't add creator twice
          await db.addChannelMember({
            channelId,
            userId: memberId,
            role: "member",
            isGuest: false,
          });
        }
      }

      return { channelId };
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
      const orgId = ctx.orgId;

      // Only admins and platform owners can create deal rooms
      if (ctx.user.role !== "admin" && !ctx.user.platformOwner) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only administrators can create deal rooms",
        });
      }

      // Create deal room container (top-level)
      const dealRoomId = await db.createChannel({
        orgId,
        type: "deal_room",
        name: input.name,
        description: input.description,
        createdBy: userId,
      });

      if (!dealRoomId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create deal room",
        });
      }

      // Auto-create #general sub-channel
      const generalChannelId = await db.createChannel({
        orgId,
        parentChannelId: dealRoomId,
        type: "group",
        name: "general",
        description: "Main discussion channel",
        createdBy: userId,
      });

      // Add creator as owner of both deal room and #general channel
      await db.addChannelMember({
        channelId: dealRoomId,
        userId,
        role: "owner",
        isGuest: false,
      });

      if (generalChannelId) {
        await db.addChannelMember({
          channelId: generalChannelId,
          userId,
          role: "owner",
          isGuest: false,
        });
      }

      return { dealRoomId, generalChannelId };
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

  /**
   * Create sub-channel inside a deal room
   */
  createSubChannel: protectedProcedure
    .input(z.object({
      parentChannelId: z.number(),
      name: z.string(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Check if user is owner/admin of parent deal room
      const membership = await db.getChannelMembership(input.parentChannelId, userId);
      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this deal room",
        });
      }

      // Only owners and admins can create sub-channels
      if (membership.role !== "owner" && membership.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only deal room owners and admins can create sub-channels",
        });
      }

      // Create sub-channel
      const channelId = await db.createSubChannel({
        parentChannelId: input.parentChannelId,
        name: input.name,
        description: input.description,
        createdBy: userId,
      });

      if (!channelId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create sub-channel",
        });
      }

      // Add creator as member of sub-channel
      await db.addChannelMember({
        channelId,
        userId,
        role: "owner",
        isGuest: false,
      });

      return { channelId };
    }),

  /**
   * Get all deal rooms for current user's org
   */
  listDealRooms: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.orgId;
    const dealRooms = await db.getDealRooms(orgId);

    // Enrich with sub-channel counts
    const enriched = await Promise.all(
      dealRooms.map(async (room) => {
        const subChannels = await db.getSubChannels(room.id);
        return {
          ...room,
          subChannelCount: subChannels.length,
        };
      })
    );

    return enriched;
  }),

  /**
   * Get sub-channels for a deal room
   */
  getDealRoomChannels: protectedProcedure
    .input(z.object({ dealRoomId: z.number() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Check if user is member of deal room
      const isMember = await db.isChannelMember(input.dealRoomId, userId);
      if (!isMember) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this deal room",
        });
      }

      return await db.getSubChannels(input.dealRoomId);
    }),

  /**
   * Directly invite internal users to a channel (no invite link needed)
   */
  inviteUsers: protectedProcedure
    .input(z.object({
      channelId: z.number(),
      userIds: z.array(z.number()),
      role: z.enum(["member", "admin"]).default("member"),
    }))
    .mutation(async ({ input, ctx }) => {
      const requesterId = ctx.user.id;

      // Check if requester is owner/admin of the channel
      const membership = await db.getChannelMembership(input.channelId, requesterId);
      if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only channel owners/admins can invite users",
        });
      }

      // Add each user to the channel
      const results = await Promise.all(
        input.userIds.map(async (userId) => {
          try {
            await db.addChannelMember({
              channelId: input.channelId,
              userId,
              role: input.role,
              isGuest: false,
            });
            return { userId, success: true };
          } catch (error) {
            return { userId, success: false, error: String(error) };
          }
        })
      );

      const successCount = results.filter((r) => r.success).length;
      return {
        success: true,
        invited: successCount,
        total: input.userIds.length,
        results,
      };
    }),

  /**
   * Change member role in channel
   */
  changeMemberRole: protectedProcedure
    .input(
      z.object({
        channelId: z.number(),
        userId: z.number(),
        newRole: z.enum(["owner", "admin", "member", "guest"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const requesterId = ctx.user.id;

      // Check if requester is member
      const requesterMembership = await db.getChannelMembership(input.channelId, requesterId);
      if (!requesterMembership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this channel",
        });
      }

      // Only owners and admins can change roles
      if (requesterMembership.role !== "owner" && requesterMembership.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only owners and admins can change member roles",
        });
      }

      // Check if target user is member
      const targetMembership = await db.getChannelMembership(input.channelId, input.userId);
      if (!targetMembership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User is not a member of this channel",
        });
      }

      // Prevent changing own role
      if (requesterId === input.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot change your own role",
        });
      }

      // Update role in database
      const dbInstance = await db.getDb();
      if (!dbInstance) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const { channelMembers } = await import("../../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");

      await dbInstance
        .update(channelMembers)
        .set({ role: input.newRole })
        .where(
          and(
            eq(channelMembers.channelId, input.channelId),
            eq(channelMembers.userId, input.userId)
          )
        );

      return {
        success: true,
        message: `Role updated to ${input.newRole}`,
      };
    }),

  /**
   * Delete a channel (owners and admins only)
   */
  deleteChannel: protectedProcedure
    .input(
      z.object({
        channelId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const isPlatformOwner = ctx.user.role === "admin";

      // Platform owners can delete any channel
      if (!isPlatformOwner) {
        // Check if user is member
        const membership = await db.getChannelMembership(input.channelId, userId);
        if (!membership) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You are not a member of this channel",
          });
        }

        // Only owners and admins can delete channels
        if (membership.role !== "owner" && membership.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only owners and admins can delete channels",
          });
        }
      }

      // Delete the channel (will cascade delete members, messages, etc.)
      await db.deleteChannel(input.channelId);

      return {
        success: true,
        message: "Channel deleted successfully",
      };
    }),

  /**
   * Search messages across all channels with filters
   */
  searchMessages: protectedProcedure
    .input(
      z.object({
        query: z.string(),
        senderId: z.number().optional(),
        channelId: z.number().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Search messages (only in channels user is a member of)
      const results = await db.searchMessages({
        query: input.query,
        userId,
        senderId: input.senderId,
        channelId: input.channelId,
        startDate: input.startDate,
        endDate: input.endDate,
      });

      return results;
    }),

  // ============================================================================
  // MESSAGE REACTIONS
  // ============================================================================

  /**
   * Add a reaction to a message
   */
  addReaction: protectedProcedure
    .input(
      z.object({
        messageId: z.number(),
        emoji: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Add reaction
      await db.addReaction({
        messageId: input.messageId,
        userId,
        emoji: input.emoji,
      });

      return { success: true };
    }),

  /**
   * Remove a reaction from a message
   */
  removeReaction: protectedProcedure
    .input(
      z.object({
        messageId: z.number(),
        emoji: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Remove reaction
      await db.removeReaction({
        messageId: input.messageId,
        userId,
        emoji: input.emoji,
      });

      return { success: true };
    }),

  /**
   * Get reactions for a message
   */
  getReactions: protectedProcedure
    .input(z.object({ messageId: z.number() }))
    .query(async ({ input }) => {
      const reactions = await db.getReactions(input.messageId);
      return reactions;
    }),

  // ============================================================================
  // MESSAGE PINNING
  // ============================================================================

  /**
   * Pin a message (owner/admin only)
   */
  pinMessage: protectedProcedure
    .input(z.object({ messageId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Get message to find channel
      const message = await db.getMessageById(input.messageId);
      if (!message) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found",
        });
      }

      // Check if user is owner or admin of the channel
      const membership = await db.getChannelMembership(message.channelId, userId);
      const isPlatformOwner = ctx.user.role === "admin";
      
      if (!isPlatformOwner && (!membership || (membership.role !== "owner" && membership.role !== "admin"))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only channel owners and admins can pin messages",
        });
      }

      // Pin the message
      await db.pinMessage(input.messageId);

      return { success: true };
    }),

  /**
   * Unpin a message (owner/admin only)
   */
  unpinMessage: protectedProcedure
    .input(z.object({ messageId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Get message to find channel
      const message = await db.getMessageById(input.messageId);
      if (!message) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found",
        });
      }

      // Check if user is owner or admin of the channel
      const membership = await db.getChannelMembership(message.channelId, userId);
      const isPlatformOwner = ctx.user.role === "admin";
      
      if (!isPlatformOwner && (!membership || (membership.role !== "owner" && membership.role !== "admin"))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only channel owners and admins can unpin messages",
        });
      }

      // Unpin the message
      await db.unpinMessage(input.messageId);

      return { success: true };
    }),

  /**
   * Get pinned messages for a channel
   */
  getPinnedMessages: protectedProcedure
    .input(z.object({ channelId: z.number() }))
    .query(async ({ input }) => {
      const pinnedMessages = await db.getPinnedMessages(input.channelId);
      return pinnedMessages;
    }),

  // ============================================================================
  // MESSAGE EDIT/DELETE
  // ============================================================================

  /**
   * Edit a message (own messages only, within 15 minutes)
   */
  editMessage: protectedProcedure
    .input(
      z.object({
        messageId: z.number(),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Get message
      const message = await db.getMessageById(input.messageId);
      if (!message) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found",
        });
      }

      // Check ownership
      if (message.userId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only edit your own messages",
        });
      }

      // Check 15-minute window
      const now = new Date();
      const createdAt = new Date(message.createdAt);
      const diffMinutes = (now.getTime() - createdAt.getTime()) / 1000 / 60;
      if (diffMinutes > 15) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Messages can only be edited within 15 minutes",
        });
      }

      // Edit the message
      await db.editMessage(input.messageId, input.content);

      return { success: true };
    }),

  /**
   * Delete a message (own messages only, within 15 minutes)
   */
  deleteMessage: protectedProcedure
    .input(z.object({ messageId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Get message
      const message = await db.getMessageById(input.messageId);
      if (!message) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found",
        });
      }

      // Check ownership
      if (message.userId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only delete your own messages",
        });
      }

      // Check 15-minute window
      const now = new Date();
      const createdAt = new Date(message.createdAt);
      const diffMinutes = (now.getTime() - createdAt.getTime()) / 1000 / 60;
      if (diffMinutes > 15) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Messages can only be deleted within 15 minutes",
        });
      }

      // Soft delete the message
      await db.deleteMessage(input.messageId);

      return { success: true };
    }),

  // ============================================================================
  // CALLS & VOICE/VIDEO
  // ============================================================================

  /**
   * Start a voice/video call in a channel
   */
  startCall: protectedProcedure
    .input(
      z.object({
        channelId: z.number(),
        type: z.enum(["voice", "video"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Check if user is member of channel
      const isMember = await db.isChannelMember(input.channelId, userId);
      if (!isMember) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You must be a channel member to start a call",
        });
      }

      // Check if there's already an active call
      const activeCall = await db.getActiveCall(input.channelId);
      if (activeCall) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "There is already an active call in this channel",
        });
      }

      // Create call
      const call = await db.createCall({
        channelId: input.channelId,
        initiatorId: userId,
        type: input.type,
        status: "ongoing",
      });

      // Add initiator as first participant
      await db.addCallParticipant({
        callId: call.id,
        userId,
        role: "host",
        audioEnabled: true,
        videoEnabled: input.type === "video",
      });

      return { call };
    }),

  /**
   * Join an active call
   */
  joinCall: protectedProcedure
    .input(
      z.object({
        callId: z.number(),
        audioEnabled: z.boolean().default(true),
        videoEnabled: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Get call
      const call = await db.getCallById(input.callId);
      if (!call) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Call not found",
        });
      }

      // Check if call is still active
      if (call.status !== "ongoing") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This call has ended",
        });
      }

      // Check if user is member of channel
      const isMember = await db.isChannelMember(call.channelId, userId);
      if (!isMember) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You must be a channel member to join this call",
        });
      }

      // Check if already in call
      const existingParticipant = await db.getCallParticipant(input.callId, userId);
      if (existingParticipant && !existingParticipant.leftAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You are already in this call",
        });
      }

      // Add participant
      await db.addCallParticipant({
        callId: input.callId,
        userId,
        role: "participant",
        audioEnabled: input.audioEnabled,
        videoEnabled: input.videoEnabled,
      });

      return { success: true };
    }),

  /**
   * Leave a call
   */
  leaveCall: protectedProcedure
    .input(z.object({ callId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Get call
      const call = await db.getCallById(input.callId);
      if (!call) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Call not found",
        });
      }

      // Mark participant as left
      await db.leaveCall(input.callId, userId);

      // Check if call is now empty
      const activeParticipants = await db.getActiveCallParticipants(input.callId);
      if (activeParticipants.length === 0) {
        // End the call
        await db.endCall(input.callId);
      }

      return { success: true };
    }),

  /**
   * Get active call in a channel
   */
  getActiveCall: protectedProcedure
    .input(z.object({ channelId: z.number() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Check if user is member of channel
      const isMember = await db.isChannelMember(input.channelId, userId);
      if (!isMember) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You must be a channel member to view calls",
        });
      }

      const call = await db.getActiveCall(input.channelId);
      if (!call) {
        return null;
      }

      // Get participants
      const participants = await db.getActiveCallParticipants(call.id);

      return {
        ...call,
        participants,
      };
    }),

  /**
   * Get call history for a channel
   */
  getCallHistory: protectedProcedure
    .input(z.object({ channelId: z.number() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Check if user is member of channel
      const isMember = await db.isChannelMember(input.channelId, userId);
      if (!isMember) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You must be a channel member to view call history",
        });
      }

      const calls = await db.getCallHistory(input.channelId);
      return calls;
    }),

  transcribeCall: protectedProcedure
    .input(z.object({ callId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Get call details
      const call = await db.getCallById(input.callId);
      if (!call) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Call not found",
        });
      }

      // Check if user is member of the channel
      const isMember = await db.isChannelMember(call.channelId, userId);
      if (!isMember) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You must be a channel member to transcribe calls",
        });
      }

      // Check if audio recording exists
      if (!call.audioUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No audio recording available for this call",
        });
      }

      // Transcribe using Whisper API
      const { transcribeAudio } = await import("../_core/voiceTranscription");
      const transcription = await transcribeAudio({
        audioUrl: call.audioUrl,
        language: "en",
        prompt: "Transcribe this call conversation",
      });

      // Store transcript as JSON
      const transcriptData = {
        text: transcription.text,
        language: transcription.language,
        segments: transcription.segments,
        transcribedAt: Date.now(),
      };

      // Save transcript URL (in production, upload to S3)
      const transcriptJson = JSON.stringify(transcriptData);
      const { storagePut } = await import("../storage");
      const { url: transcriptUrl } = await storagePut(
        `call-transcripts/${input.callId}-${Date.now()}.json`,
        transcriptJson,
        "application/json"
      );

      // Update call with transcript URL
      await db.updateCall(input.callId, { transcriptUrl });

      return { transcriptUrl, transcript: transcriptData };
    }),

  generateCallSummary: protectedProcedure
    .input(z.object({ callId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Get call details
      const call = await db.getCallById(input.callId);
      if (!call) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Call not found",
        });
      }

      // Check if user is member of the channel
      const isMember = await db.isChannelMember(call.channelId, userId);
      if (!isMember) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You must be a channel member to generate summaries",
        });
      }

      // Check if transcript exists
      if (!call.transcriptUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Call must be transcribed first",
        });
      }

      // Fetch transcript
      const transcriptResponse = await fetch(call.transcriptUrl);
      const transcript = await transcriptResponse.json();

      // Generate summary using LLM
      const { invokeLLM } = await import("../_core/llm");
      const summaryResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an AI assistant that generates concise summaries of call transcripts. Format your response as JSON with the following structure:
{
  "overview": "Brief 2-3 sentence overview of the call",
  "keyPoints": ["Key point 1", "Key point 2", ...],
  "decisions": ["Decision 1", "Decision 2", ...],
  "actionItems": [{"task": "Task description", "assignee": "Person name or null"}]
}`,
          },
          {
            role: "user",
            content: `Summarize this call transcript:\n\n${transcript.text}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "call_summary",
            strict: true,
            schema: {
              type: "object",
              properties: {
                overview: { type: "string" },
                keyPoints: { type: "array", items: { type: "string" } },
                decisions: { type: "array", items: { type: "string" } },
                actionItems: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      task: { type: "string" },
                      assignee: { type: ["string", "null"] },
                    },
                    required: ["task", "assignee"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["overview", "keyPoints", "decisions", "actionItems"],
              additionalProperties: false,
            },
          },
        },
      });

      const summaryText = summaryResponse.choices[0].message.content;
      const summary = JSON.parse(summaryText || "{}");

      // Add metadata
      const summaryData = {
        ...summary,
        generatedAt: Date.now(),
        callDuration: call.duration,
        participantCount: call.participants?.length || 0,
      };

      // Save summary (in production, upload to S3)
      const summaryJson = JSON.stringify(summaryData);
      const { storagePut } = await import("../storage");
      const { url: summaryUrl } = await storagePut(
        `call-summaries/${input.callId}-${Date.now()}.json`,
        summaryJson,
        "application/json"
      );

      // Update call with summary URL
      await db.updateCall(input.callId, { summaryUrl });

      return { summaryUrl, summary: summaryData };
    }),

  /**
   * Upload call recording and trigger transcription
   */
  uploadCallRecording: protectedProcedure
    .input(
      z.object({
        callId: z.number(),
        audioData: z.string(), // Base64 encoded audio
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      // Get call details
      const call = await db.getCallById(input.callId);
      if (!call) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Call not found",
        });
      }

      // Check if user is member of the channel
      const isMember = await db.isChannelMember(call.channelId, userId);
      if (!isMember) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You must be a channel member to upload recordings",
        });
      }

      // Convert base64 to buffer
      const base64Data = input.audioData.split(",")[1];
      const audioBuffer = Buffer.from(base64Data, "base64");

      // Upload to S3
      const { storagePut } = await import("../storage");
      const { url: audioUrl } = await storagePut(
        `call-recordings/${input.callId}-${Date.now()}.webm`,
        audioBuffer,
        "audio/webm"
      );

      // Update call with audio URL
      await db.updateCall(input.callId, { audioUrl });

      // Trigger automatic transcription
      try {
        const { transcribeAudio } = await import("../_core/voiceTranscription");
        const transcription = await transcribeAudio({
          audioUrl,
          language: "en",
        });

        // Save transcript to S3
        const transcriptData = {
          text: transcription.text,
          language: transcription.language,
          segments: transcription.segments,
          transcribedAt: Date.now(),
        };

        const transcriptJson = JSON.stringify(transcriptData);
        const { url: transcriptUrl } = await storagePut(
          `call-transcripts/${input.callId}-${Date.now()}.json`,
          transcriptJson,
          "application/json"
        );

        // Update call with transcript URL
        await db.updateCall(input.callId, { transcriptUrl });

        return { audioUrl, transcriptUrl, success: true };
      } catch (error) {
        console.error("Error transcribing audio:", error);
        // Return success even if transcription fails
        return { audioUrl, transcriptUrl: null, success: true };
      }
    }),

  /**
   * Get all active calls in user's channels
   */
  getActiveCallsForUser: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    // Get all channels user is member of
    const userChannels = await db.getChannelsForUser(userId);
    const channelIds = userChannels.map((uc) => uc.channel.id);

    // Get active calls for these channels
    const activeCalls: Array<{ channelId: number; callId: number; callType: string }> = [];

    for (const channelId of channelIds) {
      const activeCall = await db.getActiveCall(channelId);
      if (activeCall) {
        activeCalls.push({
          channelId,
          callId: activeCall.id,
          callType: activeCall.callType,
        });
      }
    }

    return activeCalls;
  }),

  /**
   * Start a direct call with a contact
   */
  startDirectCall: protectedProcedure
    .input(
      z.object({
        contactId: z.number(),
        callType: z.enum(["voice", "video"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Find or create DM channel with contact
      const contact = await db.getContactById(input.contactId);
      if (!contact) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });
      }

      // Check if DM channel already exists
      const userChannels = await db.getChannelsForUser(userId);
      let dmChannel = userChannels.find(
        (uc) =>
          uc.channel.type === "dm" &&
          uc.channel.name?.includes(contact.name || "")
      );

      // Create DM channel if it doesn't exist
      if (!dmChannel) {
        const channelId = await db.createChannel({
          orgId: ctx.orgId,
          type: "dm",
          name: `${ctx.user.name} & ${contact.name}`,
          createdBy: userId,
        });

        if (!channelId) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create DM channel" });
        }

        // Add both users as members
        await db.addChannelMember({ channelId, userId, role: "owner" });
        // Note: In a real scenario, you'd need to map contact to user
        // For now, we'll just create the channel

        dmChannel = { channel: { id: channelId, type: "dm" as const, name: `${ctx.user.name} & ${contact.name}` } };
      }

      // Create call in the DM channel
      const call = await db.createCall({
        channelId: dmChannel.channel.id,
        startedBy: userId,
        callType: input.callType,
      });

      return {
        channelId: dmChannel.channel.id,
        callId: call.id,
        callType: input.callType,
      };
    }),
});
