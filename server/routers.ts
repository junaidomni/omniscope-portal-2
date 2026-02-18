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
    .mutation(async ({ input }) => {
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
      // Delete the merged contact
      await db.deleteContact(input.mergeId);
      return { success: true };
    }),

  approve: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.updateContact(input.id, { approvalStatus: "approved" });
      return { success: true };
    }),

  reject: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.updateContact(input.id, { approvalStatus: "rejected" });
      return { success: true };
    }),

  bulkApprove: protectedProcedure
    .input(z.object({ ids: z.array(z.number()) }))
    .mutation(async ({ input }) => {
      for (const id of input.ids) {
        await db.updateContact(id, { approvalStatus: "approved" });
      }
      return { success: true, count: input.ids.length };
    }),

  bulkReject: protectedProcedure
    .input(z.object({ ids: z.array(z.number()) }))
    .mutation(async ({ input }) => {
      for (const id of input.ids) {
        await db.updateContact(id, { approvalStatus: "rejected" });
      }
      return { success: true, count: input.ids.length };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteContact(input.id);
      return { success: true };
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

      // Only update fields that are currently empty and AI found something
      const updates: any = {};
      if (!contact.email && extracted.email) updates.email = extracted.email;
      if (!contact.phone && extracted.phone) updates.phone = extracted.phone;
      if (!contact.organization && extracted.organization) updates.organization = extracted.organization;
      if (!contact.title && extracted.title) updates.title = extracted.title;
      if (!contact.website && extracted.website) updates.website = extracted.website;
      if (!contact.linkedin && extracted.linkedin) updates.linkedin = extracted.linkedin;
      if (!contact.address && extracted.address) updates.address = extracted.address;

      // If employee is linked, sync employee data to contact
      if (employee) {
        if (!contact.email && employee.email) updates.email = employee.email;
        if (!contact.phone && employee.phone) updates.phone = employee.phone;
        if (!contact.address && employee.address) updates.address = employee.address;
      }

      if (Object.keys(updates).length > 0) {
        await db.updateContact(input.id, updates);
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
    .mutation(async ({ input }) => {
      await db.updateCompany(input.id, { approvalStatus: "approved" });
      return { success: true };
    }),

  reject: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.updateCompany(input.id, { approvalStatus: "rejected" });
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
    .input(z.object({ origin: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const url = getGoogleAuthUrl(input.origin, ctx.user.id);
      return { url };
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
});

export type AppRouter = typeof appRouter;
