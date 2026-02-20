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
import { storagePut } from "./storage";
import * as gmailService from "./gmailService";
import { getGoogleAuthUrl, isGoogleConnected, syncGoogleCalendarEvents } from "./googleCalendar";
import { getSigningAdapter, getAllAdapters, getAdapterInfo } from "./signingAdapters";
import type { ProviderConfig } from "./signingAdapters";
import { invokeLLM } from "./_core/llm";
import * as googleDrive from "./googleDrive";

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

  getContacts: protectedProcedure
    .input(z.object({ meetingId: z.number() }))
    .query(async ({ input }) => {
      const contactsForMeeting = await db.getContactsForMeeting(input.meetingId);
      // Enrich each contact with last meeting date
      const enriched = await Promise.all(contactsForMeeting.map(async (mc: any) => {
        const contactMeetings = await db.getMeetingsForContact(mc.contact.id);
        const lastMeetingDate = contactMeetings.length > 0 ? contactMeetings[0].meeting.meetingDate : null;
        return { ...mc, lastMeetingDate };
      }));
      return enriched;
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
    const allContacts = await db.getContactsWithCompany();
    const enriched = await Promise.all(allContacts.map(async (c: any) => {
      const contactMeetings = await db.getMeetingsForContact(c.id);
      const lastMeetingDate = contactMeetings.length > 0 ? contactMeetings[0].meeting.meetingDate : null;
      const daysSinceLastMeeting = lastMeetingDate
        ? Math.floor((Date.now() - new Date(lastMeetingDate).getTime()) / 86400000)
        : null;
      return {
        ...c,
        meetingCount: contactMeetings.length,
        lastMeetingDate,
        daysSinceLastMeeting,
      };
    }));
    return enriched;
  }),

  searchByName: protectedProcedure
    .input(z.object({ query: z.string().min(1), limit: z.number().min(1).max(50).default(10) }))
    .query(async ({ input }) => {
      const allContacts = await db.getAllContacts();
      const q = input.query.toLowerCase().trim();
      const matched = allContacts
        .filter((c: any) => {
          const name = (c.name || '').toLowerCase();
          const email = (c.email || '').toLowerCase();
          const org = (c.organization || '').toLowerCase();
          return name.includes(q) || email.includes(q) || org.includes(q);
        })
        .slice(0, input.limit)
        .map((c: any) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          organization: c.organization,
          category: c.category,
          photoUrl: c.photoUrl,
        }));
      return matched;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const contact = await db.getContactById(input.id);
      if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });
      return contact;
    }),

  getProfile: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const profile = await db.getContactProfile(input.id);
      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });
      return profile;
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
      category: z.enum(["client", "prospect", "partner", "vendor", "other"]).optional(),
      starred: z.boolean().optional(),
      companyId: z.number().nullable().optional(),
      source: z.string().optional(),
      tags: z.string().optional(), // JSON array string
    }))
    .mutation(async ({ input }) => {
      const id = await db.createContact({
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        organization: input.organization ?? null,
        title: input.title ?? null,
        notes: input.notes ?? null,
        category: input.category ?? "other",
        starred: input.starred ?? false,
        companyId: input.companyId ?? null,
        source: input.source ?? "manual",
        tags: input.tags ?? null,
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
      dateOfBirth: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
      website: z.string().nullable().optional(),
      linkedin: z.string().nullable().optional(),
      category: z.enum(["client", "prospect", "partner", "vendor", "other"]).nullable().optional(),
      starred: z.boolean().optional(),
      rating: z.number().min(1).max(5).nullable().optional(),
      photoUrl: z.string().nullable().optional(),
      companyId: z.number().nullable().optional(),
      tags: z.string().nullable().optional(),
      source: z.string().nullable().optional(),
      approvalStatus: z.enum(["approved", "pending", "rejected"]).optional(),
      riskTier: z.enum(["low", "medium", "high", "critical"]).nullable().optional(),
      complianceStage: z.enum(["not_started", "in_progress", "cleared", "flagged"]).nullable().optional(),
      influenceWeight: z.enum(["decision_maker", "influencer", "gatekeeper", "champion", "end_user"]).nullable().optional(),
      introducerSource: z.string().nullable().optional(),
      referralChain: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      const cleanUpdates: any = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) cleanUpdates[key] = value;
      }
      // If name is being updated, propagate across the system
      if (cleanUpdates.name) {
        const oldContact = await db.getContactById(id);
        if (oldContact && oldContact.name !== cleanUpdates.name) {
          await db.propagateContactNameChange(id, oldContact.name, cleanUpdates.name);
        }
      }
      await db.updateContact(id, cleanUpdates);
      return { success: true };
    }),

  toggleStar: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const contact = await db.getContactById(input.id);
      if (!contact) throw new TRPCError({ code: "NOT_FOUND" });
      await db.updateContact(input.id, { starred: !contact.starred });
      return { starred: !contact.starred };
    }),

  getNotes: protectedProcedure
    .input(z.object({ contactId: z.number() }))
    .query(async ({ input }) => {
      return await db.getNotesForContact(input.contactId);
    }),

  addNote: protectedProcedure
    .input(z.object({ contactId: z.number(), content: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const id = await db.createContactNote({
        contactId: input.contactId,
        content: input.content,
        createdBy: ctx.user.id,
        createdByName: ctx.user.name ?? "Unknown",
      });
      return { id };
    }),

  deleteNote: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteContactNote(input.id);
      return { success: true };
    }),

  checkDuplicates: protectedProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ input }) => {
      const allContacts = await db.getAllContacts();
      const nameLower = input.name.toLowerCase().trim();
      const duplicates = allContacts.filter(c => {
        const cName = c.name.toLowerCase().trim();
        if (cName === nameLower) return true;
        // Fuzzy: check if names share significant overlap
        const nameWords = nameLower.split(/\s+/);
        const cWords = cName.split(/\s+/);
        const shared = nameWords.filter(w => cWords.some(cw => cw.includes(w) || w.includes(cw)));
        return shared.length >= Math.min(nameWords.length, cWords.length) && shared.length > 0 && nameLower !== cName;
      });
      return duplicates;
    }),

  mergeContacts: protectedProcedure
    .input(z.object({ keepId: z.number(), mergeId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const keep = await db.getContactById(input.keepId);
      const merge = await db.getContactById(input.mergeId);
      if (!keep || !merge) throw new TRPCError({ code: "NOT_FOUND" });
      // Transfer meeting links from merge to keep
      const mergeMeetings = await db.getMeetingsForContact(input.mergeId);
      for (const mm of mergeMeetings) {
        try { await db.linkContactToMeeting(mm.meeting.id, input.keepId); } catch {}
      }
      // Fill in missing fields from merge contact
      const updates: any = {};
      if (!keep.email && merge.email) updates.email = merge.email;
      if (!keep.phone && merge.phone) updates.phone = merge.phone;
      if (!keep.organization && merge.organization) updates.organization = merge.organization;
      if (!keep.title && merge.title) updates.title = merge.title;
      if (!keep.dateOfBirth && merge.dateOfBirth) updates.dateOfBirth = merge.dateOfBirth;
      if (!keep.address && merge.address) updates.address = merge.address;
      if (!keep.website && merge.website) updates.website = merge.website;
      if (!keep.linkedin && merge.linkedin) updates.linkedin = merge.linkedin;
      if (Object.keys(updates).length > 0) await db.updateContact(input.keepId, updates);
      await db.deleteContact(input.mergeId);
      // Save alias so the system learns this name maps to the kept contact
      if (merge.name && merge.name.toLowerCase() !== keep.name?.toLowerCase()) {
        await db.saveContactAlias(ctx.user.id, input.keepId, merge.name, merge.email || undefined, "merge");
      }
      if (merge.email && merge.email !== keep.email) {
        await db.saveContactAlias(ctx.user.id, input.keepId, merge.name || merge.email, merge.email, "merge");
      }
      await db.logActivity({ userId: ctx.user.id, action: "merge_contacts", entityType: "contact", entityId: String(input.keepId), entityName: keep.name, details: `Merged "${merge.name}" into "${keep.name}"`, metadata: JSON.stringify({ keepId: input.keepId, mergeId: input.mergeId, mergeName: merge.name, fieldsTransferred: Object.keys(updates) }) });
      return { success: true };
    }),

  approve: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const contact = await db.getContactById(input.id);
      await db.updateContact(input.id, { approvalStatus: "approved" });
      await db.logActivity({ userId: ctx.user.id, action: "approve_contact", entityType: "contact", entityId: String(input.id), entityName: contact?.name || "Unknown" });
      return { success: true };
    }),

  reject: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const contact = await db.getContactById(input.id);
      await db.updateContact(input.id, { approvalStatus: "rejected" });
      await db.logActivity({ userId: ctx.user.id, action: "reject_contact", entityType: "contact", entityId: String(input.id), entityName: contact?.name || "Unknown" });
      return { success: true };
    }),

  bulkApprove: protectedProcedure
    .input(z.object({ ids: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      for (const id of input.ids) {
        await db.updateContact(id, { approvalStatus: "approved" });
      }
      await db.logActivity({ userId: ctx.user.id, action: "bulk_approve_contacts", entityType: "contact", entityId: input.ids.join(","), details: `Bulk approved ${input.ids.length} contacts` });
      return { success: true, count: input.ids.length };
    }),

  bulkReject: protectedProcedure
    .input(z.object({ ids: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      for (const id of input.ids) {
        await db.updateContact(id, { approvalStatus: "rejected" });
      }
      await db.logActivity({ userId: ctx.user.id, action: "bulk_reject_contacts", entityType: "contact", entityId: input.ids.join(","), details: `Bulk rejected ${input.ids.length} contacts` });
      return { success: true, count: input.ids.length };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteContact(input.id);
      return { success: true };
    }),

  // ========== PENDING SUGGESTIONS ==========

  pendingSuggestions: protectedProcedure
    .input(z.object({ type: z.string().optional(), status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const suggestions = await db.getPendingSuggestions({
        type: input?.type,
        status: input?.status || "pending",
      });
      // Enrich with contact/company names
      const enriched = await Promise.all(suggestions.map(async (s) => {
        const contact = s.contactId ? await db.getContactById(s.contactId) : null;
        const company = s.companyId ? await db.getCompanyById(s.companyId) : null;
        const suggestedCompany = s.suggestedCompanyId ? await db.getCompanyById(s.suggestedCompanyId) : null;
        return {
          ...s,
          contactName: contact?.name || null,
          contactEmail: contact?.email || null,
          companyName: company?.name || null,
          suggestedCompanyName: suggestedCompany?.name || null,
          suggestedData: s.suggestedData ? JSON.parse(s.suggestedData) : null,
        };
      }));
      return enriched;
    }),

  pendingSuggestionsCount: protectedProcedure
    .query(async () => {
      return await db.getPendingSuggestionsCount();
    }),

  approveSuggestion: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const suggestion = await db.getPendingSuggestionById(input.id);
      if (!suggestion) throw new TRPCError({ code: "NOT_FOUND" });
      if (suggestion.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "Already reviewed" });

      // Apply the suggestion based on type
      if (suggestion.type === "company_link" && suggestion.contactId && suggestion.suggestedCompanyId) {
        await db.updateContact(suggestion.contactId, { companyId: suggestion.suggestedCompanyId });
      } else if (suggestion.type === "enrichment" && suggestion.contactId && suggestion.suggestedData) {
        const data = JSON.parse(suggestion.suggestedData);
        await db.updateContact(suggestion.contactId, data);
      } else if (suggestion.type === "company_enrichment" && suggestion.companyId && suggestion.suggestedData) {
        const data = JSON.parse(suggestion.suggestedData);
        await db.updateCompany(suggestion.companyId, data);
      }

      await db.updatePendingSuggestion(input.id, {
        status: "approved",
        reviewedAt: new Date(),
        reviewedBy: ctx.user.id,
      });
      await db.logActivity({ userId: ctx.user.id, action: "approve_suggestion", entityType: "suggestion", entityId: String(input.id), entityName: suggestion.type, details: `Approved ${suggestion.type} suggestion`, metadata: suggestion.suggestedData || undefined });
      return { success: true };
    }),

  rejectSuggestion: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const suggestion = await db.getPendingSuggestionById(input.id);
      if (!suggestion) throw new TRPCError({ code: "NOT_FOUND" });

      await db.updatePendingSuggestion(input.id, {
        status: "rejected",
        reviewedAt: new Date(),
        reviewedBy: ctx.user.id,
      });
      await db.logActivity({ userId: ctx.user.id, action: "reject_suggestion", entityType: "suggestion", entityId: String(input.id), entityName: suggestion.type, details: `Dismissed ${suggestion.type} suggestion` });
      return { success: true };
    }),

  bulkApproveSuggestions: protectedProcedure
    .input(z.object({ ids: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      let approved = 0;
      for (const id of input.ids) {
        try {
          const suggestion = await db.getPendingSuggestionById(id);
          if (!suggestion || suggestion.status !== "pending") continue;
          if (suggestion.type === "company_link" && suggestion.contactId && suggestion.suggestedCompanyId) {
            await db.updateContact(suggestion.contactId, { companyId: suggestion.suggestedCompanyId });
          } else if (suggestion.type === "enrichment" && suggestion.contactId && suggestion.suggestedData) {
            await db.updateContact(suggestion.contactId, JSON.parse(suggestion.suggestedData));
          } else if (suggestion.type === "company_enrichment" && suggestion.companyId && suggestion.suggestedData) {
            await db.updateCompany(suggestion.companyId, JSON.parse(suggestion.suggestedData));
          }
          await db.updatePendingSuggestion(id, { status: "approved", reviewedAt: new Date(), reviewedBy: ctx.user.id });
          approved++;
        } catch {}
      }
      await db.logActivity({ userId: ctx.user.id, action: "bulk_approve_suggestions", entityType: "suggestion", entityId: input.ids.join(","), details: `Bulk approved ${approved} suggestions` });
      return { success: true, count: approved };
    }),

  bulkRejectSuggestions: protectedProcedure
    .input(z.object({ ids: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      let rejected = 0;
      for (const id of input.ids) {
        try {
          await db.updatePendingSuggestion(id, { status: "rejected", reviewedAt: new Date(), reviewedBy: ctx.user.id });
          rejected++;
        } catch {}
      }
      await db.logActivity({ userId: ctx.user.id, action: "bulk_reject_suggestions", entityType: "suggestion", entityId: input.ids.join(","), details: `Bulk rejected ${rejected} suggestions` });
      return { success: true, count: rejected };
    }),

  syncFromMeetings: protectedProcedure
    .mutation(async () => {
      const allMeetings = await db.getAllMeetings({ limit: 500 });
      let created = 0;
      let linked = 0;
      for (const meeting of allMeetings) {
        try {
          const participants = JSON.parse(meeting.participants || '[]');
          for (const name of participants) {
            if (!name || typeof name !== 'string' || name.trim() === '') continue;
            const contact = await db.getOrCreateContact(name.trim());
            if (contact) {
              try {
                await db.linkContactToMeeting(meeting.id, contact.id);
                linked++;
              } catch (e: any) {
                // Ignore duplicate link errors
              }
            }
          }
        } catch (e) {
          // Skip meetings with invalid participants JSON
        }
      }
      return { success: true, created, linked, meetings: allMeetings.length };
    }),

  detectDuplicates: protectedProcedure
    .query(async () => {
      const contacts = await db.getAllContacts();
      const duplicates: { group: any[] }[] = [];
      const processed = new Set<number>();
      
      for (let i = 0; i < contacts.length; i++) {
        if (processed.has(contacts[i].id)) continue;
        const group: any[] = [contacts[i]];
        const nameA = contacts[i].name.toLowerCase().trim();
        const emailA = contacts[i].email?.toLowerCase().trim();
        
        for (let j = i + 1; j < contacts.length; j++) {
          if (processed.has(contacts[j].id)) continue;
          const nameB = contacts[j].name.toLowerCase().trim();
          const emailB = contacts[j].email?.toLowerCase().trim();
          
          // Exact name match
          if (nameA === nameB) { group.push(contacts[j]); processed.add(contacts[j].id); continue; }
          // Email match
          if (emailA && emailB && emailA === emailB) { group.push(contacts[j]); processed.add(contacts[j].id); continue; }
          // Fuzzy: one name contains the other
          if (nameA.length > 3 && nameB.length > 3 && (nameA.includes(nameB) || nameB.includes(nameA))) {
            group.push(contacts[j]); processed.add(contacts[j].id); continue;
          }
          // First+last name swap detection
          const partsA = nameA.split(/\s+/);
          const partsB = nameB.split(/\s+/);
          if (partsA.length >= 2 && partsB.length >= 2) {
            if (partsA[0] === partsB[partsB.length - 1] && partsA[partsA.length - 1] === partsB[0]) {
              group.push(contacts[j]); processed.add(contacts[j].id); continue;
            }
          }
        }
        if (group.length > 1) {
          processed.add(contacts[i].id);
          duplicates.push({ group });
        }
      }
      return duplicates;
    }),

  generateAiSummary: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const contact = await db.getContactById(input.id);
      if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });

      const contactMeetings = await db.getMeetingsForContact(input.id);
      
      // Also check meetings by participant name
      const allMeetings = await db.getAllMeetings({ limit: 500 });
      const nameMatches = allMeetings.filter(m => {
        try {
          const participants = JSON.parse(m.participants || '[]');
          return participants.some((p: string) => 
            p.toLowerCase().includes(contact.name.toLowerCase()) ||
            contact.name.toLowerCase().includes(p.toLowerCase())
          );
        } catch { return false; }
      });

      const meetingIds = new Set<number>();
      const allRelevantMeetings: any[] = [];
      for (const mc of contactMeetings) {
        if (!meetingIds.has(mc.meeting.id)) {
          meetingIds.add(mc.meeting.id);
          allRelevantMeetings.push(mc.meeting);
        }
      }
      for (const m of nameMatches) {
        if (!meetingIds.has(m.id)) {
          meetingIds.add(m.id);
          allRelevantMeetings.push(m);
        }
      }

      if (allRelevantMeetings.length === 0) {
        return { summary: "No meetings recorded with this contact yet." };
      }

      const meetingSummaries = allRelevantMeetings
        .sort((a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime())
        .slice(0, 15)
        .map(m => {
          const date = new Date(m.meetingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          return `- ${date}: "${m.meetingTitle || 'Untitled'}" — ${m.executiveSummary?.substring(0, 200) || 'No summary'}`;
        })
        .join('\n');

      const contactTasks = await db.getTasksForContact(contact.name);
      const taskSummary = contactTasks.slice(0, 10).map(t => 
        `- [${t.status}] ${t.title}`
      ).join('\n');

      const { invokeLLM } = await import("./_core/llm");
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an intelligence analyst for OmniScope, a sovereign-grade financial infrastructure platform. Write a concise, institutional-grade relationship summary about a contact based on meeting history. Focus on: relationship context, key topics discussed, business opportunities, and engagement level. Be specific and factual. Write 3-5 sentences.`
          },
          {
            role: "user",
            content: `Generate a relationship intelligence summary for ${contact.name}${contact.organization ? ` (${contact.organization})` : ''}.

Meeting History (${allRelevantMeetings.length} meetings):
${meetingSummaries || 'No meetings found'}

Assigned Tasks:
${taskSummary || 'No tasks assigned'}`
          }
        ],
      });

      const summary = (result.choices[0]?.message?.content as string) || "Unable to generate summary.";
      await db.updateContact(input.id, { aiSummary: summary });
      return { summary };
    }),

  // AI Enrichment - extract contact info from meeting transcripts
  enrichWithAI: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const contact = await db.getContactById(input.id);
      if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });

      // Get all meetings involving this contact
      const contactMeetings = await db.getMeetingsForContact(input.id);
      const allMeetings = await db.getAllMeetings({ limit: 500 });
      const nameMatches = allMeetings.filter(m => {
        try {
          const participants = JSON.parse(m.participants || '[]');
          return participants.some((p: string) =>
            p.toLowerCase().includes(contact.name.toLowerCase()) ||
            contact.name.toLowerCase().includes(p.toLowerCase())
          );
        } catch { return false; }
      });

      const meetingIds = new Set<number>();
      const allRelevantMeetings: any[] = [];
      for (const mc of contactMeetings) {
        if (!meetingIds.has(mc.meeting.id)) {
          meetingIds.add(mc.meeting.id);
          allRelevantMeetings.push(mc.meeting);
        }
      }
      for (const m of nameMatches) {
        if (!meetingIds.has(m.id)) {
          meetingIds.add(m.id);
          allRelevantMeetings.push(m);
        }
      }

      // Check if this contact is also an employee
      const employee = await db.getEmployeeByContactId(input.id);

      // Build context from all meeting transcripts and summaries
      const meetingContext = allRelevantMeetings
        .sort((a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime())
        .slice(0, 10)
        .map(m => {
          const date = new Date(m.meetingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          const summary = m.executiveSummary?.substring(0, 500) || '';
          const transcript = m.fullTranscript?.substring(0, 1000) || '';
          return `Meeting (${date}): ${m.meetingTitle || 'Untitled'}\nSummary: ${summary}\nTranscript excerpt: ${transcript}`;
        })
        .join('\n\n');

      const { invokeLLM } = await import("./_core/llm");
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an AI assistant for OmniScope, a sovereign-grade financial infrastructure platform. Analyze meeting transcripts and summaries to extract contact information. Return a JSON object with ONLY the fields you can confidently extract. Do not guess or fabricate information. Only include a field if you find clear evidence in the text.

Return JSON with these optional fields:
- email: email address
- phone: phone number
- organization: company/org name
- title: job title/role
- website: company or personal website
- linkedin: LinkedIn profile URL
- address: physical address
- notes: key relationship context (2-3 sentences)

IMPORTANT: Only include fields where you have high confidence from the meeting data. Return {} if nothing can be extracted.`
          },
          {
            role: "user",
            content: `Extract contact information for "${contact.name}" from these meeting records:\n\n${meetingContext || 'No meeting data available'}\n\nCurrent known info: email=${contact.email || 'unknown'}, phone=${contact.phone || 'unknown'}, org=${contact.organization || 'unknown'}, title=${contact.title || 'unknown'}${employee ? `\n\nNote: This person is also an employee (${employee.firstName} ${employee.lastName}, ${employee.jobTitle}, ${employee.email})` : ''}`
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "contact_enrichment",
            strict: true,
            schema: {
              type: "object",
              properties: {
                email: { type: "string", description: "Email address" },
                phone: { type: "string", description: "Phone number" },
                organization: { type: "string", description: "Company/org" },
                title: { type: "string", description: "Job title" },
                website: { type: "string", description: "Website URL" },
                linkedin: { type: "string", description: "LinkedIn URL" },
                address: { type: "string", description: "Physical address" },
                notes: { type: "string", description: "Key relationship context" },
              },
              required: [],
              additionalProperties: false,
            },
          },
        },
      });

      let extracted: any = {};
      try {
        extracted = JSON.parse((result.choices[0]?.message?.content as string) || '{}');
      } catch { extracted = {}; }

      // Stage AI-extracted data as pending suggestions instead of auto-applying
      const suggestedUpdates: any = {};
      if (!contact.email && extracted.email) suggestedUpdates.email = extracted.email;
      if (!contact.phone && extracted.phone) suggestedUpdates.phone = extracted.phone;
      if (!contact.organization && extracted.organization) suggestedUpdates.organization = extracted.organization;
      if (!contact.title && extracted.title) suggestedUpdates.title = extracted.title;
      if (!contact.website && extracted.website) suggestedUpdates.website = extracted.website;
      if (!contact.linkedin && extracted.linkedin) suggestedUpdates.linkedin = extracted.linkedin;
      if (!contact.address && extracted.address) suggestedUpdates.address = extracted.address;

      // Employee data is trusted — apply directly
      const directUpdates: any = {};
      if (employee) {
        if (!contact.email && employee.email) directUpdates.email = employee.email;
        if (!contact.phone && employee.phone) directUpdates.phone = employee.phone;
        if (!contact.address && employee.address) directUpdates.address = employee.address;
      }

      if (Object.keys(directUpdates).length > 0) {
        await db.updateContact(input.id, directUpdates);
      }

      // Create pending suggestion for AI-extracted fields (needs review)
      if (Object.keys(suggestedUpdates).length > 0) {
        // Remove fields already applied from employee data
        for (const key of Object.keys(directUpdates)) {
          delete suggestedUpdates[key];
        }
        if (Object.keys(suggestedUpdates).length > 0) {
          const isDuplicate = await db.checkDuplicateSuggestion("enrichment", input.id);
          if (!isDuplicate) {
            await db.createPendingSuggestion({
              type: "enrichment",
              contactId: input.id,
              suggestedData: JSON.stringify(suggestedUpdates),
              reason: `AI-extracted from ${allRelevantMeetings.length} meeting(s)`,
              confidence: 75,
            });
          }
        }
      }

      // Also generate AI summary
      const summaryResult = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an intelligence analyst for OmniScope. Write a concise, institutional-grade relationship summary. Focus on: relationship context, key topics, business opportunities, and engagement level. Be specific and factual. Write 3-5 sentences.`
          },
          {
            role: "user",
            content: `Generate a relationship intelligence summary for ${contact.name}${contact.organization ? ` (${contact.organization})` : ''}.\n\nMeeting History (${allRelevantMeetings.length} meetings):\n${meetingContext || 'No meetings found'}`
          }
        ],
      });

      const aiSummary = (summaryResult.choices[0]?.message?.content as string) || "";
      if (aiSummary) {
        await db.updateContact(input.id, { aiSummary });
      }

      return { updated: Object.keys(updates), extracted, summary: aiSummary };
    }),

  // Bulk AI enrichment for all contacts
  enrichAllWithAI: protectedProcedure
    .mutation(async () => {
      const allContacts = await db.getAllContacts();
      let enriched = 0;
      let errors = 0;
      for (const contact of allContacts) {
        try {
          // Only enrich contacts that are missing key fields
          if (!contact.email || !contact.organization || !contact.title) {
            const contactMeetings = await db.getMeetingsForContact(contact.id);
            if (contactMeetings.length === 0) continue; // Skip contacts with no meetings
            
            // Check if employee is linked
            const employee = await db.getEmployeeByContactId(contact.id);
            const updates: any = {};
            
            if (employee) {
              if (!contact.email && employee.email) updates.email = employee.email;
              if (!contact.phone && employee.phone) updates.phone = employee.phone;
              if (!contact.address && employee.address) updates.address = employee.address;
            }
            
            if (Object.keys(updates).length > 0) {
              await db.updateContact(contact.id, updates);
              enriched++;
            }
          }
        } catch {
          errors++;
        }
      }
      return { enriched, errors, total: allContacts.length };
    }),

  // Link employee to contact
  linkEmployee: protectedProcedure
    .input(z.object({ contactId: z.number(), employeeId: z.number() }))
    .mutation(async ({ input }) => {
      await db.linkEmployeeToContact(input.employeeId, input.contactId);
      // Sync employee data to contact
      const employee = await db.getEmployeeById(input.employeeId);
      const contact = await db.getContactById(input.contactId);
      if (employee && contact) {
        const updates: any = {};
        if (!contact.email && employee.email) updates.email = employee.email;
        if (!contact.phone && employee.phone) updates.phone = employee.phone;
        if (!contact.address && employee.address) updates.address = employee.address;
        if (Object.keys(updates).length > 0) {
          await db.updateContact(input.contactId, updates);
        }
      }
      return { success: true };
    }),

  // Auto-link employees to contacts by name matching
  autoLinkEmployees: protectedProcedure
    .mutation(async () => {
      const allEmployees = await db.getAllEmployees();
      const allContacts = await db.getAllContacts();
      let linked = 0;
      for (const emp of allEmployees) {
        if (emp.contactId) continue; // Already linked
        const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
        const match = allContacts.find(c => {
          const cName = c.name.toLowerCase().trim();
          return cName === fullName ||
            cName.includes(fullName) ||
            fullName.includes(cName) ||
            (cName.split(/\s+/)[0] === emp.firstName.toLowerCase() && cName.split(/\s+/).pop() === emp.lastName.toLowerCase());
        });
        if (match) {
          await db.linkEmployeeToContact(emp.id, match.id);
          // Sync employee data to contact
          const updates: any = {};
          if (!match.email && emp.email) updates.email = emp.email;
          if (!match.phone && emp.phone) updates.phone = emp.phone;
          if (!match.address && emp.address) updates.address = emp.address;
          if (Object.keys(updates).length > 0) {
            await db.updateContact(match.id, updates);
          }
          linked++;
        }
      }
      return { linked, total: allEmployees.length };
    }),

  // Contact documents
  getDocuments: protectedProcedure
    .input(z.object({ contactId: z.number(), category: z.string().optional() }))
    .query(async ({ input }) => {
      return await db.getDocumentsForContact(input.contactId, input.category);
    }),

  uploadDocument: protectedProcedure
    .input(z.object({
      contactId: z.number(),
      title: z.string().min(1),
      category: z.enum(["ncnda", "contract", "agreement", "proposal", "invoice", "kyc", "compliance", "correspondence", "other"]).default("other"),
      fileData: z.string(), // base64
      fileName: z.string(),
      mimeType: z.string(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const buffer = Buffer.from(input.fileData, 'base64');
      const suffix = Math.random().toString(36).substring(2, 10);
      const fileKey = `contact-docs/${input.contactId}/${input.fileName}-${suffix}`;
      const { url } = await storagePut(fileKey, buffer, input.mimeType);
      const id = await db.createContactDocument({
        contactId: input.contactId,
        title: input.title,
        category: input.category,
        fileUrl: url,
        fileKey,
        notes: input.notes ?? null,
        uploadedBy: ctx.user.id,
      });
      return { id, url };
    }),

  deleteDocument: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteContactDocument(input.id);
      return { success: true };
    }),

  // Get linked employee for a contact
  getLinkedEmployee: protectedProcedure
    .input(z.object({ contactId: z.number() }))
    .query(async ({ input }) => {
      return await db.getEmployeeByContactId(input.contactId);
    }),

  // ========== ALIASES ==========
  getAliases: protectedProcedure
    .input(z.object({ contactId: z.number() }))
    .query(async ({ ctx, input }) => {
      return await db.getAliasesForContact(ctx.user!.id, input.contactId);
    }),

  addAlias: protectedProcedure
    .input(z.object({ contactId: z.number(), aliasName: z.string().min(1), aliasEmail: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const result = await db.saveContactAlias(ctx.user!.id, input.contactId, input.aliasName, input.aliasEmail, "manual");
      const contact = await db.getContactById(input.contactId);
      await db.logActivity({ userId: ctx.user!.id, action: "add_contact_alias", entityType: "contact", entityId: String(input.contactId), entityName: contact?.name || "Unknown", details: `Added alias "${input.aliasName}"` });
      return result;
    }),

  removeAlias: protectedProcedure
    .input(z.object({ aliasId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return await db.deleteContactAlias(input.aliasId);
    }),
});

// ============================================================================
// EMPLOYEES (HR) ROUTER
// ============================================================================

const employeesRouter = router({
  list: protectedProcedure
    .input(z.object({ status: z.string().optional(), department: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return await db.getAllEmployees(input ?? undefined);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const emp = await db.getEmployeeById(input.id);
      if (!emp) throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found" });
      // Enrich with payroll and document counts
      const payroll = await db.getPayrollForEmployee(input.id);
      const docs = await db.getDocumentsForEmployee(input.id);
      return { ...emp, payrollCount: payroll.length, documentCount: docs.length };
    }),

  search: protectedProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ input }) => {
      return await db.searchEmployees(input.query);
    }),

  departments: protectedProcedure.query(async () => {
    return await db.getEmployeeDepartments();
  }),

  create: protectedProcedure
    .input(z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional(),
      dateOfBirth: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      emergencyContactName: z.string().optional(),
      emergencyContactPhone: z.string().optional(),
      emergencyContactRelation: z.string().optional(),
      hireDate: z.string(),
      department: z.string().optional(),
      jobTitle: z.string().min(1),
      employmentType: z.enum(["full_time", "part_time", "contractor", "intern"]).default("full_time"),
      salary: z.string().optional(),
      payFrequency: z.enum(["weekly", "biweekly", "monthly", "per_project"]).optional(),
      currency: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await db.createEmployee({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone ?? null,
        dateOfBirth: input.dateOfBirth ?? null,
        address: input.address ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
        country: input.country ?? null,
        emergencyContactName: input.emergencyContactName ?? null,
        emergencyContactPhone: input.emergencyContactPhone ?? null,
        emergencyContactRelation: input.emergencyContactRelation ?? null,
        hireDate: input.hireDate,
        department: input.department ?? null,
        jobTitle: input.jobTitle,
        employmentType: input.employmentType,
        salary: input.salary ?? null,
        payFrequency: input.payFrequency ?? "monthly",
        currency: input.currency ?? "USD",
        notes: input.notes ?? null,
      });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().nullable().optional(),
      dateOfBirth: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
      city: z.string().nullable().optional(),
      state: z.string().nullable().optional(),
      country: z.string().nullable().optional(),
      photoUrl: z.string().nullable().optional(),
      emergencyContactName: z.string().nullable().optional(),
      emergencyContactPhone: z.string().nullable().optional(),
      emergencyContactRelation: z.string().nullable().optional(),
      department: z.string().nullable().optional(),
      jobTitle: z.string().optional(),
      employmentType: z.enum(["full_time", "part_time", "contractor", "intern"]).optional(),
      status: z.enum(["active", "inactive", "terminated", "on_leave"]).optional(),
      salary: z.string().nullable().optional(),
      payFrequency: z.enum(["weekly", "biweekly", "monthly", "per_project"]).nullable().optional(),
      currency: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      const cleanUpdates: any = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) cleanUpdates[key] = value;
      }
      await db.updateEmployee(id, cleanUpdates);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteEmployee(input.id);
      return { success: true };
    }),

  uploadPhoto: protectedProcedure
    .input(z.object({ id: z.number(), base64: z.string(), mimeType: z.string() }))
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.base64, 'base64');
      const ext = input.mimeType.split('/')[1] || 'jpg';
      const key = `employees/${input.id}/photo-${Date.now()}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      await db.updateEmployee(input.id, { photoUrl: url });
      return { url };
    }),
});

