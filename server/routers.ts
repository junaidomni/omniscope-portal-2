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
import * as fathomIntegration from "./fathomIntegration";

// ============================================================================
// MEETINGS ROUTER
// ============================================================================

const meetingsRouter = router({
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

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const meeting = await db.getMeetingById(input.id);
      if (!meeting) throw new TRPCError({ code: "NOT_FOUND", message: "Meeting not found" });
      return meeting;
    }),

  getTags: protectedProcedure
    .input(z.object({ meetingId: z.number() }))
    .query(async ({ input }) => {
      return await db.getTagsForMeeting(input.meetingId);
    }),

  getTasks: protectedProcedure
    .input(z.object({ meetingId: z.number() }))
    .query(async ({ input }) => {
      return await db.getTasksForMeeting(input.meetingId);
    }),

  search: protectedProcedure
    .input(z.object({
      query: z.string().min(1),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
      return await db.searchMeetings(input.query, input.limit);
    }),

  filterByTags: protectedProcedure
    .input(z.object({ tagIds: z.array(z.number()).min(1) }))
    .query(async ({ input }) => {
      return await db.getMeetingsByTags(input.tagIds);
    }),

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
      if (input.tagIds && input.tagIds.length > 0) {
        for (const tagId of input.tagIds) {
          await db.addTagToMeeting(meetingId, tagId);
        }
      }
      return { id: meetingId };
    }),

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

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteMeeting(input.id);
      return { success: true };
    }),
});

// ============================================================================
// CONTACTS ROUTER
// ============================================================================

const contactsRouter = router({
  list: protectedProcedure.query(async () => {
    return await db.getAllContacts();
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const contact = await db.getContactById(input.id);
      if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });
      return contact;
    }),

  getMeetings: protectedProcedure
    .input(z.object({ contactId: z.number() }))
    .query(async ({ input }) => {
      return await db.getMeetingsForContact(input.contactId);
    }),

  search: protectedProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ input }) => {
      return await db.searchContacts(input.query);
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      email: z.string().optional(),
      phone: z.string().optional(),
      organization: z.string().optional(),
      title: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await db.createContact({
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        organization: input.organization ?? null,
        title: input.title ?? null,
        notes: input.notes ?? null,
      });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      email: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      organization: z.string().nullable().optional(),
      title: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      const cleanUpdates: any = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) cleanUpdates[key] = value;
      }
      await db.updateContact(id, cleanUpdates);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteContact(input.id);
      return { success: true };
    }),
});

// ============================================================================
// TASKS ROUTER
// ============================================================================

const tasksRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(["open", "in_progress", "completed"]).optional(),
        assignedTo: z.number().optional(),
        assignedName: z.string().optional(),
        meetingId: z.number().optional(),
        category: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      return await db.getAllTasks(input);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const task = await db.getTaskById(input.id);
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      return task;
    }),

  categories: protectedProcedure.query(async () => {
    return await db.getTaskCategories();
  }),

  assignees: protectedProcedure.query(async () => {
    return await db.getTaskAssignees();
  }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        description: z.string().optional(),
        priority: z.enum(["low", "medium", "high"]).default("medium"),
        assignedTo: z.number().optional(),
        assignedName: z.string().optional(),
        meetingId: z.number().optional(),
        dueDate: z.string().optional(),
        category: z.string().optional(),
        notes: z.string().optional(),
        isAutoGenerated: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const taskData = {
        title: input.title,
        description: input.description ?? null,
        priority: input.priority,
        assignedTo: input.assignedTo ?? null,
        assignedName: input.assignedName ?? null,
        meetingId: input.meetingId ?? null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        category: input.category ?? null,
        notes: input.notes ?? null,
        isAutoGenerated: input.isAutoGenerated,
        createdBy: ctx.user.id,
      };
      const taskId = await db.createTask(taskData);
      return { id: taskId };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(500).optional(),
        description: z.string().nullable().optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        status: z.enum(["open", "in_progress", "completed"]).optional(),
        assignedTo: z.number().nullable().optional(),
        assignedName: z.string().nullable().optional(),
        dueDate: z.string().nullable().optional(),
        category: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const updates: any = {};
      if (input.title) updates.title = input.title;
      if (input.description !== undefined) updates.description = input.description;
      if (input.priority) updates.priority = input.priority;
      if (input.status) updates.status = input.status;
      if (input.assignedTo !== undefined) updates.assignedTo = input.assignedTo;
      if (input.assignedName !== undefined) updates.assignedName = input.assignedName;
      if (input.dueDate !== undefined) {
        updates.dueDate = input.dueDate ? new Date(input.dueDate) : null;
      }
      if (input.category !== undefined) updates.category = input.category;
      if (input.notes !== undefined) updates.notes = input.notes;
      await db.updateTask(input.id, updates);
      return { success: true };
    }),

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
  list: protectedProcedure
    .input(z.object({ type: z.enum(["sector", "jurisdiction"]).optional() }).optional())
    .query(async ({ input }) => {
      return await db.getAllTags(input?.type);
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      type: z.enum(["sector", "jurisdiction"]),
    }))
    .mutation(async ({ input }) => {
      const tagId = await db.createTag({ name: input.name, type: input.type });
      return { id: tagId };
    }),
});

// ============================================================================
// USERS ROUTER
// ============================================================================

const usersRouter = router({
  list: protectedProcedure.query(async () => {
    return await db.getAllUsers();
  }),
});

// ============================================================================
// INGESTION ROUTER
// ============================================================================

