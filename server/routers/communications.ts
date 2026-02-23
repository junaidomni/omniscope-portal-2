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
    const isPlatformOwner = ctx.user.role === "admin";
    
    // Platform owners see ALL channels, regular users see only their channels
    const userChannels = isPlatformOwner 
      ? await db.getAllChannels(ctx.orgId)
      : await db.getChannelsForUser(userId);
    
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

      // Check if requester is member
      const requesterMembership = await db.getChannelMembership(input.channelId, requesterId);
      if (!requesterMembership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this channel",
        });
      }

      // Only owners and admins can remove members
      if (requesterMembership.role !== "owner" && requesterMembership.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only owners and admins can remove members",
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

      // Prevent removing self
      if (requesterId === input.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot remove yourself from the channel",
        });
      }

      // Remove member
      await db.removeChannelMember(input.channelId, input.userId);

      return {
        success: true,
        message: "Member removed successfully",
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
});