// ============================================================================
// PAYROLL ROUTER
// ============================================================================

const payrollRouter = router({
  list: protectedProcedure
    .input(z.object({ employeeId: z.number().optional(), status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const records = await db.getAllPayrollRecords(input ?? undefined);
      // Enrich with employee name
      const enriched = await Promise.all(records.map(async (r: any) => {
        const emp = await db.getEmployeeById(r.employeeId);
        return { ...r, employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown' };
      }));
      return enriched;
    }),

  getForEmployee: protectedProcedure
    .input(z.object({ employeeId: z.number() }))
    .query(async ({ input }) => {
      return await db.getPayrollForEmployee(input.employeeId);
    }),

  create: protectedProcedure
    .input(z.object({
      employeeId: z.number(),
      payPeriodStart: z.string(),
      payPeriodEnd: z.string(),
      amount: z.string(),
      currency: z.string().default("USD"),
      paymentMethod: z.enum(["bank_transfer", "check", "crypto", "cash", "wire", "other"]).default("bank_transfer"),
      paymentDate: z.string().optional(),
      status: z.enum(["pending", "paid", "overdue", "cancelled"]).default("pending"),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const id = await db.createPayrollRecord({
        employeeId: input.employeeId,
        payPeriodStart: input.payPeriodStart,
        payPeriodEnd: input.payPeriodEnd,
        amount: input.amount,
        currency: input.currency,
        paymentMethod: input.paymentMethod,
        paymentDate: input.paymentDate ?? null,
        status: input.status,
        notes: input.notes ?? null,
        createdBy: ctx.user.id,
      });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      payPeriodStart: z.string().optional(),
      payPeriodEnd: z.string().optional(),
      amount: z.string().optional(),
      currency: z.string().optional(),
      paymentMethod: z.enum(["bank_transfer", "check", "crypto", "cash", "wire", "other"]).optional(),
      paymentDate: z.string().nullable().optional(),
      status: z.enum(["pending", "paid", "overdue", "cancelled"]).optional(),
      notes: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      const cleanUpdates: any = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) cleanUpdates[key] = value;
      }
      await db.updatePayrollRecord(id, cleanUpdates);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deletePayrollRecord(input.id);
      return { success: true };
    }),

  uploadReceipt: protectedProcedure
    .input(z.object({ id: z.number(), base64: z.string(), fileName: z.string(), mimeType: z.string() }))
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.base64, 'base64');
      const key = `payroll/receipts/${input.id}-${Date.now()}-${input.fileName}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      await db.updatePayrollRecord(input.id, { receiptUrl: url, receiptKey: key });
      return { url };
    }),

  uploadInvoice: protectedProcedure
    .input(z.object({ id: z.number(), base64: z.string(), fileName: z.string(), mimeType: z.string() }))
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.base64, 'base64');
      const key = `payroll/invoices/${input.id}-${Date.now()}-${input.fileName}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      await db.updatePayrollRecord(input.id, { invoiceUrl: url, invoiceKey: key });
      return { url };
    }),
});