const ingestionRouter = router({
  webhook: publicProcedure
    .input(z.any())
    .mutation(async ({ input }) => {
      const data = validateIntelligenceData(input);
      if (!data) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid intelligence data format" });
      const result = await processIntelligenceData(data);
      return result;
    }),
});

// ============================================================================
// EXPORT ROUTER
// ============================================================================

const exportRouter = router({
  dailySummary: protectedProcedure
    .input(z.object({ date: z.string().optional() }))
    .mutation(async ({ input }) => {
      const date = input.date ? new Date(input.date) : new Date();
      return await reportExporter.exportDailySummaryMarkdown(date);
    }),
  
  weeklySummary: protectedProcedure
    .input(z.object({ weekStart: z.string().optional() }))
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
  
  customRange: protectedProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
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
// ASK OMNISCOPE ROUTER
// ============================================================================

const askRouter = router({
  ask: protectedProcedure
    .input(z.object({ query: z.string() }))
    .mutation(async ({ input }) => {
      return await askOmniScope.askOmniScope(input.query);
    }),
  
  findByParticipant: protectedProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ input }) => {
      return await askOmniScope.findMeetingsByParticipant(input.name);
    }),
  
  findByOrganization: protectedProcedure
    .input(z.object({ name: z.string() }))
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
  getAllUsers: adminProcedure.query(async () => {
    return await db.getAllUsers();
  }),

  // Invitation-based user management
  createInvitation: adminProcedure
    .input(z.object({
      email: z.string().email(),
      fullName: z.string().min(1),
      role: z.enum(["user", "admin"]).default("user"),
    }))
    .mutation(async ({ input, ctx }) => {
      // Check if email already has an invitation
      const existing = await db.getInvitationByEmail(input.email);
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'An invitation already exists for this email' });
      }
      // Check if user already exists
      const existingUsers = await db.getAllUsers();
      if (existingUsers.some(u => u.email?.toLowerCase() === input.email.toLowerCase())) {
        throw new TRPCError({ code: 'CONFLICT', message: 'A user with this email already exists' });
      }
      const id = await db.createInvitation({
        email: input.email.toLowerCase(),
        fullName: input.fullName,
        role: input.role,
        invitedBy: ctx.user.id,
      });
      return { id, success: true };
    }),

  listInvitations: adminProcedure.query(async () => {
    return await db.getAllInvitations();
  }),

  deleteInvitation: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteInvitation(input.id);
      return { success: true };
    }),

  updateUserRole: adminProcedure
    .input(z.object({ userId: z.number(), role: z.enum(["user", "admin"]) }))
    .mutation(async ({ input }) => {
      await db.updateUser(input.userId, { role: input.role });
      return { success: true };
    }),

  deleteUser: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteUser(input.userId);
      return { success: true };
    }),

  importFathomMeetings: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(10),
      cursor: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return await fathomIntegration.importFathomMeetings({
        limit: input.limit,
        cursor: input.cursor,
      });
    }),

  registerFathomWebhook: adminProcedure
    .input(z.object({ webhookUrl: z.string().url() }))
    .mutation(async ({ input }) => {
      return await fathomIntegration.registerFathomWebhook(input.webhookUrl);
    }),

  listFathomWebhooks: adminProcedure.query(async () => {
    return await fathomIntegration.listFathomWebhooks();
  }),

  deleteFathomWebhook: adminProcedure
    .input(z.object({ webhookId: z.string() }))
    .mutation(async ({ input }) => {
      await fathomIntegration.deleteFathomWebhook(input.webhookId);
      return { success: true };
    }),
});

// ============================================================================
// MEETING CATEGORIES ROUTER
// ============================================================================

const meetingCategoriesRouter = router({
  getForMeeting: protectedProcedure
    .input(z.object({ meetingId: z.number() }))
    .query(async ({ input }) => {
      return await db.getCategoriesForMeeting(input.meetingId);
    }),

  add: protectedProcedure
    .input(z.object({ meetingId: z.number(), category: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await db.addCategoryToMeeting(input.meetingId, input.category);
      return { success: true };
    }),

  remove: protectedProcedure
    .input(z.object({ meetingId: z.number(), category: z.string() }))
    .mutation(async ({ input }) => {
      await db.removeCategoryFromMeeting(input.meetingId, input.category);
      return { success: true };
    }),

  listAll: protectedProcedure.query(async () => {
    return await db.getAllMeetingCategories();
  }),

  getMeetingsByCategory: protectedProcedure
    .input(z.object({ category: z.string() }))
    .query(async ({ input }) => {
      return await db.getMeetingsByCategory(input.category);
    }),
});

// ============================================================================
// ANALYTICS ROUTER
// ============================================================================

const analyticsRouter = router({
  dashboard: protectedProcedure.query(async () => {
    return await analytics.getDashboardMetrics();
  }),
  
  dailySummary: protectedProcedure
    .input(z.object({ date: z.string().optional() }))
    .query(async ({ input }) => {
      const date = input.date ? new Date(input.date) : new Date();
      return await analytics.getDailySummary(date);
    }),
  
  weeklySummary: protectedProcedure
    .input(z.object({ weekStart: z.string().optional() }))
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
      return { success: true } as const;
    }),
  }),
  meetings: meetingsRouter,
  contacts: contactsRouter,
  tasks: tasksRouter,
  tags: tagsRouter,
  users: usersRouter,
  ingestion: ingestionRouter,
  analytics: analyticsRouter,
  ask: askRouter,
  recap: recapRouter,
  export: exportRouter,
  admin: adminRouter,
  meetingCategories: meetingCategoriesRouter,
});

export type AppRouter = typeof appRouter;
