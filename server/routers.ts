import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";
import { processIntelligenceData, validateIntelligenceData } from "./ingestion";
import * as analytics from "./analytics";
import * as askOmniScope from "./askOmniScope";
import * as recapGenerator from "./recapGenerator";
import * as reportExporter from "./reportExporter";

// ============================================================================
// MEETINGS ROUTER
// ============================================================================

const meetingsRouter = router({
  // List all meetings with optional filters
  list: protectedProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        primaryLead: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ input }) => {
      const filters = input ? {
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        primaryLead: input.primaryLead,
        limit: input.limit,
        offset: input.offset,
      } : undefined;
      
      return await db.getAllMeetings(filters);
    }),

  // Get a single meeting by ID
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const meeting = await db.getMeetingById(input.id);
      if (!meeting) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meeting not found" });
      }
      return meeting;
    }),

  // Get tags for a meeting
  getTags: protectedProcedure
    .input(z.object({ meetingId: z.number() }))
    .query(async ({ input }) => {
      return await db.getTagsForMeeting(input.meetingId);
    }),

  // Get tasks for a meeting
  getTasks: protectedProcedure
    .input(z.object({ meetingId: z.number() }))
    .query(async ({ input }) => {
      return await db.getTasksForMeeting(input.meetingId);
    }),

  // Search meetings
  search: protectedProcedure
    .input(z.object({
      query: z.string().min(1),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
      return await db.searchMeetings(input.query, input.limit);
    }),

  // Filter meetings by tags
  filterByTags: protectedProcedure
    .input(z.object({
      tagIds: z.array(z.number()).min(1),
    }))
    .query(async ({ input }) => {
      return await db.getMeetingsByTags(input.tagIds);
    }),

  // Create a new meeting (manual entry)
  create: protectedProcedure
    .input(
      z.object({
        meetingDate: z.string(),
        primaryLead: z.string(),
        participants: z.array(z.string()),
        organizations: z.array(z.string()).optional(),
        jurisdictions: z.array(z.string()).optional(),
        executiveSummary: z.string(),
        strategicHighlights: z.array(z.string()).optional(),
        opportunities: z.array(z.string()).optional(),
        risks: z.array(z.string()).optional(),
        keyQuotes: z.array(z.string()).optional(),
        intelligenceData: z.record(z.string(), z.any()).optional(),
        fullTranscript: z.string().optional(),
        sourceType: z.enum(["plaud", "fathom", "manual"]),
        sourceId: z.string().optional(),
        tagIds: z.array(z.number()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const meetingData = {
        meetingDate: new Date(input.meetingDate),
        primaryLead: input.primaryLead,
        participants: JSON.stringify(input.participants),
        organizations: input.organizations ? JSON.stringify(input.organizations) : null,
        jurisdictions: input.jurisdictions ? JSON.stringify(input.jurisdictions) : null,
        executiveSummary: input.executiveSummary,
        strategicHighlights: input.strategicHighlights ? JSON.stringify(input.strategicHighlights) : null,
        opportunities: input.opportunities ? JSON.stringify(input.opportunities) : null,
        risks: input.risks ? JSON.stringify(input.risks) : null,
        keyQuotes: input.keyQuotes ? JSON.stringify(input.keyQuotes) : null,
        intelligenceData: input.intelligenceData ? JSON.stringify(input.intelligenceData) : null,
        fullTranscript: input.fullTranscript ?? null,
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
        createdBy: ctx.user.id,
      };
      
      const meetingId = await db.createMeeting(meetingData);

      // Add tags if provided
      if (input.tagIds && input.tagIds.length > 0) {
        for (const tagId of input.tagIds) {
          await db.addTagToMeeting(meetingId, tagId);
        }
      }

      return { id: meetingId };
    }),

  // Update a meeting
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        meetingDate: z.string().optional(),
        primaryLead: z.string().optional(),
        participants: z.array(z.string()).optional(),
        organizations: z.array(z.string()).optional(),
        jurisdictions: z.array(z.string()).optional(),
        executiveSummary: z.string().optional(),
        strategicHighlights: z.array(z.string()).optional(),
        opportunities: z.array(z.string()).optional(),
        risks: z.array(z.string()).optional(),
        keyQuotes: z.array(z.string()).optional(),
        intelligenceData: z.record(z.string(), z.any()).optional(),
        fullTranscript: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const updates: any = {};
      
      if (input.meetingDate) updates.meetingDate = new Date(input.meetingDate);
      if (input.primaryLead) updates.primaryLead = input.primaryLead;
      if (input.participants) updates.participants = JSON.stringify(input.participants);
      if (input.organizations) updates.organizations = JSON.stringify(input.organizations);
      if (input.jurisdictions) updates.jurisdictions = JSON.stringify(input.jurisdictions);
      if (input.executiveSummary) updates.executiveSummary = input.executiveSummary;
      if (input.strategicHighlights) updates.strategicHighlights = JSON.stringify(input.strategicHighlights);
      if (input.opportunities) updates.opportunities = JSON.stringify(input.opportunities);
      if (input.risks) updates.risks = JSON.stringify(input.risks);
      if (input.keyQuotes) updates.keyQuotes = JSON.stringify(input.keyQuotes);
      if (input.intelligenceData) updates.intelligenceData = JSON.stringify(input.intelligenceData);
      if (input.fullTranscript) updates.fullTranscript = input.fullTranscript;

      await db.updateMeeting(input.id, updates);
      return { success: true };
    }),

  // Delete a meeting
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteMeeting(input.id);
      return { success: true };
    }),
});