// ============================================================================
// HR DOCUMENTS ROUTER
// ============================================================================

const hrDocumentsRouter = router({
  list: protectedProcedure
    .input(z.object({ employeeId: z.number(), category: z.string().optional() }))
    .query(async ({ input }) => {
      return await db.getDocumentsForEmployee(input.employeeId, input.category);
    }),

  upload: protectedProcedure
    .input(z.object({
      employeeId: z.number(),
      title: z.string().min(1),
      category: z.enum(["contract", "id_document", "tax_form", "certification", "onboarding", "performance", "payslip", "invoice", "receipt", "other"]).default("other"),
      base64: z.string(),
      fileName: z.string(),
      mimeType: z.string(),
      fileSize: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const buffer = Buffer.from(input.base64, 'base64');
      const key = `hr-docs/${input.employeeId}/${Date.now()}-${input.fileName}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      const id = await db.createHrDocument({
        employeeId: input.employeeId,
        title: input.title,
        category: input.category,
        fileUrl: url,
        fileKey: key,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSize: input.fileSize ?? buffer.length,
        notes: input.notes ?? null,
        uploadedBy: ctx.user.id,
        uploadedByName: ctx.user.name ?? "Unknown",
      });
      return { id, url };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteHrDocument(input.id);
      return { success: true };
    }),
});

// ============================================================================
// AI INTELLIGENCE ROUTER
// ============================================================================

const aiInsightsRouter = router({
  followUpReminders: protectedProcedure.query(async () => {
    const contacts = await db.getAllContacts();
    const reminders: any[] = [];
    
    for (const c of contacts) {
      if (c.starred || c.category === 'client' || c.category === 'prospect') {
        const meetings = await db.getMeetingsForContact(c.id);
        if (meetings.length > 0) {
          const lastDate = meetings[0].meeting.meetingDate;
          const daysSince = Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000);
          if (daysSince > 7) {
            reminders.push({
              contactId: c.id,
              contactName: c.name,
              organization: c.organization,
              category: c.category,
              starred: c.starred,
              daysSinceLastMeeting: daysSince,
              lastMeetingTitle: meetings[0].meeting.meetingTitle,
              lastMeetingDate: lastDate,
              urgency: daysSince > 30 ? 'critical' : daysSince > 14 ? 'high' : 'medium',
            });
          }
        }
      }
    }
    return reminders.sort((a, b) => b.daysSinceLastMeeting - a.daysSinceLastMeeting);
  }),

  upcomingBirthdays: protectedProcedure.query(async () => {
    const contacts = await db.getAllContacts();
    const employees = await db.getAllEmployees();
    const now = new Date();
    const birthdays: any[] = [];
    
    const checkBirthday = (name: string, dob: string, type: string, id: number) => {
      try {
        const parts = dob.split(/[-\/]/);
        let month: number, day: number;
        if (parts[0].length === 4) { month = parseInt(parts[1]); day = parseInt(parts[2]); }
        else { month = parseInt(parts[0]); day = parseInt(parts[1]); }
        
        const thisYearBday = new Date(now.getFullYear(), month - 1, day);
        const diffDays = Math.floor((thisYearBday.getTime() - now.getTime()) / 86400000);
        if (diffDays >= -1 && diffDays <= 30) {
          birthdays.push({ name, dateOfBirth: dob, type, id, daysUntil: diffDays, isToday: diffDays === 0 });
        }
      } catch {}
    };
    
    for (const c of contacts) { if (c.dateOfBirth) checkBirthday(c.name, c.dateOfBirth, 'contact', c.id); }
    for (const e of employees) { if (e.dateOfBirth) checkBirthday(`${e.firstName} ${e.lastName}`, e.dateOfBirth, 'employee', e.id); }
    
    return birthdays.sort((a, b) => a.daysUntil - b.daysUntil);
  }),

  dailyBriefing: protectedProcedure.query(async () => {
    const { invokeLLM } = await import("./_core/llm");
    
    // Gather data for AI analysis
    const allContacts = await db.getAllContacts();
    const allTasks = await db.getAllTasks();
    const recentMeetings = await db.getAllMeetings({ limit: 20 });
    const allEmployees = await db.getAllEmployees();
    
    // Find contacts not met in 14+ days
    const staleContacts: string[] = [];
    for (const c of allContacts) {
      if (c.starred || c.category === 'client') {
        const meetings = await db.getMeetingsForContact(c.id);
        if (meetings.length > 0) {
          const lastDate = meetings[0].meeting.meetingDate;
          const daysSince = Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000);
          if (daysSince > 14) staleContacts.push(`${c.name} (${daysSince} days)`);
        }
      }
    }
    
    // Overdue tasks
    const now = new Date();
    const overdueTasks = allTasks.filter(t => 
      t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < now
    );
    
    // Upcoming birthdays (next 7 days)
    const upcomingBirthdays: string[] = [];
    const todayMonth = now.getMonth() + 1;
    const todayDay = now.getDate();
    for (const c of allContacts) {
      if (c.dateOfBirth) {
        try {
          const parts = c.dateOfBirth.split(/[-\/]/);
          const bMonth = parseInt(parts[1]);
          const bDay = parseInt(parts[2] || parts[0]);
          const diff = (bMonth - todayMonth) * 30 + (bDay - todayDay);
          if (diff >= 0 && diff <= 7) upcomingBirthdays.push(`${c.name} (${c.dateOfBirth})`);
        } catch {}
      }
    }
    for (const e of allEmployees) {
      if (e.dateOfBirth) {
        try {
          const parts = e.dateOfBirth.split(/[-\/]/);
          const bMonth = parseInt(parts[1]);
          const bDay = parseInt(parts[2] || parts[0]);
          const diff = (bMonth - todayMonth) * 30 + (bDay - todayDay);
          if (diff >= 0 && diff <= 7) upcomingBirthdays.push(`${e.firstName} ${e.lastName} (employee, ${e.dateOfBirth})`);
        } catch {}
      }
    }
    
    // Open tasks count
    const openTasks = allTasks.filter(t => t.status !== 'completed');
    
    const prompt = `You are OmniScope's daily intelligence briefing AI. Generate a concise, actionable daily briefing for the team.

Data:
- Total contacts: ${allContacts.length} (${allContacts.filter(c => c.starred).length} starred)
- Stale contacts (no meeting in 14+ days): ${staleContacts.join(', ') || 'None'}
- Overdue tasks (${overdueTasks.length}): ${overdueTasks.slice(0, 5).map(t => `"${t.title}" (${t.assignedName || 'unassigned'})`).join(', ') || 'None'}
- Open tasks: ${openTasks.length}
- Recent meetings (last 20): ${recentMeetings.slice(0, 5).map(m => `"${m.meetingTitle}" on ${new Date(m.meetingDate).toLocaleDateString()}`).join(', ')}
- Upcoming birthdays (7 days): ${upcomingBirthdays.join(', ') || 'None'}
- Employees: ${allEmployees.length} (${allEmployees.filter(e => e.status === 'active').length} active)

Format the briefing with these sections:
1. **Priority Actions** — what needs immediate attention
2. **Follow-Up Reminders** — contacts to reconnect with
3. **Upcoming** — birthdays, deadlines
4. **Quick Stats** — key numbers

Keep it under 300 words. Be specific with names and dates. Use a professional, institutional tone.`;

    const result = await invokeLLM({
      messages: [
        { role: "system", content: "You are OmniScope's AI intelligence analyst. Provide actionable, data-driven briefings." },
        { role: "user", content: prompt }
      ],
    });

    return {
      briefing: (result.choices[0]?.message?.content as string) || "Unable to generate briefing.",
      stats: {
        totalContacts: allContacts.length,
        starredContacts: allContacts.filter(c => c.starred).length,
        staleContactCount: staleContacts.length,
        overdueTaskCount: overdueTasks.length,
        openTaskCount: openTasks.length,
        upcomingBirthdays: upcomingBirthdays.length,
        activeEmployees: allEmployees.filter(e => e.status === 'active').length,
      }
    };
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

  bulkDelete: protectedProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ input }) => {
      for (const id of input.ids) {
        await db.deleteTask(id);
      }
      return { success: true, deleted: input.ids.length };
    }),

  bulkUpdate: protectedProcedure
    .input(z.object({
      ids: z.array(z.number()).min(1),
      updates: z.object({
        category: z.string().optional(),
        assignedName: z.string().optional(),
        status: z.enum(["open", "in_progress", "completed"]).optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        dueDate: z.string().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      const updates: any = {};
      if (input.updates.category !== undefined) updates.category = input.updates.category || null;
      if (input.updates.assignedName !== undefined) updates.assignedName = input.updates.assignedName || null;
      if (input.updates.status !== undefined) updates.status = input.updates.status;
      if (input.updates.priority !== undefined) updates.priority = input.updates.priority;
      if (input.updates.dueDate !== undefined) updates.dueDate = input.updates.dueDate ? new Date(input.updates.dueDate) : null;
      for (const id of input.ids) {
        await db.updateTask(id, updates);
      }
      return { success: true, updated: input.ids.length };
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

  syncFathom: protectedProcedure
    .mutation(async () => {
      try {
        const result = await fathomIntegration.importFathomMeetings({ limit: 10 });
        return { success: true, imported: result.imported, skipped: result.skipped, errors: result.errors };
      } catch (error: any) {
        console.error("[Fathom Sync] Error:", error.message);
        return { success: false, imported: 0, skipped: 0, errors: 1 };
      }
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

  // Full chat procedure with multi-turn conversation and full database context
  chat: protectedProcedure
    .input(z.object({
      query: z.string(),
      context: z.string().optional(), // current page context
      entityId: z.string().optional(), // current entity being viewed
      history: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })).optional(),
    }))
    .mutation(async ({ input }) => {
      return await askOmniScope.chat(
        input.query,
        input.history || [],
        input.context,
        input.entityId
      );
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
// COMPANIES ROUTER
// ============================================================================

const companiesRouter = router({
  list: protectedProcedure
    .input(z.object({ status: z.string().optional(), search: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return await db.getAllCompanies(input ?? undefined);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const company = await db.getCompanyById(input.id);
      if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });
      return company;
    }),

  getProfile: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const company = await db.getCompanyById(input.id);
      if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });
      const people = await db.getPeopleForCompany(input.id);
      const companyInteractions = await db.getInteractionsForCompany(input.id, 100);
      const companyTasks = await db.getTasksForCompany(input.id);
      return { ...company, people, interactions: companyInteractions, tasks: companyTasks };
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      domain: z.string().optional(),
      industry: z.string().optional(),
      notes: z.string().optional(),
      status: z.enum(["active", "inactive", "prospect", "partner"]).optional(),
      owner: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await db.createCompany({
        name: input.name,
        domain: input.domain ?? null,
        industry: input.industry ?? null,
        notes: input.notes ?? null,
        status: input.status ?? "active",
        owner: input.owner ?? null,
      });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      domain: z.string().optional(),
      industry: z.string().optional(),
      notes: z.string().optional(),
      status: z.enum(["active", "inactive", "prospect", "partner"]).optional(),
      owner: z.string().optional(),
      aiMemory: z.string().optional(),
      logoUrl: z.string().optional(),
      approvalStatus: z.enum(["approved", "pending", "rejected"]).optional(),
      location: z.string().nullable().optional(),
      internalRating: z.number().min(1).max(5).nullable().optional(),
      jurisdictionRisk: z.enum(["low", "medium", "high", "critical"]).nullable().optional(),
      bankingPartner: z.string().nullable().optional(),
      custodian: z.string().nullable().optional(),
      regulatoryExposure: z.string().nullable().optional(),
      entityType: z.enum(["sovereign", "private", "institutional", "family_office", "other"]).nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      const cleanUpdates: any = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) cleanUpdates[key] = value;
      }
      // If name is being updated, propagate across the system
      if (cleanUpdates.name) {
        const oldCompany = await db.getCompanyById(id);
        if (oldCompany && oldCompany.name !== cleanUpdates.name) {
          await db.propagateCompanyNameChange(id, oldCompany.name, cleanUpdates.name);
        }
      }
      await db.updateCompany(id, cleanUpdates);
      return { success: true };
    }),

  approve: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const company = await db.getCompanyById(input.id);
      await db.updateCompany(input.id, { approvalStatus: "approved" });
      await db.logActivity({ userId: ctx.user.id, action: "approve_company", entityType: "company", entityId: String(input.id), entityName: company?.name || "Unknown" });
      return { success: true };
    }),

  reject: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const company = await db.getCompanyById(input.id);
      await db.updateCompany(input.id, { approvalStatus: "rejected" });
      await db.logActivity({ userId: ctx.user.id, action: "reject_company", entityType: "company", entityId: String(input.id), entityName: company?.name || "Unknown" });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteCompany(input.id);
      return { success: true };
    }),

  refreshAiMemory: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const company = await db.getCompanyById(input.id);
      if (!company) throw new TRPCError({ code: "NOT_FOUND" });
      const people = await db.getPeopleForCompany(input.id);
      const companyInteractions = await db.getInteractionsForCompany(input.id, 50);
      
      const { invokeLLM } = await import("./_core/llm");
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are an institutional relationship intelligence analyst for OmniScope, a sovereign-grade financial infrastructure platform. Generate a concise, executive-level company brief." },
          { role: "user", content: `Generate a rolling AI memory brief for this company:\n\nCompany: ${company.name}\nDomain: ${company.domain || "N/A"}\nIndustry: ${company.industry || "N/A"}\nStatus: ${company.status}\n\nAssociated People (${people.length}):\n${people.map(p => `- ${p.name} (${p.title || "No title"}, ${p.email || "No email"})`).join("\n")}\n\nRecent Interactions (${companyInteractions.length}):\n${companyInteractions.slice(0, 20).map(i => `- [${i.type}] ${new Date(i.timestamp).toLocaleDateString()}: ${i.summary || "No summary"}`).join("\n")}\n\nProvide a structured brief with:\n1. Company Overview (who they are, what they do)\n2. Relationship Status (how engaged we are)\n3. Key People & Contacts\n4. Current Workstreams / Active Discussions\n5. Open Loops & Next Steps\n6. Risk Flags (if any)` },
        ],
      });
      const aiMemory = String(response.choices?.[0]?.message?.content || "");
      await db.updateCompany(input.id, { aiMemory });
      return { aiMemory };
    }),
});

// ============================================================================
// INTERACTIONS ROUTER
// ============================================================================

const interactionsRouter = router({
  list: protectedProcedure
    .input(z.object({
      contactId: z.number().optional(),
      companyId: z.number().optional(),
      type: z.string().optional(),
      limit: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      return await db.getAllInteractions(input ?? undefined);
    }),

  forContact: protectedProcedure
    .input(z.object({ contactId: z.number(), limit: z.number().optional() }))
    .query(async ({ input }) => {
      return await db.getInteractionsForContact(input.contactId, input.limit ?? 50);
    }),

  forCompany: protectedProcedure
    .input(z.object({ companyId: z.number(), limit: z.number().optional() }))
    .query(async ({ input }) => {
      return await db.getInteractionsForCompany(input.companyId, input.limit ?? 50);
    }),

  create: protectedProcedure
    .input(z.object({
      type: z.enum(["meeting", "note", "doc_shared", "task_update", "email", "intro", "call"]),
      timestamp: z.string(),
      contactId: z.number().optional(),
      companyId: z.number().optional(),
      sourceRecordId: z.number().optional(),
      sourceType: z.string().optional(),
      summary: z.string().optional(),
      details: z.string().optional(),
      tags: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const id = await db.createInteraction({
        type: input.type,
        timestamp: new Date(input.timestamp),
        contactId: input.contactId ?? null,
        companyId: input.companyId ?? null,
        sourceRecordId: input.sourceRecordId ?? null,
        sourceType: input.sourceType ?? null,
        summary: input.summary ?? null,
        details: input.details ?? null,
        tags: input.tags ?? null,
        createdBy: ctx.user?.id ?? null,
      });
      return { id };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteInteraction(input.id);
      return { success: true };
    }),
});

// ============================================================================
// GLOBAL SEARCH ROUTER
// ============================================================================

const searchRouter = router({
  global: protectedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      return await db.globalSearch(input.query);
    }),
});

// ============================================================================
// MAIL ROUTER
// ============================================================================

const mailRouter = router({
  listThreads: protectedProcedure
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

  getThread: protectedProcedure
    .input(z.object({ threadId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await gmailService.getGmailThread(ctx.user.id, input.threadId);
    }),

  send: protectedProcedure
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

  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    return { count: await gmailService.getUnreadCount(ctx.user.id) };
  }),

  toggleStar: protectedProcedure
    .input(z.object({ messageId: z.string(), starred: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const ok = await gmailService.toggleStar(ctx.user.id, input.messageId, input.starred);
      if (!ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to toggle star" });
      return { success: true };
    }),

  toggleRead: protectedProcedure
    .input(z.object({ messageId: z.string(), read: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const ok = await gmailService.toggleRead(ctx.user.id, input.messageId, input.read);
      if (!ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to toggle read" });
      return { success: true };
    }),

  trash: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const ok = await gmailService.trashMessage(ctx.user.id, input.messageId);
      if (!ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to trash message" });
      return { success: true };
    }),

  syncHeaders: protectedProcedure
    .input(z.object({ maxResults: z.number().min(10).max(500).default(100) }).optional())
    .mutation(async ({ ctx, input }) => {
      return await gmailService.syncEmailHeaders(ctx.user.id, { maxResults: input?.maxResults });
    }),

  getByContact: protectedProcedure
    .input(z.object({ contactEmail: z.string(), maxResults: z.number().default(15) }))
    .query(async ({ ctx, input }) => {
      return await gmailService.getEmailsByContact(ctx.user.id, input.contactEmail, input.maxResults);
    }),

  connectionStatus: protectedProcedure.query(async ({ ctx }) => {
    return await isGoogleConnected(ctx.user.id);
  }),

  getAuthUrl: protectedProcedure
    .input(z.object({ origin: z.string(), returnPath: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const url = getGoogleAuthUrl(input.origin, ctx.user.id, input.returnPath);
      return { url, redirectUri: `${input.origin}/api/google/callback` };
    }),

  // Star Priority System
  getStar: protectedProcedure
    .input(z.object({ threadId: z.string() }))
    .query(async ({ ctx, input }) => {
      const star = await db.getEmailStar(input.threadId, ctx.user.id);
      return star ? { starLevel: star.starLevel } : null;
    }),

  getStars: protectedProcedure.query(async ({ ctx }) => {
    return await db.getEmailStarsForUser(ctx.user.id);
  }),

  setStar: protectedProcedure
    .input(z.object({ threadId: z.string(), starLevel: z.number().min(1).max(3) }))
    .mutation(async ({ ctx, input }) => {
      return await db.setEmailStar(input.threadId, ctx.user.id, input.starLevel);
    }),

  removeStar: protectedProcedure
    .input(z.object({ threadId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await db.removeEmailStar(input.threadId, ctx.user.id);
    }),

  // Email-to-Company Links
  getCompanyLinks: protectedProcedure
    .input(z.object({ threadId: z.string() }))
    .query(async ({ input }) => {
      return await db.getEmailCompanyLinks(input.threadId);
    }),

  linkToCompany: protectedProcedure
    .input(z.object({ threadId: z.string(), companyId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return await db.linkEmailToCompany(input.threadId, input.companyId, ctx.user.id);
    }),

  unlinkCompany: protectedProcedure
    .input(z.object({ linkId: z.number() }))
    .mutation(async ({ input }) => {
      return await db.unlinkEmailFromCompany(input.linkId);
    }),

  // AI Thread Summary
  getThreadSummary: protectedProcedure
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

  summarizeThread: protectedProcedure
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

      const { invokeLLM } = await import("./_core/llm");
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
  convertToTask: protectedProcedure
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
  convertToTasks: protectedProcedure
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
  getThreadTasks: protectedProcedure
    .input(z.object({ threadId: z.string() }))
    .query(async ({ input }) => {
      return await db.getTasksByThreadId(input.threadId);
    }),

  // Bulk Star Assignment
  bulkSetStars: protectedProcedure
    .input(z.object({
      threadIds: z.array(z.string()).min(1).max(100),
      starLevel: z.number().min(1).max(3),
    }))
    .mutation(async ({ ctx, input }) => {
      const results = await db.bulkSetEmailStars(input.threadIds, ctx.user.id, input.starLevel);
      return { updated: results.length, starLevel: input.starLevel };
    }),

  bulkRemoveStars: protectedProcedure
    .input(z.object({
      threadIds: z.array(z.string()).min(1).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await db.bulkRemoveEmailStars(input.threadIds, ctx.user.id);
      return result;
    }),

  // Email Analytics
  analytics: protectedProcedure.query(async ({ ctx }) => {
    return await db.getEmailAnalytics(ctx.user.id);
  }),

  // AI Task Extraction from Email Thread
  extractTasks: protectedProcedure
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

      const { invokeLLM } = await import("./_core/llm");
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
            const results = await db.directorySearch(task.assignee, 1);
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

// ============================================================================
// ONBOARDING ROUTER
// ============================================================================

const onboardingRouter = router({
  status: protectedProcedure.query(async ({ ctx }) => {
    const googleStatus = await isGoogleConnected(ctx.user.id);
    return {
      onboardingCompleted: ctx.user.onboardingCompleted ?? false,
      googleConnected: googleStatus.connected,
      hasGmailScopes: googleStatus.hasGmailScopes ?? false,
      hasCalendarScopes: googleStatus.hasCalendarScopes ?? false,
      googleEmail: googleStatus.email ?? null,
    };
  }),

  complete: protectedProcedure.mutation(async ({ ctx }) => {
    await db.completeOnboarding(ctx.user.id);
    return { success: true };
  }),
});

// ============================================================================
// PROFILE ROUTER (Signature System)
// ============================================================================

const profileRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const profile = await db.getUserProfile(ctx.user.id);
    return {
      userId: ctx.user.id,
      name: ctx.user.name || "",
      email: ctx.user.email || "",
      title: profile?.title || "",
      division: profile?.division || "",
      phone: profile?.phone || "",
      location: profile?.location || "",
      website: profile?.website || "omniscopex.ae",
      tagline: profile?.tagline || "",
      signatureEnabled: profile?.signatureEnabled ?? true,
    };
  }),

  update: protectedProcedure
    .input(
      z.object({
        title: z.string().optional(),
        division: z.string().optional(),
        phone: z.string().optional(),
        location: z.string().optional(),
        website: z.string().optional(),
        tagline: z.string().optional(),
        signatureEnabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const profile = await db.upsertUserProfile(ctx.user.id, input);
      return profile;
    }),

  getSignatureHtml: protectedProcedure.query(async ({ ctx }) => {
    const profile = await db.getUserProfile(ctx.user.id);
    const name = ctx.user.name || "";
    const title = profile?.title || "";
    const division = profile?.division || "";
    const phone = profile?.phone || "";
    const location = profile?.location || "";
    const website = profile?.website || "omniscopex.ae";
    const tagline = profile?.tagline || "Private Markets | Digital Assets | Institutional Infrastructure";

    const html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; font-size: 13px; line-height: 1.5; margin-top: 24px; padding-top: 16px; border-top: 2px solid #b8860b;">
  <div style="font-weight: 600; font-size: 14px; color: #111;">${name}</div>
  ${title || division ? `<div style="color: #666; font-size: 12px; margin-top: 2px;">${[title, division].filter(Boolean).join(" | ")}</div>` : ""}
  <div style="margin-top: 8px; font-size: 12px; color: #888;">
    <div style="font-weight: 500; color: #111;">OmniScope</div>
    <div style="color: #999; font-size: 11px;">${tagline}</div>
  </div>
  <div style="margin-top: 6px; font-size: 11px; color: #999;">
    ${[website ? `<a href="https://${website}" style="color: #b8860b; text-decoration: none;">${website}</a>` : "", phone, location].filter(Boolean).join(" &middot; ")}
  </div>
  <div style="margin-top: 10px; font-size: 10px; color: #bbb; font-style: italic;">This message may contain confidential information. If you are not the intended recipient, please notify the sender and delete this message.</div>
</div>`;

    return { html, enabled: profile?.signatureEnabled ?? true };
  }),
});

// ============================================================================
// DIRECTORY ROUTER — Unified autocomplete & person cards
// ============================================================================

const directoryRouter = router({
  search: protectedProcedure
    .input(z.object({ query: z.string().min(1).max(200), limit: z.number().min(1).max(50).default(15) }))
    .query(async ({ input }) => {
      return await db.directorySearch(input.query, input.limit);
    }),

  personCard: protectedProcedure
    .input(z.object({ contactId: z.number() }))
    .query(async ({ input }) => {
      return await db.getPersonCard(input.contactId);
    }),

  findByEmail: protectedProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      const contact = await db.findContactByEmail(input.email);
      const company = await db.findCompanyByEmailDomain(input.email);
      return { contact, company };
    }),

  quickCreateContact: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      email: z.string().email(),
      organization: z.string().optional(),
      companyId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      // Check if contact already exists
      const existing = await db.findContactByEmail(input.email);
      if (existing) return { contact: existing, created: false };

      // Auto-detect company from domain
      let companyId = input.companyId ?? null;
      if (!companyId) {
        const company = await db.findCompanyByEmailDomain(input.email);
        if (company) companyId = company.id;
      }

      const contact = await db.getOrCreateContact(
        input.name,
        input.organization,
        input.email,
      );
      // Link to company if found
      if (companyId && contact) {
        await db.updateContact(contact.id, { companyId });
      }
      return { contact, created: true };
    }),
});

