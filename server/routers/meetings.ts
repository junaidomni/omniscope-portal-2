import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { orgScopedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const meetingsRouter = router({
  list: orgScopedProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        primaryLead: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ input, ctx }) => {
      const filters = input ? {
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        primaryLead: input.primaryLead,
        limit: input.limit,
        offset: input.offset,
        orgId: ctx.orgId ?? undefined,
      } : ctx.orgId ? { orgId: ctx.orgId } : undefined;
      return await db.getAllMeetings(filters);
    }),

  getById: orgScopedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const meeting = await db.getMeetingById(input.id);
      if (!meeting) throw new TRPCError({ code: "NOT_FOUND", message: "Meeting not found" });
      return meeting;
    }),

  getTags: orgScopedProcedure
    .input(z.object({ meetingId: z.number() }))
    .query(async ({ ctx, input }) => {
      return await db.getTagsForMeeting(input.meetingId);
    }),

  getTasks: orgScopedProcedure
    .input(z.object({ meetingId: z.number() }))
    .query(async ({ ctx, input }) => {
      return await db.getTasksForMeeting(input.meetingId);
    }),

  getContacts: orgScopedProcedure
    .input(z.object({ meetingId: z.number() }))
    .query(async ({ ctx, input }) => {
      const contactsForMeeting = await db.getContactsForMeeting(input.meetingId);
      // Enrich each contact with last meeting date
      const enriched = await Promise.all(contactsForMeeting.map(async (mc: any) => {
        const contactMeetings = await db.getMeetingsForContact(mc.contact.id);
        const lastMeetingDate = contactMeetings.length > 0 ? contactMeetings[0].meeting.meetingDate : null;
        return { ...mc, lastMeetingDate };
      }));
      return enriched;
    }),

  search: orgScopedProcedure
    .input(z.object({
      query: z.string().min(1),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input, ctx }) => {
      return await db.searchMeetings(input.query, input.limit, ctx.orgId ?? undefined);
    }),

  filterByTags: orgScopedProcedure
    .input(z.object({ tagIds: z.array(z.number()).min(1) }))
    .query(async ({ input }) => {
      return await db.getMeetingsByTags(input.tagIds);
    }),

  create: orgScopedProcedure
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

  update: orgScopedProcedure
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

  delete: orgScopedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteMeeting(input.id);
      return { success: true };
    }),

  bulkDelete: orgScopedProcedure
    .input(z.object({ ids: z.array(z.number()).min(1, "Select at least one meeting") }))
    .mutation(async ({ input }) => {
      let deleted = 0;
      for (const id of input.ids) {
        try {
          await db.deleteMeeting(id);
          deleted++;
        } catch (e) {
          console.error(`[BulkDelete] Failed to delete meeting ${id}:`, e);
        }
      }
      return { success: true, deleted, total: input.ids.length };
    }),
});