// ============================================================================
// TASKS ROUTER
// ============================================================================

const tasksRouter = router({
  // List all tasks with optional filters
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(["open", "in_progress", "completed"]).optional(),
        assignedTo: z.number().optional(),
        meetingId: z.number().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      return await db.getAllTasks(input);
    }),

  // Get a single task by ID
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const task = await db.getTaskById(input.id);
      if (!task) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }
      return task;
    }),

  // Create a new task
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        description: z.string().optional(),
        priority: z.enum(["low", "medium", "high"]).default("medium"),
        assignedTo: z.number().optional(),
        meetingId: z.number().optional(),
        dueDate: z.string().optional(),
        isAutoGenerated: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const taskData = {
        title: input.title,
        description: input.description ?? null,
        priority: input.priority,
        assignedTo: input.assignedTo ?? null,
        meetingId: input.meetingId ?? null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        isAutoGenerated: input.isAutoGenerated,
        createdBy: ctx.user.id,
      };
      
      const taskId = await db.createTask(taskData);

      return { id: taskId };
    }),

  // Update a task
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(500).optional(),
        description: z.string().optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        status: z.enum(["open", "in_progress", "completed"]).optional(),
        assignedTo: z.number().nullable().optional(),
        dueDate: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const updates: any = {};
      
      if (input.title) updates.title = input.title;
      if (input.description !== undefined) updates.description = input.description;
      if (input.priority) updates.priority = input.priority;
      if (input.status) updates.status = input.status;
      if (input.assignedTo !== undefined) updates.assignedTo = input.assignedTo;
      if (input.dueDate !== undefined) {
        updates.dueDate = input.dueDate ? new Date(input.dueDate) : null;
      }

      await db.updateTask(input.id, updates);
      return { success: true };
    }),

  // Delete a task
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteTask(input.id);
      return { success: true };
    }),
});

// ============================================================================
// TAGS ROUTER
// ============================================================================

const tagsRouter = router({
  // List all tags
  list: protectedProcedure
    .input(
      z.object({
        type: z.enum(["sector", "jurisdiction"]).optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      return await db.getAllTags(input?.type);
    }),

  // Create a new tag
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        type: z.enum(["sector", "jurisdiction"]),
      })
    )
    .mutation(async ({ input }) => {
      const tagId = await db.createTag({
        name: input.name,
        type: input.type,
      });

      return { id: tagId };
    }),
});

// ============================================================================
// USERS ROUTER
// ============================================================================

const usersRouter = router({
  // List all users
  list: protectedProcedure.query(async () => {
    return await db.getAllUsers();
  }),
});

// ============================================================================
// INGESTION ROUTER (Webhook for Plaud/Fathom integration)
// ============================================================================

const ingestionRouter = router({
  // Webhook endpoint for receiving intelligence data
  webhook: publicProcedure
    .input(z.any())
    .mutation(async ({ input }) => {
      const data = validateIntelligenceData(input);
      
      if (!data) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid intelligence data format",
        });
      }

      const result = await processIntelligenceData(data);
      return result;
    }),
});

// ============================================================================
// ANALYTICS ROUTER
// ============================================================================

// ============================================================================
// ASK OMNISCOPE ROUTER (AI-Powered Search)
// ============================================================================

// ============================================================================
// RECAP GENERATOR ROUTER
// ============================================================================

// ============================================================================
// EXPORT ROUTER
// ============================================================================

