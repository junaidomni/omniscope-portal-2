import * as db from "../db";
import * as gmailService from "../gmailService";
import { TRPCError } from "@trpc/server";
import { getGoogleAuthUrl, isGoogleConnected, syncGoogleCalendarEvents } from "../googleCalendar";
import { invokeLLM } from "../_core/llm";
import { orgScopedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const mailRouter = router({
  listThreads: orgScopedProcedure
    .input(
      z.object({
        folder: z.enum(["inbox", "sent", "drafts", "starred", "all"]).default("inbox"),
        search: z.string().optional(),
        maxResults: z.number().min(1).max(50).default(25),
        pageToken: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return await gmailService.listGmailThreads(ctx.user.id, {
        folder: input.folder,
        search: input.search,
        maxResults: input.maxResults,
        pageToken: input.pageToken,
      });
    }),

  getThread: orgScopedProcedure
    .input(z.object({ threadId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await gmailService.getGmailThread(ctx.user.id, input.threadId);
    }),

  send: orgScopedProcedure
    .input(
      z.object({
        to: z.array(z.string().email()),
        cc: z.array(z.string().email()).optional(),
        bcc: z.array(z.string().email()).optional(),
        subject: z.string(),
        body: z.string(),
        isHtml: z.boolean().default(false),
        threadId: z.string().optional(),
        inReplyTo: z.string().optional(),
        references: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await gmailService.sendGmailEmailFull(ctx.user.id, input);
      if (!result.success) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.error || "Failed to send email" });
      }
      return result;
    }),

  getUnreadCount: orgScopedProcedure.query(async ({ ctx }) => {
    return { count: await gmailService.getUnreadCount(ctx.user.id) };
  }),

  toggleStar: orgScopedProcedure
    .input(z.object({ messageId: z.string(), starred: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const ok = await gmailService.toggleStar(ctx.user.id, input.messageId, input.starred);
      if (!ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to toggle star" });
      return { success: true };
    }),

  toggleRead: orgScopedProcedure
    .input(z.object({ messageId: z.string(), read: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const ok = await gmailService.toggleRead(ctx.user.id, input.messageId, input.read);
      if (!ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to toggle read" });
      return { success: true };
    }),

  trash: orgScopedProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const ok = await gmailService.trashMessage(ctx.user.id, input.messageId);
      if (!ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to trash message" });
      return { success: true };
    }),

  syncHeaders: orgScopedProcedure
    .input(z.object({ maxResults: z.number().min(10).max(500).default(100) }).optional())
    .mutation(async ({ ctx, input }) => {
      return await gmailService.syncEmailHeaders(ctx.user.id, { maxResults: input?.maxResults });
    }),

  getByContact: orgScopedProcedure
    .input(z.object({ contactEmail: z.string(), maxResults: z.number().default(15) }))
    .query(async ({ ctx, input }) => {
      return await gmailService.getEmailsByContact(ctx.user.id, input.contactEmail, input.maxResults);
    }),

  connectionStatus: orgScopedProcedure.query(async ({ ctx }) => {
    return await isGoogleConnected(ctx.user.id);
  }),

  getAuthUrl: orgScopedProcedure
    .input(z.object({ origin: z.string(), returnPath: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const url = getGoogleAuthUrl(input.origin, ctx.user.id, input.returnPath);
      return { url, redirectUri: `${input.origin}/api/google/callback` };
    }),

  // Star Priority System
  getStar: orgScopedProcedure
    .input(z.object({ threadId: z.string() }))
    .query(async ({ ctx, input }) => {
      const star = await db.getEmailStar(input.threadId, ctx.user.id);
      return star ? { starLevel: star.starLevel } : null;
    }),

  getStars: orgScopedProcedure.query(async ({ ctx }) => {
    return await db.getEmailStarsForUser(ctx.user.id);
  }),

  setStar: orgScopedProcedure
    .input(z.object({ threadId: z.string(), starLevel: z.number().min(1).max(3) }))
    .mutation(async ({ ctx, input }) => {
      return await db.setEmailStar(input.threadId, ctx.user.id, input.starLevel);
    }),

  removeStar: orgScopedProcedure
    .input(z.object({ threadId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await db.removeEmailStar(input.threadId, ctx.user.id);
    }),

  // Email-to-Company Links
  getCompanyLinks: orgScopedProcedure
    .input(z.object({ threadId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await db.getEmailCompanyLinks(input.threadId);
    }),

  linkToCompany: orgScopedProcedure
    .input(z.object({ threadId: z.string(), companyId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return await db.linkEmailToCompany(input.threadId, input.companyId, ctx.user.id);
    }),

  unlinkCompany: orgScopedProcedure
    .input(z.object({ linkId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return await db.unlinkEmailFromCompany(input.linkId);
    }),

  // AI Thread Summary
  getThreadSummary: orgScopedProcedure
    .input(z.object({ threadId: z.string() }))
    .query(async ({ ctx, input }) => {
      const cached = await db.getThreadSummary(input.threadId, ctx.user.id);
      if (!cached) return null;
      return {
        summary: cached.summary,
        keyPoints: cached.keyPoints ? JSON.parse(cached.keyPoints) : [],
        actionItems: cached.actionItems ? JSON.parse(cached.actionItems) : [],
        entities: cached.entities ? JSON.parse(cached.entities) : [],
        messageCount: cached.messageCount,
        createdAt: cached.createdAt,
        updatedAt: cached.updatedAt,
      };
    }),

  summarizeThread: orgScopedProcedure
    .input(z.object({ threadId: z.string(), force: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      // Check cache first (unless force refresh)
      if (!input.force) {
        const cached = await db.getThreadSummary(input.threadId, ctx.user.id);
        if (cached) {
          return {
            summary: cached.summary,
            keyPoints: cached.keyPoints ? JSON.parse(cached.keyPoints) : [],
            actionItems: cached.actionItems ? JSON.parse(cached.actionItems) : [],
            entities: cached.entities ? JSON.parse(cached.entities) : [],
            messageCount: cached.messageCount,
            cached: true,
          };
        }
      }

      // Fetch thread messages
      const threadData = await gmailService.getGmailThread(ctx.user.id, input.threadId);
      if (!threadData?.messages?.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Thread not found or empty" });
      }

      const messages = threadData.messages;
      // Build conversation text for LLM
      const conversationText = messages.map((msg: any) => {
        const body = (msg.body || msg.bodyHtml || msg.snippet || "").replace(/<[^>]+>/g, "").trim();
        const date = new Date(parseInt(msg.internalDate)).toISOString();
        return `[${date}] ${msg.fromName || msg.fromEmail} <${msg.fromEmail}>:\n${body}`;
      }).join("\n\n---\n\n");

      const { invokeLLM } = await import("../_core/llm");
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are OmniScope Intelligence — a private, institutional-grade email analysis engine.
Your tone is precise, discreet, and professional. No fluff.

Analyze the email thread and return a JSON object with:
- "summary": A concise 2-3 sentence executive summary of the entire conversation
- "keyPoints": An array of 3-5 key points or decisions from the thread
- "actionItems": An array of action items or follow-ups identified (empty array if none)
- "entities": An array of notable entities mentioned (companies, people, amounts, jurisdictions)

Return ONLY valid JSON. No markdown, no code blocks.`,
          },
          {
            role: "user",
            content: `Summarize this email thread (${messages.length} messages):\n\n${conversationText.substring(0, 12000)}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "thread_summary",
            strict: true,
            schema: {
              type: "object",
              properties: {
                summary: { type: "string", description: "Executive summary" },
                keyPoints: { type: "array", items: { type: "string" }, description: "Key points" },
                actionItems: { type: "array", items: { type: "string" }, description: "Action items" },
                entities: { type: "array", items: { type: "string" }, description: "Notable entities" },
              },
              required: ["summary", "keyPoints", "actionItems", "entities"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = result.choices?.[0]?.message?.content as string | undefined;
      if (!content) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "LLM returned empty response" });
      }

      let parsed: { summary: string; keyPoints: string[]; actionItems: string[]; entities: string[] };
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to parse LLM response" });
      }

      // Cache the result
      await db.upsertThreadSummary(input.threadId, ctx.user.id, {
        summary: parsed.summary,
        keyPoints: parsed.keyPoints,
        actionItems: parsed.actionItems,
        entities: parsed.entities,
        messageCount: messages.length,
      });

      return {
        ...parsed,
        messageCount: messages.length,
        cached: false,
      };
    }),

  // Convert to Task
  // Legacy single task (kept for backward compat)
  convertToTask: orgScopedProcedure
    .input(z.object({
      threadId: z.string(),
      subject: z.string(),
      fromEmail: z.string(),
      title: z.string().min(1).max(500),
      description: z.string().optional(),
      priority: z.enum(["low", "medium", "high"]).default("medium"),
      assignedName: z.string().optional(),
      assigneeContactId: z.number().optional(),
      dueDate: z.string().optional(),
      category: z.string().optional(),
      contactId: z.number().optional(),
      companyId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const taskData = {
        title: input.title,
        description: input.description || `Converted from email: ${input.subject}\nFrom: ${input.fromEmail}`,
        priority: input.priority,
        assignedName: input.assignedName ?? null,
        assigneeContactId: input.assigneeContactId ?? null,
        assignedTo: null,
        meetingId: null,
        sourceThreadId: input.threadId,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        category: input.category ?? null,
        contactId: input.contactId ?? null,
        companyId: input.companyId ?? null,
        notes: `Email thread: ${input.threadId}`,
        isAutoGenerated: false,
        createdBy: ctx.user.id,
      };
      const taskId = await db.createTask(taskData);
      return { id: taskId, threadId: input.threadId };
    }),

  // Multi-task creation from email
  convertToTasks: orgScopedProcedure
    .input(z.object({
      threadId: z.string(),
      subject: z.string(),
      fromEmail: z.string(),
      tasks: z.array(z.object({
        title: z.string().min(1).max(500),
        description: z.string().optional(),
        priority: z.enum(["low", "medium", "high"]).default("medium"),
        assignedName: z.string().optional(),
        assigneeContactId: z.number().optional(),
        dueDate: z.string().optional(),
        category: z.string().optional(),
        contactId: z.number().optional(),
        companyId: z.number().optional(),
      })).min(1).max(20),
    }))
    .mutation(async ({ ctx, input }) => {
      const taskList = input.tasks.map(t => ({
        title: t.title,
        description: t.description || `From email: ${input.subject}`,
        priority: t.priority,
        assigneeContactId: t.assigneeContactId ?? null,
        assignedName: t.assignedName ?? null,
        dueDate: t.dueDate ? new Date(t.dueDate) : null,
        category: t.category ?? null,
        sourceThreadId: input.threadId,
        contactId: t.contactId ?? null,
        companyId: t.companyId ?? null,
        createdBy: ctx.user.id,
      }));
      const ids = await db.createTasksFromEmail(taskList);
      return { ids, threadId: input.threadId, count: ids.length };
    }),

  // Get tasks linked to a thread
  getThreadTasks: orgScopedProcedure
    .input(z.object({ threadId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await db.getTasksByThreadId(input.threadId);
    }),

  // Bulk Star Assignment
  bulkSetStars: orgScopedProcedure
    .input(z.object({
      threadIds: z.array(z.string()).min(1).max(100),
      starLevel: z.number().min(1).max(3),
    }))
    .mutation(async ({ ctx, input }) => {
      const results = await db.bulkSetEmailStars(input.threadIds, ctx.user.id, input.starLevel);
      return { updated: results.length, starLevel: input.starLevel };
    }),

  bulkRemoveStars: orgScopedProcedure
    .input(z.object({
      threadIds: z.array(z.string()).min(1).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await db.bulkRemoveEmailStars(input.threadIds, ctx.user.id);
      return result;
    }),

  // Email Analytics
  analytics: orgScopedProcedure.query(async ({ ctx }) => {
    return await db.getEmailAnalytics(ctx.user.id);
  }),

  // AI Task Extraction from Email Thread
  extractTasks: orgScopedProcedure
    .input(z.object({ threadId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Fetch thread messages
      const threadData = await gmailService.getGmailThread(ctx.user.id, input.threadId);
      if (!threadData?.messages?.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Thread not found or empty" });
      }

      const messages = threadData.messages;
      const conversationText = messages.map((msg: any) => {
        const body = (msg.body || msg.bodyHtml || msg.snippet || "").replace(/<[^>]+>/g, "").trim();
        const date = new Date(parseInt(msg.internalDate)).toISOString();
        return `[${date}] ${msg.fromName || msg.fromEmail} <${msg.fromEmail}>:\n${body}`;
      }).join("\n\n---\n\n");

      const { invokeLLM } = await import("../_core/llm");
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are OmniScope Intelligence — a private, institutional-grade task extraction engine.
Your job is to read an email thread and extract every actionable task, follow-up, or deliverable.

For each task, determine:
- "title": A clear, concise task title (action verb + object)
- "description": Brief context from the email (1-2 sentences)
- "priority": "high" (urgent/deadline-driven), "medium" (important but flexible), or "low" (nice-to-have)
- "assignee": The person's name who should do this (if mentioned or implied), or null
- "assigneeEmail": Their email if visible in the thread, or null
- "dueDateHint": Any mentioned deadline or timeframe (e.g. "by Friday", "next week", "ASAP"), or null
- "category": One of "compliance", "finance", "operations", "communications", "legal", "general"

Return a JSON object with:
- "tasks": Array of task objects (1-10 tasks)
- "threadContext": One sentence describing what this thread is about

Be thorough — extract ALL action items, even implicit ones. If someone says "I'll send you the docs" that's a task.
Return ONLY valid JSON. No markdown, no code blocks.`,
          },
          {
            role: "user",
            content: `Extract all action items from this email thread (${messages.length} messages):\n\n${conversationText.substring(0, 12000)}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "extracted_tasks",
            strict: true,
            schema: {
              type: "object",
              properties: {
                threadContext: { type: "string", description: "One sentence thread context" },
                tasks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      description: { type: "string" },
                      priority: { type: "string" },
                      assignee: { type: ["string", "null"] },
                      assigneeEmail: { type: ["string", "null"] },
                      dueDateHint: { type: ["string", "null"] },
                      category: { type: "string" },
                    },
                    required: ["title", "description", "priority", "assignee", "assigneeEmail", "dueDateHint", "category"],
                    additionalProperties: false,
                  },
                  description: "Extracted tasks",
                },
              },
              required: ["threadContext", "tasks"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = result.choices?.[0]?.message?.content as string | undefined;
      if (!content) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "LLM returned empty response" });
      }

      let parsed: {
        threadContext: string;
        tasks: Array<{
          title: string;
          description: string;
          priority: string;
          assignee: string | null;
          assigneeEmail: string | null;
          dueDateHint: string | null;
          category: string;
        }>;
      };
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to parse LLM response" });
      }

      // Try to match assignees to existing contacts
      const enrichedTasks = await Promise.all(
        parsed.tasks.map(async (task) => {
          let contactId: number | null = null;
          let contactName: string | null = task.assignee;

          if (task.assigneeEmail) {
            const contact = await db.findContactByEmail(task.assigneeEmail);
            if (contact) {
              contactId = contact.id;
              contactName = contact.name;
            }
          } else if (task.assignee) {
            const results = await db.directorySearch(task.assignee, 1, ctx.orgId ?? undefined);
            if (results.length > 0) {
              contactId = results[0].id;
              contactName = results[0].name;
            }
          }

          return {
            ...task,
            assigneeContactId: contactId,
            assigneeName: contactName,
          };
        })
      );

      return {
        threadContext: parsed.threadContext,
        tasks: enrichedTasks,
        messageCount: messages.length,
      };
    }),
});