// ============================================================================
// TRIAGE ROUTER — Unified attention feed
// ============================================================================
const triageRouter = router({
  feed: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const userName = ctx.user.name || 'there';
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    // 1. Overdue tasks
    const allTasks = await db.getAllTasks();
    const overdueTasks = allTasks
      .filter(t => t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < startOfToday)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 15);

    // 2. Tasks due today
    const todayTasks = allTasks
      .filter(t => t.status !== 'completed' && t.dueDate && new Date(t.dueDate) >= startOfToday && new Date(t.dueDate) < endOfToday)
      .sort((a, b) => {
        const prio = { high: 0, medium: 1, low: 2 };
        return (prio[a.priority as keyof typeof prio] ?? 1) - (prio[b.priority as keyof typeof prio] ?? 1);
      });

    // 3. High priority open tasks (not due today, not overdue)
    const highPriorityTasks = allTasks
      .filter(t => t.status !== 'completed' && t.priority === 'high' && !overdueTasks.find(o => o.id === t.id) && !todayTasks.find(o => o.id === t.id))
      .slice(0, 10);

    // 4. Starred emails — enrich with thread metadata from Gmail
    const rawStarredEmails = await db.getEmailStarsForUser(userId);
    // Enrich each starred email by fetching its thread metadata individually
    let starredEmails: { threadId: string; starLevel: number; subject?: string; fromName?: string; fromEmail?: string }[] = [];
    try {
      // First try bulk approach: fetch recent inbox threads to build a lookup map
      const recentThreads = await gmailService.listGmailThreads(userId, { folder: 'all', maxResults: 100 });
      const threadMap = new Map<string, { subject: string; fromName: string; fromEmail: string }>();
      for (const t of recentThreads.threads || []) {
        threadMap.set(t.threadId, { subject: t.subject, fromName: t.fromName, fromEmail: t.fromEmail });
      }

      // For any starred emails not found in the bulk fetch, look them up individually
      starredEmails = await Promise.all(rawStarredEmails.map(async (s) => {
        const bulkMeta = threadMap.get(s.threadId);
        if (bulkMeta) {
          return {
            threadId: s.threadId,
            starLevel: s.starLevel,
            subject: bulkMeta.subject,
            fromName: bulkMeta.fromName,
            fromEmail: bulkMeta.fromEmail,
          };
        }
        // Individual lookup for threads not in recent batch
        try {
          const threadDetail = await gmailService.getGmailThread(userId, s.threadId);
          if (threadDetail.messages && threadDetail.messages.length > 0) {
            const lastMsg = threadDetail.messages[threadDetail.messages.length - 1];
            return {
              threadId: s.threadId,
              starLevel: s.starLevel,
              subject: lastMsg.subject || undefined,
              fromName: lastMsg.fromName || undefined,
              fromEmail: lastMsg.fromEmail || undefined,
            };
          }
        } catch {
          // Individual thread fetch failed — skip enrichment
        }
        return { threadId: s.threadId, starLevel: s.starLevel };
      }));
    } catch {
      // Gmail not connected or error — fall back to raw data
      starredEmails = rawStarredEmails.map(s => ({ threadId: s.threadId, starLevel: s.starLevel }));
    }

    // 5. Pending contact approvals
    const allContacts = await db.getAllContacts();
    const pendingContacts = allContacts.filter(c => c.approvalStatus === 'pending').slice(0, 10);

    // 6. Pending company approvals
    const allCompanies = await db.getAllCompanies();
    const pendingCompanies = allCompanies.filter(c => c.approvalStatus === 'pending').slice(0, 10);

    // 7. Recent meetings (last 7 days)
    const sevenDaysAgo = new Date(startOfToday);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentMeetings = await db.getAllMeetings({ startDate: sevenDaysAgo, endDate: endOfToday, limit: 6 });

    // 8. Tomorrow's tasks
    const startOfTomorrow = new Date(endOfToday);
    const endOfTomorrow = new Date(startOfTomorrow);
    endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);
    const tomorrowTasks = allTasks
      .filter(t => t.status !== 'completed' && t.dueDate && new Date(t.dueDate) >= startOfTomorrow && new Date(t.dueDate) < endOfTomorrow)
      .sort((a, b) => {
        const prio = { high: 0, medium: 1, low: 2 };
        return (prio[a.priority as keyof typeof prio] ?? 1) - (prio[b.priority as keyof typeof prio] ?? 1);
      });

    // 9. This week's tasks (next 7 days, excluding today and tomorrow)
    const endOfWeek = new Date(startOfToday);
    endOfWeek.setDate(endOfWeek.getDate() + 7);
    const weekTasks = allTasks
      .filter(t => t.status !== 'completed' && t.dueDate && new Date(t.dueDate) >= endOfTomorrow && new Date(t.dueDate) < endOfWeek)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

    // 10. Completed today
    const completedTodayTasks = allTasks
      .filter(t => t.status === 'completed' && t.updatedAt && new Date(t.updatedAt) >= startOfToday)
      .sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime())
      .slice(0, 10);

    // 11. Summary counts
    const totalOpen = allTasks.filter(t => t.status !== 'completed').length;
    const totalOverdue = overdueTasks.length;
    const totalHighPriority = allTasks.filter(t => t.status !== 'completed' && t.priority === 'high').length;
    const completedToday = completedTodayTasks.length;
    const totalStarred = starredEmails.length;
    // 8. Pending suggestions (company links, enrichment)
    const allSuggestions = await db.getPendingSuggestions({ status: "pending" });
    const pendingSuggestionsData = await Promise.all(allSuggestions.slice(0, 10).map(async (s) => {
      const contact = s.contactId ? await db.getContactById(s.contactId) : null;
      const company = s.companyId ? await db.getCompanyById(s.companyId) : null;
      const suggestedCompany = s.suggestedCompanyId ? await db.getCompanyById(s.suggestedCompanyId) : null;
      return {
        id: s.id, type: s.type, status: s.status,
        contactId: s.contactId, contactName: contact?.name || null,
        companyId: s.companyId, companyName: company?.name || null,
        suggestedCompanyId: s.suggestedCompanyId, suggestedCompanyName: suggestedCompany?.name || null,
        suggestedData: s.suggestedData ? JSON.parse(s.suggestedData) : null,
        reason: s.reason, confidence: s.confidence, createdAt: s.createdAt,
      };
    }));

    const totalPendingApprovals = pendingContacts.length + pendingCompanies.length + allSuggestions.length;

    // Time-based greeting — note: server runs in UTC, frontend will override with local time
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    return {
      userName: userName.split(' ')[0], // First name only
      greeting,
      summary: {
        totalOpen,
        totalOverdue,
        totalHighPriority,
        completedToday,
        totalStarred,
        totalPendingApprovals,
      },
      overdueTasks: overdueTasks.map(t => ({
        id: t.id, title: t.title, priority: t.priority, dueDate: t.dueDate,
        assignedName: t.assignedName, category: t.category, status: t.status,
      })),
      todayTasks: todayTasks.map(t => ({
        id: t.id, title: t.title, priority: t.priority, dueDate: t.dueDate,
        assignedName: t.assignedName, category: t.category, status: t.status,
      })),
      highPriorityTasks: highPriorityTasks.map(t => ({
        id: t.id, title: t.title, priority: t.priority, dueDate: t.dueDate,
        assignedName: t.assignedName, category: t.category, status: t.status,
      })),
      starredEmails: starredEmails.map(s => ({
        threadId: s.threadId, starLevel: s.starLevel,
        subject: s.subject || null,
        fromName: s.fromName || null,
        fromEmail: s.fromEmail || null,
      })),
      pendingContacts: pendingContacts.map(c => ({
        id: c.id, name: c.name, email: c.email, organization: c.organization,
        title: c.title, source: c.source, createdAt: c.createdAt,
      })),
      pendingCompanies: pendingCompanies.map(c => ({
        id: c.id, name: c.name, sector: c.sector,
      })),
      recentMeetings: recentMeetings.map(m => ({
        id: m.id, title: m.meetingTitle, meetingDate: m.meetingDate,
        primaryLead: m.primaryLead, executiveSummary: m.executiveSummary,
      })),
      tomorrowTasks: tomorrowTasks.map(t => ({
        id: t.id, title: t.title, priority: t.priority, dueDate: t.dueDate,
        assignedName: t.assignedName, category: t.category, status: t.status,
      })),
      weekTasks: weekTasks.map(t => ({
        id: t.id, title: t.title, priority: t.priority, dueDate: t.dueDate,
        assignedName: t.assignedName, category: t.category, status: t.status,
      })),
      completedTodayTasks: completedTodayTasks.map(t => ({
        id: t.id, title: t.title, priority: t.priority, completedAt: t.updatedAt,
        assignedName: t.assignedName, category: t.category,
      })),
      pendingSuggestions: pendingSuggestionsData,
    };
  }),

  // Quick-complete a task from triage
  completeTask: protectedProcedure
    .input(z.object({ taskId: z.number() }))
    .mutation(async ({ input }) => {
      await db.updateTask(input.taskId, { status: 'completed' });
      return { success: true };
    }),

  // Dismiss a task (snooze by pushing due date forward)
  snoozeTask: protectedProcedure
    .input(z.object({ taskId: z.number(), days: z.number().min(1).max(30).default(1) }))
    .mutation(async ({ input }) => {
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + input.days);
      await db.updateTask(input.taskId, { dueDate: newDate });
      return { success: true, newDueDate: newDate };
    }),

  // Delete a task from triage
  deleteTask: protectedProcedure
    .input(z.object({ taskId: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteTask(input.taskId);
      return { success: true };
    }),

  // Update a task from triage (inline edit)
  updateTask: protectedProcedure
    .input(z.object({
      taskId: z.number(),
      title: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high']).optional(),
      status: z.enum(['open', 'in_progress', 'completed']).optional(),
      assignedName: z.string().nullable().optional(),
      dueDate: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
      category: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const { taskId, ...updates } = input;
      const cleanUpdates: any = {};
      if (updates.title) cleanUpdates.title = updates.title;
      if (updates.priority) cleanUpdates.priority = updates.priority;
      if (updates.status) cleanUpdates.status = updates.status;
      if (updates.assignedName !== undefined) cleanUpdates.assignedName = updates.assignedName;
      if (updates.dueDate !== undefined) cleanUpdates.dueDate = updates.dueDate ? new Date(updates.dueDate) : null;
      if (updates.notes !== undefined) cleanUpdates.notes = updates.notes;
      if (updates.category !== undefined) cleanUpdates.category = updates.category;
      await db.updateTask(taskId, cleanUpdates);
      return { success: true };
    }),

  // Find potential duplicates for a specific pending contact
  findDuplicatesFor: protectedProcedure
    .input(z.object({ contactId: z.number() }))
    .query(async ({ input }) => {
      const target = await db.getContactById(input.contactId);
      if (!target) throw new TRPCError({ code: 'NOT_FOUND' });
      const allContacts = await db.getAllContacts();
      const approvedContacts = allContacts.filter(c => c.approvalStatus === 'approved' && c.id !== target.id);
      const targetName = target.name.toLowerCase().trim();
      const targetParts = targetName.split(/\s+/);
      const targetEmail = target.email?.toLowerCase().trim();
      const targetOrg = target.organization?.toLowerCase().trim();

      const matches: { contact: typeof approvedContacts[0]; confidence: number; reason: string }[] = [];

      for (const c of approvedContacts) {
        const cName = c.name.toLowerCase().trim();
        const cParts = cName.split(/\s+/);
        const cEmail = c.email?.toLowerCase().trim();
        const cOrg = c.organization?.toLowerCase().trim();
        let confidence = 0;
        const reasons: string[] = [];

        // Exact name match
        if (targetName === cName) { confidence = 95; reasons.push('Exact name match'); }
        // Email match (strongest signal)
        else if (targetEmail && cEmail && targetEmail === cEmail) { confidence = 90; reasons.push('Same email address'); }
        // First+last swap (e.g., "Jake Ryan" vs "Ryan Jake")
        else if (targetParts.length >= 2 && cParts.length >= 2 &&
          targetParts[0] === cParts[cParts.length - 1] && targetParts[targetParts.length - 1] === cParts[0]) {
          confidence = 80; reasons.push('Name parts swapped');
        }
        // First name match + same org
        else if (targetParts[0] === cParts[0] && targetOrg && cOrg && targetOrg === cOrg) {
          confidence = 75; reasons.push('Same first name + organization');
        }
        // One name contains the other
        else if (targetName.length > 3 && cName.length > 3 && (targetName.includes(cName) || cName.includes(targetName))) {
          confidence = 65; reasons.push('Name overlap');
        }
        // Same last name + same org
        else if (targetParts.length >= 2 && cParts.length >= 2 &&
          targetParts[targetParts.length - 1] === cParts[cParts.length - 1] &&
          targetOrg && cOrg && targetOrg === cOrg) {
          confidence = 55; reasons.push('Same last name + organization');
        }
        // First name match only
        else if (targetParts[0] === cParts[0] && targetParts[0].length >= 3) {
          confidence = 40; reasons.push('Same first name');
        }

        if (confidence > 0) {
          // Boost confidence if org matches
          if (targetOrg && cOrg && targetOrg === cOrg && !reasons.includes('Same first name + organization') && !reasons.includes('Same last name + organization')) {
            confidence = Math.min(confidence + 10, 99);
            reasons.push('Same organization');
          }
          matches.push({
            contact: c,
            confidence,
            reason: reasons.join(', '),
          });
        }
      }

      return matches.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
    }),

  // Merge a pending contact into an existing approved contact
  mergeAndApprove: protectedProcedure
    .input(z.object({ pendingId: z.number(), mergeIntoId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const pending = await db.getContactById(input.pendingId);
      const target = await db.getContactById(input.mergeIntoId);
      if (!pending || !target) throw new TRPCError({ code: 'NOT_FOUND' });

      // Transfer meeting links from pending to target
      const pendingMeetings = await db.getMeetingsForContact(input.pendingId);
      for (const mm of pendingMeetings) {
        try { await db.linkContactToMeeting(mm.meeting.id, input.mergeIntoId); } catch {}
      }

      // Fill in missing fields from pending contact
      const updates: any = {};
      if (!target.email && pending.email) updates.email = pending.email;
      if (!target.phone && pending.phone) updates.phone = pending.phone;
      if (!target.organization && pending.organization) updates.organization = pending.organization;
      if (!target.title && pending.title) updates.title = pending.title;
      if (!target.dateOfBirth && pending.dateOfBirth) updates.dateOfBirth = pending.dateOfBirth;
      if (!target.address && pending.address) updates.address = pending.address;
      if (!target.website && pending.website) updates.website = pending.website;
      if (!target.linkedin && pending.linkedin) updates.linkedin = pending.linkedin;
      if (Object.keys(updates).length > 0) await db.updateContact(input.mergeIntoId, updates);

      // Save alias so the system learns this name maps to the kept contact
      if (pending.name && pending.name.toLowerCase() !== target.name?.toLowerCase()) {
        await db.saveContactAlias(ctx.user.id, input.mergeIntoId, pending.name, pending.email || undefined, "merge");
      }
      if (pending.email && pending.email !== target.email) {
        await db.saveContactAlias(ctx.user.id, input.mergeIntoId, pending.name || pending.email, pending.email, "merge");
      }

      // Delete the pending contact
      await db.deleteContact(input.pendingId);
      await db.logActivity({ userId: ctx.user.id, action: "merge_contacts", entityType: "contact", entityId: String(input.mergeIntoId), entityName: target.name, details: `Merged pending "${pending.name}" into "${target.name}"` });
      return { success: true, mergedInto: target.name };
    }),

  // Approve a contact from triage
  approveContact: protectedProcedure
    .input(z.object({ contactId: z.number() }))
    .mutation(async ({ input }) => {
      await db.updateContact(input.contactId, { approvalStatus: 'approved' });
      return { success: true };
    }),

  // Reject a contact from triage
  rejectContact: protectedProcedure
    .input(z.object({ contactId: z.number() }))
    .mutation(async ({ input }) => {
      await db.updateContact(input.contactId, { approvalStatus: 'rejected' });
      return { success: true };
    }),

  // Approve a company from triage
  approveCompany: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .mutation(async ({ input }) => {
      await db.updateCompany(input.companyId, { approvalStatus: 'approved' });
      return { success: true };
    }),

  // Reject a company from triage
  rejectCompany: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .mutation(async ({ input }) => {
      await db.updateCompany(input.companyId, { approvalStatus: 'rejected' });
      return { success: true };
    }),

  // Merge a pending company into an existing approved company
  mergeCompany: protectedProcedure
    .input(z.object({ pendingId: z.number(), mergeIntoId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const pending = await db.getCompanyById(input.pendingId);
      const target = await db.getCompanyById(input.mergeIntoId);
      if (!pending || !target) throw new TRPCError({ code: 'NOT_FOUND' });

      // Fill in missing fields from pending company
      const updates: any = {};
      if (!target.domain && pending.domain) updates.domain = pending.domain;
      if (!target.industry && pending.industry) updates.industry = pending.industry;
      if (!target.notes && pending.notes) updates.notes = pending.notes;
      if (!target.location && pending.location) updates.location = pending.location;
      if (!target.bankingPartner && pending.bankingPartner) updates.bankingPartner = pending.bankingPartner;
      if (!target.custodian && pending.custodian) updates.custodian = pending.custodian;
      if (Object.keys(updates).length > 0) await db.updateCompany(input.mergeIntoId, updates);

      // Transfer any contacts linked to the pending company
      const allContacts = await db.getAllContacts();
      for (const c of allContacts) {
        if ((c as any).companyId === input.pendingId) {
          await db.updateContact(c.id, { companyId: input.mergeIntoId } as any);
        }
      }

      // Save alias so the system learns this company name
      if (pending.name && pending.name.toLowerCase() !== target.name?.toLowerCase()) {
        await db.saveCompanyAlias(ctx.user.id, input.mergeIntoId, pending.name, "merge");
      }

      await db.deleteCompany(input.pendingId);
      await db.logActivity({ userId: ctx.user.id, action: "merge_companies", entityType: "company", entityId: String(input.mergeIntoId), entityName: target.name, details: `Merged pending "${pending.name}" into "${target.name}"` });
      return { success: true, mergedInto: target.name };
    }),

  // Find potential duplicate companies for a pending company
  findCompanyDuplicatesFor: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      const company = await db.getCompanyById(input.companyId);
      if (!company) return [];
      const allCompanies = await db.getAllCompanies();
      const approved = allCompanies.filter((c: any) => c.approvalStatus === 'approved' && c.id !== input.companyId);
      const matches: { company: any; confidence: number; reason: string }[] = [];
      const pendingName = (company.name || '').toLowerCase().trim();
      const pendingDomain = (company.domain || '').toLowerCase().trim();

      for (const c of approved) {
        const cName = (c.name || '').toLowerCase().trim();
        const cDomain = (c.domain || '').toLowerCase().trim();
        let confidence = 0;
        let reason = '';

        // Exact name match
        if (cName === pendingName) {
          confidence = 95;
          reason = 'Exact name match';
        }
        // Domain match
        else if (pendingDomain && cDomain && pendingDomain === cDomain) {
          confidence = 90;
          reason = 'Same domain';
        }
        // Name contains
        else if (cName.includes(pendingName) || pendingName.includes(cName)) {
          confidence = 70;
          reason = 'Name overlap';
        }
        // Fuzzy: check if words overlap significantly
        else {
          const pendingWords = pendingName.split(/\s+/).filter(w => w.length > 2);
          const cWords = cName.split(/\s+/).filter(w => w.length > 2);
          const overlap = pendingWords.filter(w => cWords.includes(w)).length;
          if (overlap >= 2 || (overlap >= 1 && Math.min(pendingWords.length, cWords.length) <= 2)) {
            confidence = 55;
            reason = 'Similar words';
          }
        }

        if (confidence >= 50) {
          matches.push({ company: c, confidence, reason });
        }
      }
      return matches.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
    }),

  bulkApproveCompanies: protectedProcedure
    .input(z.object({ ids: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      for (const id of input.ids) {
        await db.updateCompany(id, { approvalStatus: 'approved' });
      }
      await db.logActivity({ userId: ctx.user.id, action: "bulk_approve_companies", entityType: "company", entityId: input.ids.join(","), details: `Bulk approved ${input.ids.length} companies` });
      return { approved: input.ids.length };
    }),

  bulkRejectCompanies: protectedProcedure
    .input(z.object({ ids: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      for (const id of input.ids) {
        await db.updateCompany(id, { approvalStatus: 'rejected' });
      }
      await db.logActivity({ userId: ctx.user.id, action: "bulk_reject_companies", entityType: "company", entityId: input.ids.join(","), details: `Bulk rejected ${input.ids.length} companies` });
      return { rejected: input.ids.length };
    }),

  // AI Strategic Insights — generates contextual recommendations
  strategicInsights: protectedProcedure.query(async ({ ctx }) => {
    const { invokeLLM } = await import('./_core/llm');
    const allTasks = await db.getAllTasks();
    const allContacts = await db.getAllContacts();
    const allCompanies = await db.getAllCompanies();
    const recentMeetings = await db.getAllMeetings({ limit: 10 });
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Compute key metrics
    const openTasks = allTasks.filter(t => t.status !== 'completed');
    const overdueTasks = openTasks.filter(t => t.dueDate && new Date(t.dueDate) < startOfToday);
    const highPriority = openTasks.filter(t => t.priority === 'high');
    const pendingApprovals = allContacts.filter(c => c.approvalStatus === 'pending').length + allCompanies.filter(c => c.approvalStatus === 'pending').length;

    // Stale contacts (starred/client not met in 10+ days)
    const staleContacts: string[] = [];
    for (const c of allContacts.filter(c => c.starred || c.category === 'client')) {
      const meetings = await db.getMeetingsForContact(c.id);
      if (meetings.length > 0) {
        const daysSince = Math.floor((now.getTime() - new Date(meetings[0].meeting.meetingDate).getTime()) / 86400000);
        if (daysSince > 10) staleContacts.push(`${c.name} (${daysSince} days)`);
      }
    }

    // Build stale contact details for navigation targets
    const staleContactDetails: { name: string; id: number; days: number }[] = [];
    for (const c of allContacts.filter(c => c.starred || c.category === 'client')) {
      const meetings = await db.getMeetingsForContact(c.id);
      if (meetings.length > 0) {
        const daysSince = Math.floor((now.getTime() - new Date(meetings[0].meeting.meetingDate).getTime()) / 86400000);
        if (daysSince > 10) staleContactDetails.push({ name: c.name, id: c.id, days: daysSince });
      }
    }
    staleContactDetails.sort((a, b) => b.days - a.days);

    const prompt = `You are OmniScope's strategic intelligence engine. Generate exactly 3 short, actionable insights based on this data. Each insight should be 1 sentence max, direct and commanding — like a military briefing or Tesla dashboard notification.

Data:
- Open tasks: ${openTasks.length}, Overdue: ${overdueTasks.length}, High priority: ${highPriority.length}
- Pending approvals: ${pendingApprovals}
- Stale contacts (no meeting 10+ days): ${staleContactDetails.slice(0, 5).map(c => `${c.name} (${c.days} days)`).join(', ') || 'None'}
- Recent meetings: ${recentMeetings.slice(0, 5).map(m => m.meetingTitle).join(', ') || 'None'}
- Today's date: ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}

Rules:
- If no risks: "No critical risks detected today."
- If stale contacts: mention the specific name and days
- If overdue tasks: mention count and urgency
- If pending approvals: mention them
- Be specific with names and numbers
- No fluff, no emojis, no markdown
- Return as JSON array of 3 strings

Example output:
["No critical risks detected today.", "You haven't contacted Kyle in 12 days.", "Three deals awaiting response."]`;

    try {
      const result = await invokeLLM({
        messages: [
          { role: 'system', content: 'You are a strategic intelligence engine. Return only a JSON array of 3 short insight strings. No markdown, no explanation.' },
          { role: 'user', content: prompt },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'insights',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                insights: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of exactly 3 strategic insight strings',
                },
              },
              required: ['insights'],
              additionalProperties: false,
            },
          },
        },
      });
      const content = result.choices[0]?.message?.content as string;
      const parsed = JSON.parse(content);
      const rawInsights: string[] = parsed.insights?.slice(0, 3) || [];

      // Attach navigation targets to each insight
      const insights = rawInsights.map(text => {
        // Check if insight mentions a stale contact
        const matchedContact = staleContactDetails.find(c => text.toLowerCase().includes(c.name.toLowerCase().split(' ')[0]));
        if (matchedContact) return { text, linkTo: `/relationships`, linkLabel: matchedContact.name, type: 'contact' as const };
        // Check if insight mentions overdue tasks
        if (/overdue/i.test(text)) return { text, linkTo: '/', linkLabel: 'View overdue', type: 'overdue' as const, filterKey: 'overdue' as const };
        // Check if insight mentions approvals
        if (/approval|pending/i.test(text)) return { text, linkTo: '/', linkLabel: 'View pending', type: 'pending' as const, filterKey: 'pending' as const };
        // Check if insight mentions high priority
        if (/high.?priority/i.test(text)) return { text, linkTo: '/', linkLabel: 'View high priority', type: 'high' as const, filterKey: 'high' as const };
        // Default: no link
        return { text, linkTo: null, linkLabel: null, type: 'info' as const };
      });

      return { insights };
    } catch {
      // Fallback: generate insights from data without LLM
      const insights: { text: string; linkTo: string | null; linkLabel: string | null; type: string }[] = [];
      if (overdueTasks.length > 0) {
        insights.push({ text: `${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''} require immediate attention.`, linkTo: '/', linkLabel: 'View overdue', type: 'overdue' });
      } else {
        insights.push({ text: 'No critical risks detected today.', linkTo: null, linkLabel: null, type: 'info' });
      }
      if (staleContactDetails.length > 0) {
        const sc = staleContactDetails[0];
        insights.push({ text: `${sc.name} is a stale contact, last interaction ${sc.days} days ago.`, linkTo: '/relationships', linkLabel: sc.name, type: 'contact' });
      } else {
        insights.push({ text: 'All key contacts are up to date.', linkTo: null, linkLabel: null, type: 'info' });
      }
      if (pendingApprovals > 0) {
        insights.push({ text: `${pendingApprovals} pending approval${pendingApprovals > 1 ? 's' : ''} require${pendingApprovals === 1 ? 's' : ''} immediate action.`, linkTo: '/', linkLabel: 'View pending', type: 'pending' });
      } else {
        insights.push({ text: `${openTasks.length} open tasks across your pipeline.`, linkTo: '/operations', linkLabel: 'View tasks', type: 'info' });
      }
      return { insights: insights.slice(0, 3) };
    }
  }),
});

