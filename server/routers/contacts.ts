import * as db from "../db";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "../_core/llm";
import { orgScopedProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import { z } from "zod";

export const contactsRouter = router({
  list: orgScopedProcedure.query(async ({ ctx }) => {
    const allContacts = await db.getContactsWithCompany(ctx.orgId);
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

  searchByName: orgScopedProcedure
    .input(z.object({ query: z.string().min(1), limit: z.number().min(1).max(50).default(10) }))
    .query(async ({ input, ctx }) => {
      const allContacts = await db.getAllContacts(ctx.orgId);
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

  getById: orgScopedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const { verifyEntityOwnership } = await import("../entitySecurity");
      const exists = await verifyEntityOwnership("contact", input.id, ctx.orgId);
      if (!exists) throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });
      const contact = await db.getContactById(input.id);
      if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });
      return contact;
    }),

  getProfile: orgScopedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const profile = await db.getContactProfile(input.id);
      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });
      return profile;
    }),

  getMeetings: orgScopedProcedure
    .input(z.object({ contactId: z.number() }))
    .query(async ({ ctx, input }) => {
      return await db.getMeetingsForContact(input.contactId);
    }),

  search: orgScopedProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ input, ctx }) => {
      return await db.searchContacts(input.query, ctx.orgId ?? undefined);
    }),

  create: orgScopedProcedure
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
    .mutation(async ({ input, ctx }) => {
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
        orgId: ctx.orgId ?? undefined,
      });
      return { id };
    }),

  update: orgScopedProcedure
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
    .mutation(async ({ input, ctx }) => {
      const { verifyEntityOwnership } = await import("../entitySecurity");
      const exists = await verifyEntityOwnership("contact", input.id, ctx.orgId);
      if (!exists) throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });
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

  toggleStar: orgScopedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { verifyEntityOwnership } = await import("../entitySecurity");
      const exists = await verifyEntityOwnership("contact", input.id, ctx.orgId);
      if (!exists) throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });
      const contact = await db.getContactById(input.id);
      if (!contact) throw new TRPCError({ code: "NOT_FOUND" });
      await db.updateContact(input.id, { starred: !contact.starred });
      return { starred: !contact.starred };
    }),

  getNotes: orgScopedProcedure
    .input(z.object({ contactId: z.number() }))
    .query(async ({ ctx, input }) => {
      return await db.getNotesForContact(input.contactId);
    }),

  addNote: orgScopedProcedure
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

  deleteNote: orgScopedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteContactNote(input.id);
      return { success: true };
    }),

  checkDuplicates: orgScopedProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ input, ctx }) => {
      const allContacts = await db.getAllContacts(ctx.orgId);
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

  mergeContacts: orgScopedProcedure
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

  approve: orgScopedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const contact = await db.getContactById(input.id);
      await db.updateContact(input.id, { approvalStatus: "approved" });
      await db.logActivity({ userId: ctx.user.id, action: "approve_contact", entityType: "contact", entityId: String(input.id), entityName: contact?.name || "Unknown" });
      return { success: true };
    }),

  reject: orgScopedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const contact = await db.getContactById(input.id);
      await db.updateContact(input.id, { approvalStatus: "rejected" });
      await db.logActivity({ userId: ctx.user.id, action: "reject_contact", entityType: "contact", entityId: String(input.id), entityName: contact?.name || "Unknown" });
      return { success: true };
    }),

  bulkApprove: orgScopedProcedure
    .input(z.object({ ids: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      for (const id of input.ids) {
        await db.updateContact(id, { approvalStatus: "approved" });
      }
      await db.logActivity({ userId: ctx.user.id, action: "bulk_approve_contacts", entityType: "contact", entityId: input.ids.join(","), details: `Bulk approved ${input.ids.length} contacts` });
      return { success: true, count: input.ids.length };
    }),

  bulkReject: orgScopedProcedure
    .input(z.object({ ids: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      for (const id of input.ids) {
        await db.updateContact(id, { approvalStatus: "rejected" });
      }
      await db.logActivity({ userId: ctx.user.id, action: "bulk_reject_contacts", entityType: "contact", entityId: input.ids.join(","), details: `Bulk rejected ${input.ids.length} contacts` });
      return { success: true, count: input.ids.length };
    }),

  delete: orgScopedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteContact(input.id);
      return { success: true };
    }),

  // ========== PENDING SUGGESTIONS ==========

  pendingSuggestions: orgScopedProcedure
    .input(z.object({ type: z.string().optional(), status: z.string().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const suggestions = await db.getPendingSuggestions({ orgId: ctx.orgId ?? undefined,
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

  pendingSuggestionsCount: orgScopedProcedure
    .query(async ({ ctx }) => {
      return await db.getPendingSuggestionsCount(ctx.orgId);
    }),

  approveSuggestion: orgScopedProcedure
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

  rejectSuggestion: orgScopedProcedure
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

  bulkApproveSuggestions: orgScopedProcedure
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

  bulkRejectSuggestions: orgScopedProcedure
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

  syncFromMeetings: orgScopedProcedure
    .mutation(async ({ ctx }) => {
      const allMeetings = await db.getAllMeetings({ limit: 500, orgId: ctx.orgId ?? undefined });
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

  detectDuplicates: orgScopedProcedure
    .query(async ({ ctx }) => {
      const contacts = await db.getAllContacts(ctx.orgId);
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

  generateAiSummary: orgScopedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const contact = await db.getContactById(input.id);
      if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });

      const contactMeetings = await db.getMeetingsForContact(input.id);
      
      // Also check meetings by participant name
      const allMeetings = await db.getAllMeetings({ limit: 500, orgId: ctx.orgId ?? undefined });
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

      const contactTasks = await db.getTasksForContact(contact.name, ctx.orgId ?? undefined);
      const taskSummary = contactTasks.slice(0, 10).map(t => 
        `- [${t.status}] ${t.title}`
      ).join('\n');

      const { invokeLLM } = await import("../_core/llm");
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
  enrichWithAI: orgScopedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const contact = await db.getContactById(input.id);
      if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });

      // Get all meetings involving this contact
      const contactMeetings = await db.getMeetingsForContact(input.id);
      const allMeetings = await db.getAllMeetings({ limit: 500, orgId: ctx.orgId ?? undefined });
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

      const { invokeLLM } = await import("../_core/llm");
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
  enrichAllWithAI: orgScopedProcedure
    .mutation(async ({ ctx }) => {
      const allContacts = await db.getAllContacts(ctx.orgId);
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
  linkEmployee: orgScopedProcedure
    .input(z.object({ contactId: z.number(), employeeId: z.number() }))
    .mutation(async ({ ctx, input }) => {
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
  autoLinkEmployees: orgScopedProcedure
    .mutation(async ({ ctx }) => {
      const allEmployees = await db.getAllEmployees({ orgId: ctx.orgId ?? undefined });
      const allContacts = await db.getAllContacts(ctx.orgId);
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
  getDocuments: orgScopedProcedure
    .input(z.object({ contactId: z.number(), category: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return await db.getDocumentsForContact(input.contactId, input.category);
    }),

  uploadDocument: orgScopedProcedure
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

  deleteDocument: orgScopedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteContactDocument(input.id);
      return { success: true };
    }),

  // Get linked employee for a contact
  getLinkedEmployee: orgScopedProcedure
    .input(z.object({ contactId: z.number() }))
    .query(async ({ ctx, input }) => {
      return await db.getEmployeeByContactId(input.contactId);
    }),

  // ========== ALIASES ==========
  getAliases: orgScopedProcedure
    .input(z.object({ contactId: z.number() }))
    .query(async ({ ctx, input }) => {
      return await db.getAliasesForContact(ctx.user!.id, input.contactId);
    }),

  addAlias: orgScopedProcedure
    .input(z.object({ contactId: z.number(), aliasName: z.string().min(1), aliasEmail: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const result = await db.saveContactAlias(ctx.user!.id, input.contactId, input.aliasName, input.aliasEmail, "manual");
      const contact = await db.getContactById(input.contactId);
      await db.logActivity({ userId: ctx.user!.id, action: "add_contact_alias", entityType: "contact", entityId: String(input.contactId), entityName: contact?.name || "Unknown", details: `Added alias "${input.aliasName}"` });
      return result;
    }),

  removeAlias: orgScopedProcedure
    .input(z.object({ aliasId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return await db.deleteContactAlias(input.aliasId);
    }),
});