const exportRouter = router({
  // Export daily summary
  dailySummary: protectedProcedure
    .input(z.object({
      date: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const date = input.date ? new Date(input.date) : new Date();
      return await reportExporter.exportDailySummaryMarkdown(date);
    }),
  
  // Export weekly summary
  weeklySummary: protectedProcedure
    .input(z.object({
      weekStart: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      let weekStart: Date;
      if (input.weekStart) {
        weekStart = new Date(input.weekStart);
      } else {
        const now = new Date();
        weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
      }
      return await reportExporter.exportWeeklySummaryMarkdown(weekStart);
    }),
  
  // Export custom range
  customRange: protectedProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
    }))
    .mutation(async ({ input }) => {
      const startDate = new Date(input.startDate);
      const endDate = new Date(input.endDate);
      return await reportExporter.exportCustomRangeMarkdown(startDate, endDate);
    }),
});

// ============================================================================
// RECAP GENERATOR ROUTER
// ============================================================================

const recapRouter = router({
  // Generate meeting recap
  generate: protectedProcedure
    .input(z.object({
      meetingId: z.number(),
      recipientName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return await recapGenerator.generateMeetingRecap(input.meetingId, input.recipientName);
    }),
});

// ============================================================================
// ASK OMNISCOPE ROUTER (AI-Powered Search)
// ============================================================================

const askRouter = router({
  // Ask a natural language question
  ask: protectedProcedure
    .input(z.object({
      query: z.string(),
    }))
    .mutation(async ({ input }) => {
      return await askOmniScope.askOmniScope(input.query);
    }),
  
  // Find meetings by participant
  findByParticipant: protectedProcedure
    .input(z.object({
      name: z.string(),
    }))
    .query(async ({ input }) => {
      return await askOmniScope.findMeetingsByParticipant(input.name);
    }),
  
  // Find meetings by organization
  findByOrganization: protectedProcedure
    .input(z.object({
      name: z.string(),
    }))
    .query(async ({ input }) => {
      return await askOmniScope.findMeetingsByOrganization(input.name);
    }),
});

// ============================================================================
// ADMIN ROUTER
// ============================================================================

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

const adminRouter = router({
  // Get all users
  getAllUsers: adminProcedure.query(async () => {
    return await db.getAllUsers();
  }),

  // Invite a new user
  inviteUser: adminProcedure
    .input(z.object({
      email: z.string().email(),
      role: z.enum(["user", "admin"]).default("user"),
    }))
    .mutation(async ({ input }) => {
      // Check if user already exists
      const existingUsers = await db.getAllUsers();
      if (existingUsers.some(u => u.email === input.email)) {
        throw new TRPCError({ code: 'CONFLICT', message: 'User already exists' });
      }
      
      // Create placeholder user (they'll complete signup on first login)
      await db.upsertUser({
        openId: `pending-${input.email}`,
        email: input.email,
        role: input.role,
      });
      
      return { success: true };
    }),

  // Update user role
  updateUserRole: adminProcedure
    .input(z.object({
      userId: z.number(),
      role: z.enum(["user", "admin"]),
    }))
    .mutation(async ({ input }) => {
      await db.updateUser(input.userId, { role: input.role });
      return { success: true };
    }),

  // Delete user
  deleteUser: adminProcedure
    .input(z.object({
      userId: z.number(),
    }))
    .mutation(async ({ input }) => {
      await db.deleteUser(input.userId);
      return { success: true };
    }),
});

// ============================================================================
// ANALYTICS ROUTER
// ============================================================================

const analyticsRouter = router({
  // Get dashboard metrics
  dashboard: protectedProcedure.query(async () => {
    return await analytics.getDashboardMetrics();
  }),
  
  // Get daily summary
  dailySummary: protectedProcedure
    .input(z.object({
      date: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const date = input.date ? new Date(input.date) : new Date();
      return await analytics.getDailySummary(date);
    }),
  
  // Get weekly summary
  weeklySummary: protectedProcedure
    .input(z.object({
      weekStart: z.string().optional(),
    }))
    .query(async ({ input }) => {
      let weekStart: Date;
      if (input.weekStart) {
        weekStart = new Date(input.weekStart);
      } else {
        const now = new Date();
        weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
      }
      return await analytics.getWeeklySummary(weekStart);
    }),
});

// ============================================================================
// MAIN APP ROUTER
// ============================================================================

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  meetings: meetingsRouter,
  tasks: tasksRouter,
  tags: tagsRouter,
  users: usersRouter,
  ingestion: ingestionRouter,
  analytics: analyticsRouter,
  ask: askRouter,
  recap: recapRouter,
  export: exportRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