// ============================================================================
// ACTIVITY LOG ROUTER
// ============================================================================

const activityLogRouter = router({
  list: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
      action: z.string().optional(),
      entityType: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      return await db.getActivityLog({
        limit: input?.limit || 50,
        offset: input?.offset || 0,
        action: input?.action,
        entityType: input?.entityType,
        startDate: input?.startDate ? new Date(input.startDate) : undefined,
        endDate: input?.endDate ? new Date(input.endDate) : undefined,
      });
    }),

  exportAll: protectedProcedure
    .input(z.object({
      action: z.string().optional(),
      entityType: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      // Fetch ALL entries (no limit) for CSV export
      return await db.getActivityLog({
        limit: 10000,
        offset: 0,
        action: input?.action,
        entityType: input?.entityType,
      });
    }),

  actions: protectedProcedure.query(async () => {
    // Return distinct action types for filter dropdown
    return [
      "approve_contact", "reject_contact", "merge_contacts",
      "bulk_approve_contacts", "bulk_reject_contacts",
      "approve_company", "reject_company",
      "bulk_approve_companies", "bulk_reject_companies",
      "approve_suggestion", "reject_suggestion",
      "bulk_approve_suggestions", "bulk_reject_suggestions",
      "dedup_merge", "dedup_dismiss",
    ];
  }),
});

// ============================================================================
// DEDUPLICATION SWEEP ROUTER
// ============================================================================

const dedupRouter = router({
  scan: protectedProcedure.mutation(async () => {
    const allContacts = await db.getAllContacts();
    const approved = allContacts.filter((c: any) => c.approvalStatus === "approved");
    const clusters: Array<{ contacts: typeof approved; confidence: number; reason: string }> = [];

    for (let i = 0; i < approved.length; i++) {
      for (let j = i + 1; j < approved.length; j++) {
        const a = approved[i];
        const b = approved[j];
        if (!a.name || !b.name) continue;

        // Exact email match
        if (a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase()) {
          clusters.push({ contacts: [a, b], confidence: 95, reason: "Same email address" });
          continue;
        }

        // Name similarity
        const nameA = a.name.toLowerCase().trim();
        const nameB = b.name.toLowerCase().trim();
        if (nameA === nameB) {
          clusters.push({ contacts: [a, b], confidence: 90, reason: "Exact name match" });
          continue;
        }

        // Name parts swap ("Jake Ryan" vs "Ryan Jake")
        const partsA = nameA.split(/\s+/).sort();
        const partsB = nameB.split(/\s+/).sort();
        if (partsA.length > 1 && partsB.length > 1 && partsA.join(" ") === partsB.join(" ")) {
          clusters.push({ contacts: [a, b], confidence: 85, reason: "Name parts match (reordered)" });
          continue;
        }

        // First name + same org
        if (partsA[0] === partsB[0] && a.organization && b.organization &&
            a.organization.toLowerCase() === b.organization.toLowerCase()) {
          clusters.push({ contacts: [a, b], confidence: 70, reason: "Same first name + same organization" });
          continue;
        }

        // Levenshtein-like similarity for short names
        if (nameA.length > 3 && nameB.length > 3) {
          const maxLen = Math.max(nameA.length, nameB.length);
          let matches = 0;
          const shorter = nameA.length <= nameB.length ? nameA : nameB;
          const longer = nameA.length <= nameB.length ? nameB : nameA;
          for (let k = 0; k < shorter.length; k++) {
            if (longer.includes(shorter[k])) matches++;
          }
          const similarity = matches / maxLen;
          if (similarity > 0.85 && Math.abs(nameA.length - nameB.length) <= 2) {
            clusters.push({ contacts: [a, b], confidence: 60, reason: "High name similarity" });
          }
        }
      }
    }

    // Sort by confidence descending
    clusters.sort((a, b) => b.confidence - a.confidence);
    return { clusters: clusters.slice(0, 50), totalScanned: approved.length };
  }),

  merge: protectedProcedure
    .input(z.object({ keepId: z.number(), mergeId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const keep = await db.getContactById(input.keepId);
      const merge = await db.getContactById(input.mergeId);
      if (!keep || !merge) throw new TRPCError({ code: "NOT_FOUND" });

      const mergeMeetings = await db.getMeetingsForContact(input.mergeId);
      for (const mm of mergeMeetings) {
        try { await db.linkContactToMeeting(mm.meeting.id, input.keepId); } catch {}
      }
      const updates: any = {};
      if (!keep.email && merge.email) updates.email = merge.email;
      if (!keep.phone && merge.phone) updates.phone = merge.phone;
      if (!keep.organization && merge.organization) updates.organization = merge.organization;
      if (!keep.title && merge.title) updates.title = merge.title;
      if (!keep.dateOfBirth && merge.dateOfBirth) updates.dateOfBirth = merge.dateOfBirth;
      if (!keep.address && merge.address) updates.address = merge.address;
      if (!keep.website && merge.website) updates.website = merge.website;
      if (!keep.linkedin && merge.linkedin) updates.linkedin = merge.linkedin;
      if (Object.keys(updates).length > 0) await db.updateContact(input.keepId, updates);
      await db.deleteContact(input.mergeId);

      await db.logActivity({
        userId: ctx.user.id,
        action: "dedup_merge",
        entityType: "contact",
        entityId: String(input.keepId),
        entityName: keep.name,
        details: `Dedup merged "${merge.name}" into "${keep.name}"`,
        metadata: JSON.stringify({ keepId: input.keepId, mergeId: input.mergeId, mergeName: merge.name }),
      });
      return { success: true };
    }),

  dismiss: protectedProcedure
    .input(z.object({ contactAId: z.number(), contactBId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.logActivity({
        userId: ctx.user.id,
        action: "dedup_dismiss",
        entityType: "contact",
        entityId: `${input.contactAId},${input.contactBId}`,
        details: "Dismissed duplicate suggestion as false positive",
      });
      return { success: true };
    }),
});

// ============================================================================
// INTELLIGENCE VAULT ROUTER
// ============================================================================

const vaultRouter = router({
  // Document CRUD
  listDocuments: protectedProcedure
    .input(z.object({
      collection: z.string().optional(),
      category: z.string().optional(),
      status: z.string().optional(),
      folderId: z.number().nullable().optional(),
      isTemplate: z.boolean().optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ input, ctx }) => {
      return db.listDocuments(input ? { ...input, ownerId: undefined } : undefined);
    }),

  getDocument: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const doc = await db.getDocumentById(input.id);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      return doc;
    }),

  createDocument: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      sourceType: z.enum(["google_doc", "google_sheet", "google_slide", "pdf", "uploaded", "generated"]),
      googleFileId: z.string().optional(),
      s3Url: z.string().optional(),
      s3Key: z.string().optional(),
      fileName: z.string().optional(),
      mimeType: z.string().optional(),
      collection: z.enum(["company_repo", "personal", "counterparty", "template", "transaction", "signed"]).default("company_repo"),
      category: z.enum(["agreement", "compliance", "intake", "profile", "strategy", "operations", "transaction", "correspondence", "template", "other"]).default("other"),
      subcategory: z.string().optional(),
      visibility: z.enum(["organization", "team", "private", "restricted"]).default("organization"),
      folderId: z.number().optional(),
      isTemplate: z.boolean().default(false),
      fileSize: z.number().optional(),
      entityLinks: z.array(z.object({
        entityType: z.enum(["company", "contact", "meeting"]),
        entityId: z.number(),
        linkType: z.enum(["primary", "related", "mentioned", "generated_for", "signed_by"]).default("primary"),
      })).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { entityLinks, ...docData } = input;
      const doc = await db.createDocument({ ...docData, ownerId: ctx.user!.id });
      if (!doc) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create document" });
      // Add entity links
      if (entityLinks && entityLinks.length > 0) {
        for (const link of entityLinks) {
          await db.addDocumentEntityLink({ documentId: doc.id!, entityType: link.entityType, entityId: link.entityId, linkType: link.linkType });
        }
      }
      // Log activity
      await db.logActivity({
        userId: ctx.user!.id,
        action: "document_created",
        entityType: "document",
        entityId: String(doc.id),
        entityName: input.title,
        details: JSON.stringify({ sourceType: input.sourceType, collection: input.collection, category: input.category }),
      });
      return doc;
    }),

  updateDocument: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      description: z.string().optional(),
      collection: z.enum(["company_repo", "personal", "counterparty", "template", "transaction", "signed"]).optional(),
      category: z.enum(["agreement", "compliance", "intake", "profile", "strategy", "operations", "transaction", "correspondence", "template", "other"]).optional(),
      subcategory: z.string().optional(),
      status: z.enum(["draft", "active", "pending_signature", "sent", "viewed", "signed", "voided", "declined", "archived"]).optional(),
      visibility: z.enum(["organization", "team", "private", "restricted"]).optional(),
      folderId: z.number().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const doc = await db.updateDocument(id, data);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      return doc;
    }),

  deleteDocument: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const doc = await db.getDocumentById(input.id);
      await db.deleteDocument(input.id);
      if (doc) {
        await db.logActivity({
          userId: ctx.user!.id,
          action: "document_deleted",
          entityType: "document",
          entityId: String(input.id),
          entityName: doc.title,
        });
      }
      return { success: true };
    }),

  // Entity links
  addEntityLink: protectedProcedure
    .input(z.object({
      documentId: z.number(),
      entityType: z.enum(["company", "contact", "meeting"]),
      entityId: z.number(),
      linkType: z.enum(["primary", "related", "mentioned", "generated_for", "signed_by"]).default("primary"),
    }))
    .mutation(async ({ input }) => {
      return db.addDocumentEntityLink(input);
    }),

  removeEntityLink: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return db.removeDocumentEntityLink(input.id);
    }),

  getDocumentsByEntity: protectedProcedure
    .input(z.object({
      entityType: z.enum(["company", "contact", "meeting"]),
      entityId: z.number(),
    }))
    .query(async ({ input }) => {
      return db.getDocumentsByEntity(input.entityType, input.entityId);
    }),

  // Favorites
  toggleFavorite: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const isFavorited = await db.toggleFavorite(ctx.user!.id, input.documentId);
      return { isFavorited };
    }),

  getFavorites: protectedProcedure
    .query(async ({ ctx }) => {
      return db.getFavoriteDocuments(ctx.user!.id);
    }),

  getRecent: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
    .query(async ({ input, ctx }) => {
      return db.getRecentDocuments(ctx.user!.id, input?.limit);
    }),

  // Folders
  listFolders: protectedProcedure
    .input(z.object({
      collection: z.string().optional(),
      parentId: z.number().nullable().optional(),
    }).optional())
    .query(async ({ input }) => {
      return db.listFolders(input || undefined);
    }),

  createFolder: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      collection: z.enum(["company_repo", "personal", "counterparty", "templates", "signed", "transactions"]),
      parentId: z.number().nullable().optional(),
      entityType: z.enum(["company", "contact"]).optional(),
      entityId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return db.createFolder({ ...input, ownerId: ctx.user!.id });
    }),

  updateFolder: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return db.updateFolder(id, data);
    }),

  deleteFolder: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return db.deleteFolder(input.id);
    }),

  // Folder navigation
  getFolderContents: protectedProcedure
    .input(z.object({ folderId: z.number().nullable() }))
    .query(async ({ input }) => {
      return db.getFolderWithChildren(input.folderId);
    }),

  getFolderBreadcrumbs: protectedProcedure
    .input(z.object({ folderId: z.number() }))
    .query(async ({ input }) => {
      return db.getFolderBreadcrumbs(input.folderId);
    }),

  getFolderById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getFolderById(input.id);
    }),

  // Move documents to folder
  moveDocumentToFolder: protectedProcedure
    .input(z.object({ documentId: z.number(), folderId: z.number().nullable() }))
    .mutation(async ({ input }) => {
      return db.moveDocumentToFolder(input.documentId, input.folderId);
    }),

  moveDocumentsToFolder: protectedProcedure
    .input(z.object({ documentIds: z.array(z.number()), folderId: z.number().nullable() }))
    .mutation(async ({ input }) => {
      return db.moveDocumentsToFolder(input.documentIds, input.folderId);
    }),

  // Move folder (change parent)
  moveFolder: protectedProcedure
    .input(z.object({ folderId: z.number(), newParentId: z.number().nullable() }))
    .mutation(async ({ input }) => {
      return db.updateFolder(input.folderId, { parentId: input.newParentId ?? undefined });
    }),

  // Access management
  getDocumentAccess: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ input }) => {
      return db.getDocumentAccessList(input.documentId);
    }),

  getFolderAccess: protectedProcedure
    .input(z.object({ folderId: z.number() }))
    .query(async ({ input }) => {
      return db.getFolderAccessList(input.folderId);
    }),

  // Unified access list query (supports both documents and folders)
  getAccessList: protectedProcedure
    .input(z.object({
      targetType: z.enum(["document", "folder"]),
      targetId: z.number(),
    }))
    .query(async ({ input }) => {
      if (input.targetType === "folder") {
        return db.getFolderAccessList(input.targetId);
      }
      return db.getDocumentAccessList(input.targetId);
    }),

  grantAccess: protectedProcedure
    .input(z.object({
      targetType: z.enum(["document", "folder"]),
      targetId: z.number(),
      contactId: z.number().optional(),
      companyId: z.number().optional(),
      userId: z.number().optional(),
      accessLevel: z.enum(["view", "edit", "admin"]).default("view"),
    }))
    .mutation(async ({ input, ctx }) => {
      const base: any = {
        accessLevel: input.accessLevel,
        grantedBy: ctx.user!.id,
      };
      if (input.contactId) base.contactId = input.contactId;
      if (input.companyId) base.companyId = input.companyId;
      if (input.userId) base.userId = input.userId;
      if (input.targetType === "folder") {
        return db.grantFolderAccess({ folderId: input.targetId, ...base });
      }
      return db.grantDocumentAccess({ documentId: input.targetId, ...base });
    }),

  revokeAccess: protectedProcedure
    .input(z.object({ accessId: z.number() }))
    .mutation(async ({ input }) => {
      return db.revokeDocumentAccess(input.accessId);
    }),

  // Move document to a different collection
  moveToCollection: protectedProcedure
    .input(z.object({
      documentId: z.number(),
      collection: z.enum(["company_repo", "personal", "counterparty", "template", "transaction", "signed"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const doc = await db.moveDocumentToCollection(input.documentId, input.collection);
      if (doc) {
        await db.logActivity({
          userId: ctx.user!.id,
          action: "document_moved",
          entityType: "document",
          entityId: String(input.documentId),
          entityName: doc.title,
          details: JSON.stringify({ newCollection: input.collection }),
        });
      }
      return doc;
    }),

  // Convert a document to a template
  convertToTemplate: protectedProcedure
    .input(z.object({
      documentId: z.number(),
      name: z.string().min(1),
      category: z.enum(["agreement", "compliance", "intake", "profile", "other"]).default("agreement"),
      subcategory: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const doc = await db.getDocumentById(input.documentId);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      const template = await db.createTemplate({
        name: input.name,
        category: input.category,
        subcategory: input.subcategory,
        googleFileId: doc.googleFileId,
        s3Url: doc.s3Url,
        createdBy: ctx.user!.id,
      });
      // Also move the document to the template collection
      await db.moveDocumentToCollection(input.documentId, "template");
      await db.updateDocument(input.documentId, { isTemplate: true });
      await db.logActivity({
        userId: ctx.user!.id,
        action: "document_converted_to_template",
        entityType: "document",
        entityId: String(input.documentId),
        entityName: doc.title,
        details: JSON.stringify({ templateName: input.name, templateId: template?.id }),
      });
      return template;
    }),

  // AI Document Analysiss
  analyzeDocument: protectedProcedure
    .input(z.object({
      title: z.string(),
      fileName: z.string().optional(),
      mimeType: z.string().optional(),
      textContent: z.string().optional(), // extracted text for analysis
    }))
    .mutation(async ({ input }) => {
      try {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are an institutional document analyst for OmniScope, a private financial infrastructure platform. Analyze the document and extract structured metadata. Return JSON only.

Categories: agreement, compliance, intake, profile, strategy, operations, transaction, correspondence, template, other
Subcategories: sppp (Strategic Private Placement Program), ncnda (Non-Circumvention Non-Disclosure Agreement), jva (Joint Venture Agreement), kyc (Know Your Customer), kyb (Know Your Business), cis (Customer Information Sheet), nda, mou, loi, sow, invoice, receipt, report, memo, other
Collections: company_repo, counterparty, transaction, signed

Return JSON with: { "suggestedTitle": string, "category": string, "subcategory": string, "collection": string, "summary": string (2-3 sentences), "detectedEntities": { "companies": string[], "people": string[] }, "tags": string[] }`,
            },
            {
              role: "user",
              content: `Analyze this document:\nTitle: ${input.title}\nFilename: ${input.fileName || "unknown"}\nMIME Type: ${input.mimeType || "unknown"}\n\nContent excerpt:\n${(input.textContent || "").slice(0, 4000)}`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "document_analysis",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  suggestedTitle: { type: "string", description: "Clean, professional title" },
                  category: { type: "string", description: "Document category" },
                  subcategory: { type: "string", description: "Document subcategory" },
                  collection: { type: "string", description: "Vault collection" },
                  summary: { type: "string", description: "2-3 sentence summary" },
                  detectedEntities: {
                    type: "object",
                    properties: {
                      companies: { type: "array", items: { type: "string" } },
                      people: { type: "array", items: { type: "string" } },
                    },
                    required: ["companies", "people"],
                    additionalProperties: false,
                  },
                  tags: { type: "array", items: { type: "string" } },
                },
                required: ["suggestedTitle", "category", "subcategory", "collection", "summary", "detectedEntities", "tags"],
                additionalProperties: false,
              },
            },
          },
        });
        const content = response.choices?.[0]?.message?.content;
        if (content) return JSON.parse(content);
        return null;
      } catch (error) {
        console.error("[Vault] AI analysis failed:", error);
        return null;
      }
    }),

  // ── Document Notes ──
  getNotes: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ input }) => {
      return db.getDocumentNotes(input.documentId);
    }),

  addNote: protectedProcedure
    .input(z.object({ documentId: z.number(), content: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      return db.addDocumentNote(input.documentId, ctx.user.id, input.content);
    }),

  deleteNote: protectedProcedure
    .input(z.object({ noteId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      return db.deleteDocumentNote(input.noteId, ctx.user.id);
    }),
});

// ============================================================================
// GOOGLE DRIVE / DOCS / SHEETS ROUTER
// ============================================================================

const driveRouter = router({
  // Connection status
  connectionStatus: protectedProcedure.query(async ({ ctx }) => {
    const status = await isGoogleConnected(ctx.user.id);
    return {
      connected: status.connected,
      email: status.email,
      hasDriveScopes: status.hasDriveScopes ?? false,
      hasDocsScopes: status.hasDocsScopes ?? false,
      hasSheetsScopes: status.hasSheetsScopes ?? false,
    };
  }),

  // List files in a Drive folder
  listFiles: protectedProcedure
    .input(z.object({
      folderId: z.string().optional(),
      pageToken: z.string().optional(),
      pageSize: z.number().min(1).max(100).default(50),
      query: z.string().optional(),
      driveId: z.string().optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      const result = await googleDrive.listDriveFiles(
        ctx.user.id,
        input?.folderId,
        input?.pageToken,
        input?.pageSize,
        input?.query,
        input?.driveId,
      );
      if (!result) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Google Drive not connected. Please connect your Google account in Settings." });
      return result;
    }),

  // Search files across Drive
  searchFiles: protectedProcedure
    .input(z.object({ query: z.string().min(1), pageSize: z.number().default(20) }))
    .query(async ({ input, ctx }) => {
      const files = await googleDrive.searchDriveFiles(ctx.user.id, input.query, input.pageSize);
      if (!files) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Google Drive not connected." });
      return files;
    }),

  // Get file metadata
  getFile: protectedProcedure
    .input(z.object({ fileId: z.string() }))
    .query(async ({ input, ctx }) => {
      const file = await googleDrive.getDriveFile(ctx.user.id, input.fileId);
      if (!file) throw new TRPCError({ code: "NOT_FOUND", message: "File not found or Drive not connected." });
      return file;
    }),

  // Create a new folder in Drive
  createFolder: protectedProcedure
    .input(z.object({ name: z.string().min(1), parentFolderId: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const folder = await googleDrive.createDriveFolder(ctx.user.id, input.name, input.parentFolderId);
      if (!folder) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create folder." });
      await db.logActivity({
        userId: ctx.user.id,
        action: "drive_folder_created",
        entityType: "document",
        entityId: folder.id,
        entityName: input.name,
      });
      return folder;
    }),

  // Create a new Google Doc
  createDoc: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      folderId: z.string().optional(),
      // Optional: also register in Vault
      registerInVault: z.boolean().default(true),
      collection: z.enum(["company_repo", "personal", "counterparty", "template", "transaction", "signed"]).default("company_repo"),
      category: z.enum(["agreement", "compliance", "intake", "profile", "strategy", "operations", "transaction", "correspondence", "template", "other"]).default("other"),
      entityLinks: z.array(z.object({
        entityType: z.enum(["company", "contact", "meeting"]),
        entityId: z.number(),
        linkType: z.enum(["primary", "related", "mentioned", "generated_for", "signed_by"]).default("primary"),
      })).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const doc = await googleDrive.createGoogleDoc(ctx.user.id, input.title, input.folderId);
      if (!doc) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create Google Doc. Ensure Drive is connected." });

      let vaultDoc = null;
      if (input.registerInVault) {
        vaultDoc = await db.createDocument({
          title: input.title,
          sourceType: "google_doc",
          googleFileId: doc.id,
          googleMimeType: "application/vnd.google-apps.document",
          collection: input.collection,
          category: input.category,
          status: "active",
          visibility: "organization",
          ownerId: ctx.user.id,
        });
        if (vaultDoc && input.entityLinks) {
          for (const link of input.entityLinks) {
            await db.addDocumentEntityLink({ documentId: vaultDoc.id!, entityType: link.entityType, entityId: link.entityId, linkType: link.linkType });
          }
        }
      }

      await db.logActivity({
        userId: ctx.user.id,
        action: "google_doc_created",
        entityType: "document",
        entityId: doc.id,
        entityName: input.title,
        details: JSON.stringify({ googleFileId: doc.id, webViewLink: doc.webViewLink, vaultDocId: vaultDoc?.id }),
      });

      return { ...doc, vaultDocId: vaultDoc?.id };
    }),

  // Create a new Google Sheet
  createSheet: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      folderId: z.string().optional(),
      registerInVault: z.boolean().default(true),
      collection: z.enum(["company_repo", "personal", "counterparty", "template", "transaction", "signed"]).default("company_repo"),
      category: z.enum(["agreement", "compliance", "intake", "profile", "strategy", "operations", "transaction", "correspondence", "template", "other"]).default("other"),
      entityLinks: z.array(z.object({
        entityType: z.enum(["company", "contact", "meeting"]),
        entityId: z.number(),
        linkType: z.enum(["primary", "related", "mentioned", "generated_for", "signed_by"]).default("primary"),
      })).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const sheet = await googleDrive.createGoogleSheet(ctx.user.id, input.title, input.folderId);
      if (!sheet) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create Google Sheet. Ensure Drive is connected." });

      let vaultDoc = null;
      if (input.registerInVault) {
        vaultDoc = await db.createDocument({
          title: input.title,
          sourceType: "google_sheet",
          googleFileId: sheet.id,
          googleMimeType: "application/vnd.google-apps.spreadsheet",
          collection: input.collection,
          category: input.category,
          status: "active",
          visibility: "organization",
          ownerId: ctx.user.id,
        });
        if (vaultDoc && input.entityLinks) {
          for (const link of input.entityLinks) {
            await db.addDocumentEntityLink({ documentId: vaultDoc.id!, entityType: link.entityType, entityId: link.entityId, linkType: link.linkType });
          }
        }
      }

      await db.logActivity({
        userId: ctx.user.id,
        action: "google_sheet_created",
        entityType: "document",
        entityId: sheet.id,
        entityName: input.title,
        details: JSON.stringify({ googleFileId: sheet.id, webViewLink: sheet.webViewLink, vaultDocId: vaultDoc?.id }),
      });

      return { ...sheet, vaultDocId: vaultDoc?.id };
    }),

  // Read Google Doc text (for AI analysis or preview)
  readDocText: protectedProcedure
    .input(z.object({ docId: z.string() }))
    .query(async ({ input, ctx }) => {
      const text = await googleDrive.readGoogleDocText(ctx.user.id, input.docId);
      return { text };
    }),

  // Export Google Doc as HTML for internal viewer
  exportDocHtml: protectedProcedure
    .input(z.object({ docId: z.string() }))
    .query(async ({ input, ctx }) => {
      const drive = await googleDrive.getDriveClient(ctx.user.id);
      if (!drive) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Google Drive not connected." });
      try {
        const response = await drive.files.export(
          { fileId: input.docId, mimeType: "text/html" },
          { responseType: "text" }
        );
        return { html: response.data as string };
      } catch (error: any) {
        console.error("[Google Docs] Export HTML error:", error.message);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to export document as HTML." });
      }
    }),

  // Read Google Sheet data (for preview)
  readSheetData: protectedProcedure
    .input(z.object({ spreadsheetId: z.string(), range: z.string().default("Sheet1!A1:Z100") }))
    .query(async ({ input, ctx }) => {
      return googleDrive.readSheetData(ctx.user.id, input.spreadsheetId, input.range);
    }),

  // List shared drives
  listSharedDrives: protectedProcedure
    .query(async ({ ctx }) => {
      return googleDrive.listSharedDrives(ctx.user.id);
    }),

  // Generate document from template (Google Docs-based)
  generateFromTemplate: protectedProcedure
    .input(z.object({
      templateDocId: z.string(), // Google Doc ID of the template
      newTitle: z.string(),
      mergeFields: z.record(z.string()), // { "client_name": "Wintermute", ... }
      folderId: z.string().optional(),
      // Vault registration
      collection: z.enum(["company_repo", "personal", "counterparty", "template", "transaction", "signed"]).default("counterparty"),
      category: z.enum(["agreement", "compliance", "intake", "profile", "strategy", "operations", "transaction", "correspondence", "template", "other"]).default("agreement"),
      entityLinks: z.array(z.object({
        entityType: z.enum(["company", "contact", "meeting"]),
        entityId: z.number(),
        linkType: z.enum(["primary", "related", "mentioned", "generated_for", "signed_by"]).default("generated_for"),
      })).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await googleDrive.generateFromTemplate(
        ctx.user.id,
        input.templateDocId,
        input.newTitle,
        input.mergeFields,
        input.folderId,
      );
      if (!result) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to generate document from template." });

      // Register in Vault
      const vaultDoc = await db.createDocument({
        title: input.newTitle,
        sourceType: "google_doc",
        googleFileId: result.id,
        googleMimeType: "application/vnd.google-apps.document",
        collection: input.collection,
        category: input.category,
        status: "draft",
        visibility: "organization",
        ownerId: ctx.user.id,
      });

      if (vaultDoc && input.entityLinks) {
        for (const link of input.entityLinks) {
          await db.addDocumentEntityLink({ documentId: vaultDoc.id!, entityType: link.entityType, entityId: link.entityId, linkType: link.linkType });
        }
      }

      await db.logActivity({
        userId: ctx.user.id,
        action: "document_generated_from_template",
        entityType: "document",
        entityId: result.id,
        entityName: input.newTitle,
        details: JSON.stringify({
          templateDocId: input.templateDocId,
          mergeFieldCount: Object.keys(input.mergeFields).length,
          webViewLink: result.webViewLink,
          vaultDocId: vaultDoc?.id,
        }),
      });

      return { ...result, vaultDocId: vaultDoc?.id };
    }),

  // Import a Drive file into the Vault
  importToVault: protectedProcedure
    .input(z.object({
      googleFileId: z.string(),
      title: z.string().optional(),
      collection: z.enum(["company_repo", "personal", "counterparty", "template", "transaction", "signed"]).default("company_repo"),
      category: z.enum(["agreement", "compliance", "intake", "profile", "strategy", "operations", "transaction", "correspondence", "template", "other"]).default("other"),
      entityLinks: z.array(z.object({
        entityType: z.enum(["company", "contact", "meeting"]),
        entityId: z.number(),
        linkType: z.enum(["primary", "related", "mentioned", "generated_for", "signed_by"]).default("primary"),
      })).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Get file metadata from Drive
      const file = await googleDrive.getDriveFile(ctx.user.id, input.googleFileId);
      if (!file) throw new TRPCError({ code: "NOT_FOUND", message: "File not found in Google Drive." });

      // Map MIME type to sourceType
      let sourceType: "google_doc" | "google_sheet" | "google_slide" | "pdf" | "uploaded" = "uploaded";
      if (file.mimeType === "application/vnd.google-apps.document") sourceType = "google_doc";
      else if (file.mimeType === "application/vnd.google-apps.spreadsheet") sourceType = "google_sheet";
      else if (file.mimeType === "application/vnd.google-apps.presentation") sourceType = "google_slide";
      else if (file.mimeType === "application/pdf") sourceType = "pdf";

      const vaultDoc = await db.createDocument({
        title: input.title || file.name,
        sourceType,
        googleFileId: file.id,
        googleMimeType: file.mimeType,
        collection: input.collection,
        category: input.category,
        status: "active",
        visibility: "organization",
        ownerId: ctx.user.id,
        fileSize: file.size ? parseInt(file.size) : undefined,
        googleModifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : undefined,
      });

      if (vaultDoc && input.entityLinks) {
        for (const link of input.entityLinks) {
          await db.addDocumentEntityLink({ documentId: vaultDoc.id!, entityType: link.entityType, entityId: link.entityId, linkType: link.linkType });
        }
      }

      await db.logActivity({
        userId: ctx.user.id,
        action: "document_imported_from_drive",
        entityType: "document",
        entityId: String(vaultDoc?.id),
        entityName: input.title || file.name,
        details: JSON.stringify({ googleFileId: file.id, mimeType: file.mimeType }),
      });

      return vaultDoc;
    }),

  // Batch scan & import from shared drive
  batchImportSharedDrive: protectedProcedure
    .input(z.object({
      driveId: z.string(),
      driveName: z.string().default("OMNISCOPE"),
    }))
    .mutation(async ({ input, ctx }) => {
      const { invokeLLM } = await import("./_core/llm");
      
      // Step 1: Recursively scan all files
      console.log(`[Batch Import] Starting scan of shared drive: ${input.driveName}`);
      const allFiles = await googleDrive.scanDriveRecursive(ctx.user.id, undefined, input.driveId);
      console.log(`[Batch Import] Found ${allFiles.length} files`);

      // Step 2: Get existing contacts and companies for matching
      const existingCompanies = await db.getAllCompanies();
      const existingContacts = await db.getAllContacts();
      const companyNames = (Array.isArray(existingCompanies) ? existingCompanies : []).map((c: any) => ({ id: c.id, name: c.name }));
      const contactNames = (Array.isArray(existingContacts) ? existingContacts : []).map((c: any) => ({ id: c.id, name: c.name, company: c.organization || "" }));

      // Step 3: Check which files are already imported
      const existingDocs = await db.listDocuments({ limit: 1000 });
      const importedGoogleIds = new Set(existingDocs.items.filter((d: any) => d.googleFileId).map((d: any) => d.googleFileId));

      const results: Array<{ fileName: string; status: string; docId?: number; category?: string; entities?: string[] }> = [];
      let imported = 0;
      let skipped = 0;

      for (const file of allFiles) {
        // Skip already imported files
        if (importedGoogleIds.has(file.id)) {
          results.push({ fileName: file.name, status: "already_imported" });
          skipped++;
          continue;
        }

        // Skip non-document types
        const isDoc = file.mimeType === "application/vnd.google-apps.document";
        const isSheet = file.mimeType === "application/vnd.google-apps.spreadsheet";
        const isSlide = file.mimeType === "application/vnd.google-apps.presentation";
        const isPdf = file.mimeType === "application/pdf";
        const isDocx = file.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        const isXlsx = file.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

        if (!isDoc && !isSheet && !isSlide && !isPdf && !isDocx && !isXlsx) {
          results.push({ fileName: file.name, status: "skipped_unsupported_type" });
          skipped++;
          continue;
        }

        try {
          // Read content for AI analysis (Google Docs only for now)
          let textContent = "";
          if (isDoc) {
            try {
              textContent = await googleDrive.readGoogleDocText(ctx.user.id, file.id) || "";
            } catch { textContent = ""; }
          }

          // AI categorization
          let category = "other";
          let subcategory = "";
          let collection: "company_repo" | "personal" | "counterparty" | "template" | "transaction" | "signed" = "company_repo";
          let matchedEntities: Array<{ type: "company" | "contact"; id: number; name: string }> = [];
          let aiSummary = "";

          const folderContext = file.folderPath || "root";
          const fileName = file.name;

          try {
            const aiResponse = await invokeLLM({
              messages: [
                {
                  role: "system",
                  content: `You are a document categorization AI for OmniScope, a private financial infrastructure platform. Analyze the document and return JSON.

Existing companies: ${JSON.stringify(companyNames.slice(0, 50))}
Existing contacts: ${JSON.stringify(contactNames.slice(0, 50))}

Categories: agreement, compliance, intake, profile, strategy, operations, transaction, correspondence, template, other
Collections: company_repo (internal company docs), counterparty (client/partner docs), template (reusable templates), transaction (deal-specific), signed (executed docs), personal

Common document types:
- NCNDA = Non-Circumvention Non-Disclosure Agreement → category: agreement, subcategory: NCNDA
- KYB/KYC = Know Your Business/Customer → category: compliance
- SPPP = Specific Performance Purchase Program → category: agreement, subcategory: SPPP
- LOI = Letter of Intent → category: agreement, subcategory: LOI
- MOU = Memorandum of Understanding → category: agreement, subcategory: MOU
- POF = Proof of Funds → category: compliance, subcategory: POF
- BCL = Bank Comfort Letter → category: compliance, subcategory: BCL
- SOP = Standard Operating Procedure → category: operations, subcategory: SOP
- Invoice/Receipt → category: transaction
- Pitch deck/Presentation → category: strategy

Return JSON with: category, subcategory, collection, summary (2 sentences), matchedCompanies (array of company IDs from the list), matchedContacts (array of contact IDs from the list), newEntities (array of {type, name} for entities not in existing lists that should be created).`,
                },
                {
                  role: "user",
                  content: `File: "${fileName}"
Folder path: ${folderContext}
MIME type: ${file.mimeType}
${textContent ? `Content preview (first 2000 chars):\n${textContent.substring(0, 2000)}` : "No text content available - categorize based on filename and folder."}`,
                },
              ],
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "doc_categorization",
                  strict: true,
                  schema: {
                    type: "object",
                    properties: {
                      category: { type: "string" },
                      subcategory: { type: "string" },
                      collection: { type: "string" },
                      summary: { type: "string" },
                      matchedCompanies: { type: "array", items: { type: "number" } },
                      matchedContacts: { type: "array", items: { type: "number" } },
                      newEntities: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            type: { type: "string" },
                            name: { type: "string" },
                          },
                          required: ["type", "name"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["category", "subcategory", "collection", "summary", "matchedCompanies", "matchedContacts", "newEntities"],
                    additionalProperties: false,
                  },
                },
              },
            });

            const parsed = JSON.parse(aiResponse.choices?.[0]?.message?.content || "{}");
            category = parsed.category || "other";
            subcategory = parsed.subcategory || "";
            collection = (["company_repo", "personal", "counterparty", "template", "transaction", "signed"].includes(parsed.collection) ? parsed.collection : "company_repo") as any;
            aiSummary = parsed.summary || "";

            // Match existing entities
            for (const compId of (parsed.matchedCompanies || [])) {
              const comp = companyNames.find((c: any) => c.id === compId);
              if (comp) matchedEntities.push({ type: "company", id: comp.id, name: comp.name });
            }
            for (const contId of (parsed.matchedContacts || [])) {
              const cont = contactNames.find((c: any) => c.id === contId);
              if (cont) matchedEntities.push({ type: "contact", id: cont.id, name: cont.name });
            }

            // Create new entities if needed
            for (const newEnt of (parsed.newEntities || [])) {
              if (newEnt.type === "company" && newEnt.name) {
                // Check if already exists
                const exists = companyNames.find((c: any) => c.name.toLowerCase() === newEnt.name.toLowerCase());
                if (!exists) {
                  const newComp = await db.createCompany({ name: newEnt.name, status: "prospect" });
                  if (newComp) {
                    companyNames.push({ id: newComp.id!, name: newEnt.name });
                    matchedEntities.push({ type: "company", id: newComp.id!, name: newEnt.name });
                  }
                } else {
                  matchedEntities.push({ type: "company", id: exists.id, name: exists.name });
                }
              } else if (newEnt.type === "contact" && newEnt.name) {
                const exists = contactNames.find((c: any) => c.name.toLowerCase() === newEnt.name.toLowerCase());
                if (!exists) {
                  const newCont = await db.createContact({ name: newEnt.name });
                  if (newCont) {
                    contactNames.push({ id: newCont.id!, name: newEnt.name, company: "" });
                    matchedEntities.push({ type: "contact", id: newCont.id!, name: newEnt.name });
                  }
                } else {
                  matchedEntities.push({ type: "contact", id: exists.id, name: exists.name });
                }
              }
            }
          } catch (aiErr: any) {
            console.error(`[Batch Import] AI categorization failed for ${fileName}:`, aiErr.message);
            // Fallback: use folder name for categorization
            const folderLower = folderContext.toLowerCase();
            if (folderLower.includes("kyb") || folderLower.includes("kyc") || folderLower.includes("compliance")) {
              category = "compliance";
            } else if (folderLower.includes("transaction") || folderLower.includes("otc")) {
              category = "transaction";
              collection = "transaction";
            } else if (folderLower.includes("signed")) {
              category = "agreement";
              collection = "signed";
            }
          }

          // Determine source type
          let sourceType: "google_doc" | "google_sheet" | "google_slide" | "pdf" | "uploaded" = "uploaded";
          if (isDoc) sourceType = "google_doc";
          else if (isSheet) sourceType = "google_sheet";
          else if (isSlide) sourceType = "google_slide";
          else if (isPdf) sourceType = "pdf";

          // Create vault document
          const vaultDoc = await db.createDocument({
            title: fileName,
            sourceType,
            googleFileId: file.id,
            googleMimeType: file.mimeType,
            collection,
            category: category as any,
            subcategory,
            status: "active",
            visibility: "organization",
            ownerId: ctx.user.id,
            aiSummary: aiSummary || undefined,
            fileSize: file.size ? parseInt(file.size) : undefined,
          });

          // Add entity links
          if (vaultDoc) {
            for (const entity of matchedEntities) {
              await db.addDocumentEntityLink({
                documentId: vaultDoc.id!,
                entityType: entity.type,
                entityId: entity.id,
                linkType: "primary",
              });
            }
          }

          imported++;
          results.push({
            fileName,
            status: "imported",
            docId: vaultDoc?.id || undefined,
            category,
            entities: matchedEntities.map(e => `${e.type}:${e.name}`),
          });

          console.log(`[Batch Import] Imported: ${fileName} → ${category} (${matchedEntities.length} entities)`);
        } catch (err: any) {
          console.error(`[Batch Import] Failed to import ${file.name}:`, err.message);
          results.push({ fileName: file.name, status: "error", category: err.message });
        }
      }

      // Log activity
      await db.logActivity({
        userId: ctx.user.id,
        action: "batch_import_shared_drive",
        entityType: "document",
        entityId: input.driveId,
        entityName: input.driveName,
        details: JSON.stringify({ totalFiles: allFiles.length, imported, skipped }),
      });

      console.log(`[Batch Import] Complete: ${imported} imported, ${skipped} skipped out of ${allFiles.length} total`);

       return {
        totalScanned: allFiles.length,
        imported,
        skipped,
        results,
      };
    }),

  // Copy individual files from Drive to a Vault folder
  copyToVault: protectedProcedure
    .input(z.object({
      files: z.array(z.object({
        googleFileId: z.string(),
        name: z.string(),
        mimeType: z.string(),
        size: z.number().optional(),
      })),
      folderId: z.number().nullable(),
      collection: z.enum(["company_repo", "personal", "counterparty", "template", "transaction", "signed"]).default("company_repo"),
    }))
    .mutation(async ({ input, ctx }) => {
      const results: Array<{ name: string; success: boolean; documentId?: number; error?: string }> = [];
      for (const file of input.files) {
        try {
          // Check if already imported
          const existing = await db.listDocuments({ search: file.name, limit: 1 });
          if (existing.items.some((d: any) => d.googleFileId === file.googleFileId)) {
            results.push({ name: file.name, success: true, error: 'Already exists' });
            continue;
          }
          // Determine source type
          let sourceType: 'google_doc' | 'google_sheet' | 'google_slide' | 'pdf' | 'uploaded' = 'uploaded';
          if (file.mimeType === 'application/vnd.google-apps.document') sourceType = 'google_doc';
          else if (file.mimeType === 'application/vnd.google-apps.spreadsheet') sourceType = 'google_sheet';
          else if (file.mimeType === 'application/vnd.google-apps.presentation') sourceType = 'google_slide';
          else if (file.mimeType === 'application/pdf') sourceType = 'pdf';

          const doc = await db.createDocument({
            title: file.name,
            sourceType,
            googleFileId: file.googleFileId,
            googleMimeType: file.mimeType,
            collection: input.collection,
            category: 'other',
            status: 'active',
            visibility: 'organization',
            folderId: input.folderId,
            ownerId: ctx.user!.id,
            fileSize: file.size ?? null,
          });
          results.push({ name: file.name, success: true, documentId: doc?.id });
        } catch (e: any) {
          results.push({ name: file.name, success: false, error: e.message });
        }
      }
      return { imported: results.filter(r => r.success && !r.error).length, skipped: results.filter(r => r.error === 'Already exists').length, failed: results.filter(r => !r.success).length, results };
    }),
});
// ============================================================================
// TEMPLATE ENGINE ROUTER
// ============================================================================

const templateRouter = router({
  list: protectedProcedure
    .input(z.object({
      category: z.string().optional(),
      isActive: z.boolean().optional(),
    }).optional())
    .query(async ({ input }) => {
      return db.listTemplates(input || undefined);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const template = await db.getTemplateById(input.id);
      if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      return template;
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      category: z.enum(["agreement", "compliance", "intake", "profile", "other"]).default("agreement"),
      subcategory: z.string().optional(),
      googleFileId: z.string().optional(),
      s3Url: z.string().optional(),
      mergeFieldSchema: z.string().optional(), // JSON string
      defaultRecipientRoles: z.string().optional(), // JSON string
    }))
    .mutation(async ({ input, ctx }) => {
      return db.createTemplate({ ...input, createdBy: ctx.user!.id });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      category: z.enum(["agreement", "compliance", "intake", "profile", "other"]).optional(),
      subcategory: z.string().optional(),
      mergeFieldSchema: z.string().optional(),
      defaultRecipientRoles: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return db.updateTemplate(id, data);
    }),

  // Generate a document from a template with merge fields
  generate: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      mergeFields: z.record(z.string()), // { "{{client_name}}": "Wintermute", ... }
      title: z.string(), // generated document title
      entityLinks: z.array(z.object({
        entityType: z.enum(["company", "contact", "meeting"]),
        entityId: z.number(),
        linkType: z.enum(["primary", "related", "mentioned", "generated_for", "signed_by"]).default("generated_for"),
      })).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const template = await db.getTemplateById(input.templateId);
      if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });

      // Create document record
      const doc = await db.createDocument({
        title: input.title,
        sourceType: "generated",
        collection: "counterparty",
        category: template.category as any,
        subcategory: template.subcategory || undefined,
        status: "draft",
        visibility: "organization",
        ownerId: ctx.user!.id,
        isTemplate: false,
      });
      if (!doc) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create document" });

      // Add entity links
      if (input.entityLinks) {
        for (const link of input.entityLinks) {
          await db.addDocumentEntityLink({ documentId: doc.id!, entityType: link.entityType, entityId: link.entityId, linkType: link.linkType });
        }
      }

      // Increment template usage
      await db.incrementTemplateUsage(input.templateId);

      // Log activity
      await db.logActivity({
        userId: ctx.user!.id,
        action: "document_generated",
        entityType: "document",
        entityId: String(doc.id),
        entityName: input.title,
        details: JSON.stringify({ templateId: input.templateId, templateName: template.name }),
      });

      return doc;
    }),
});

// ============================================================================
// E-SIGNATURE ROUTER
// ============================================================================

const signingRouter = router({
  // Provider management
  listProviders: protectedProcedure
    .query(async () => {
      const configured = await db.listSigningProviders();
      const allAdapters = getAdapterInfo();
      return { configured, available: allAdapters };
    }),

  configureProvider: protectedProcedure
    .input(z.object({
      provider: z.enum(["firma", "signatureapi", "docuseal", "pandadocs", "docusign", "boldsign", "esignly"]),
      displayName: z.string(),
      apiKey: z.string(),
      apiSecret: z.string().optional(),
      baseUrl: z.string().optional(),
      webhookSecret: z.string().optional(),
      config: z.string().optional(), // JSON
      isDefault: z.boolean().default(false),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      return db.upsertSigningProvider({ ...input, createdBy: ctx.user!.id });
    }),

  removeProvider: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return db.deleteSigningProvider(input.id);
    }),

  // Envelope operations
  listEnvelopes: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      documentId: z.number().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ input }) => {
      return db.listSigningEnvelopes(input || undefined);
    }),

  getEnvelope: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const envelope = await db.getSigningEnvelopeById(input.id);
      if (!envelope) throw new TRPCError({ code: "NOT_FOUND", message: "Envelope not found" });
      return envelope;
    }),

  sendForSignature: protectedProcedure
    .input(z.object({
      documentId: z.number(),
      providerId: z.number().optional(), // uses default if not specified
      recipients: z.array(z.object({
        name: z.string(),
        email: z.string(),
        role: z.string().default("signer"),
        order: z.number().optional(),
      })),
      subject: z.string().optional(),
      message: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Get the document
      const doc = await db.getDocumentById(input.documentId);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });

      // Get the signing provider
      let provider;
      if (input.providerId) {
        provider = await db.getSigningProviderById(input.providerId);
      } else {
        provider = await db.getDefaultSigningProvider();
      }
      if (!provider) throw new TRPCError({ code: "BAD_REQUEST", message: "No signing provider configured. Please set up a provider in Settings." });
      if (!provider.isActive) throw new TRPCError({ code: "BAD_REQUEST", message: "Selected signing provider is not active." });

      // Get the adapter
      const adapter = getSigningAdapter(provider.provider);
      if (!adapter) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `No adapter found for provider: ${provider.provider}` });

      // Build config
      const config: ProviderConfig = {
        apiKey: provider.apiKey || "",
        apiSecret: provider.apiSecret || undefined,
        baseUrl: provider.baseUrl || undefined,
        webhookSecret: provider.webhookSecret || undefined,
        extra: provider.config ? JSON.parse(provider.config) : undefined,
      };

      // Get document URL
      const documentUrl = doc.s3Url || "";
      if (!documentUrl) throw new TRPCError({ code: "BAD_REQUEST", message: "Document has no accessible URL for signing." });

      // Create envelope via provider
      const result = await adapter.createEnvelope({
        documentUrl,
        documentName: doc.title,
        recipients: input.recipients,
        subject: input.subject,
        message: input.message,
      }, config);

      // Save envelope record
      const envelope = await db.createSigningEnvelope({
        documentId: input.documentId,
        providerId: provider.id,
        providerEnvelopeId: result.providerEnvelopeId,
        status: result.status,
        recipients: JSON.stringify(result.recipients),
        sentAt: new Date(),
        createdBy: ctx.user!.id,
        metadata: JSON.stringify(result.rawResponse),
      });

      // Update document status
      await db.updateDocument(input.documentId, { status: "sent" });

      // Log activity
      await db.logActivity({
        userId: ctx.user!.id,
        action: "document_sent_for_signature",
        entityType: "document",
        entityId: String(input.documentId),
        entityName: doc.title,
        details: JSON.stringify({
          provider: provider.provider,
          recipients: input.recipients.map(r => r.email),
          envelopeId: envelope?.id,
        }),
      });

      return envelope;
    }),

  voidEnvelope: protectedProcedure
    .input(z.object({ id: z.number(), reason: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const envelope = await db.getSigningEnvelopeById(input.id);
      if (!envelope) throw new TRPCError({ code: "NOT_FOUND" });
      const provider = await db.getSigningProviderById(envelope.providerId);
      if (!provider) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const adapter = getSigningAdapter(provider.provider);
      if (!adapter) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const config: ProviderConfig = {
        apiKey: provider.apiKey || "",
        apiSecret: provider.apiSecret || undefined,
        baseUrl: provider.baseUrl || undefined,
      };
      const success = await adapter.voidEnvelope(envelope.providerEnvelopeId || "", input.reason, config);
      if (success) {
        await db.updateSigningEnvelope(input.id, { status: "voided" });
        await db.updateDocument(envelope.documentId, { status: "voided" });
      }
      return { success };
    }),

  refreshStatus: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const envelope = await db.getSigningEnvelopeById(input.id);
      if (!envelope) throw new TRPCError({ code: "NOT_FOUND" });
      const provider = await db.getSigningProviderById(envelope.providerId);
      if (!provider) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const adapter = getSigningAdapter(provider.provider);
      if (!adapter) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const config: ProviderConfig = {
        apiKey: provider.apiKey || "",
        apiSecret: provider.apiSecret || undefined,
        baseUrl: provider.baseUrl || undefined,
      };
      const result = await adapter.getStatus(envelope.providerEnvelopeId || "", config);
      await db.updateSigningEnvelope(input.id, {
        status: result.status,
        recipients: JSON.stringify(result.recipients),
        ...(result.status === "completed" ? { completedAt: new Date(), signedDocumentUrl: result.signedDocumentUrl } : {}),
      });
      if (result.status === "completed") {
        await db.updateDocument(envelope.documentId, { status: "signed" });
      }
      return result;
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
  employees: employeesRouter,
  payroll: payrollRouter,
  hrDocuments: hrDocumentsRouter,
  aiInsights: aiInsightsRouter,
  companies: companiesRouter,
  interactions: interactionsRouter,
  search: searchRouter,
  mail: mailRouter,
  onboarding: onboardingRouter,
  profile: profileRouter,
  directory: directoryRouter,
  triage: triageRouter,
  activityLog: activityLogRouter,
  dedup: dedupRouter,
  vault: vaultRouter,
  templates: templateRouter,
  signing: signingRouter,
  drive: driveRouter,
});

export type AppRouter = typeof appRouter;
