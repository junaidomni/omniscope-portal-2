import * as db from "../db";
import * as gmailService from "../gmailService";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "../_core/llm";
import { orgScopedProcedure, router } from "../_core/trpc";
import { z } from "zod";

export const triageRouter = router({
  feed: orgScopedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const userName = ctx.user.name || 'there';
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    // 1. Overdue tasks
    const allTasks = await db.getAllTasks({ orgId: ctx.orgId ?? undefined });
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
    const allContacts = await db.getAllContacts(ctx.orgId);
    const pendingContacts = allContacts.filter(c => c.approvalStatus === 'pending').slice(0, 10);

    // 6. Pending company approvals
    const allCompanies = await db.getAllCompanies(ctx.orgId);
    const pendingCompanies = allCompanies.filter(c => c.approvalStatus === 'pending').slice(0, 10);

    // 7. Recent meetings (last 7 days)
    const sevenDaysAgo = new Date(startOfToday);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentMeetings = await db.getAllMeetings({ startDate: sevenDaysAgo, endDate: endOfToday, limit: 6, orgId: ctx.orgId ?? undefined });

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
    const allSuggestions = await db.getPendingSuggestions({ status: "pending", orgId: ctx.orgId ?? undefined });
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

    const totalPendingApprovals = pendingContacts.length + pendingCompanies.length;

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
  completeTask: orgScopedProcedure
    .input(z.object({ taskId: z.number() }))
    .mutation(async ({ input }) => {
      await db.updateTask(input.taskId, { status: 'completed' });
      return { success: true };
    }),

  // Dismiss a task (snooze by pushing due date forward)
  snoozeTask: orgScopedProcedure
    .input(z.object({ taskId: z.number(), days: z.number().min(1).max(30).default(1) }))
    .mutation(async ({ input }) => {
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + input.days);
      await db.updateTask(input.taskId, { dueDate: newDate });
      return { success: true, newDueDate: newDate };
    }),

  // Delete a task from triage
  deleteTask: orgScopedProcedure
    .input(z.object({ taskId: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteTask(input.taskId);
      return { success: true };
    }),

  // Update a task from triage (inline edit)
  updateTask: orgScopedProcedure
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
    .mutation(async ({ ctx, input }) => {
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
  findDuplicatesFor: orgScopedProcedure
    .input(z.object({ contactId: z.number() }))
    .query(async ({ input, ctx }) => {
      const target = await db.getContactById(input.contactId);
      if (!target) throw new TRPCError({ code: 'NOT_FOUND' });
      const allContacts = await db.getAllContacts(ctx.orgId);
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
  mergeAndApprove: orgScopedProcedure
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
  approveContact: orgScopedProcedure
    .input(z.object({ contactId: z.number() }))
    .mutation(async ({ input }) => {
      await db.updateContact(input.contactId, { approvalStatus: 'approved' });
      return { success: true };
    }),

  // Reject a contact from triage
  rejectContact: orgScopedProcedure
    .input(z.object({ contactId: z.number() }))
    .mutation(async ({ input }) => {
      await db.updateContact(input.contactId, { approvalStatus: 'rejected' });
      return { success: true };
    }),

  // Approve a company from triage
  approveCompany: orgScopedProcedure
    .input(z.object({ companyId: z.number() }))
    .mutation(async ({ input }) => {
      await db.updateCompany(input.companyId, { approvalStatus: 'approved' });
      return { success: true };
    }),

  // Reject a company from triage
  rejectCompany: orgScopedProcedure
    .input(z.object({ companyId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.updateCompany(input.companyId, { approvalStatus: 'rejected' });
      return { success: true };
    }),

  // Merge a pending company into an existing approved company
  mergeCompany: orgScopedProcedure
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
      const allContacts = await db.getAllContacts(ctx.orgId);
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
  findCompanyDuplicatesFor: orgScopedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input, ctx }) => {
      const company = await db.getCompanyById(input.companyId);
      if (!company) return [];
      const allCompanies = await db.getAllCompanies(ctx.orgId);
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

  bulkApproveCompanies: orgScopedProcedure
    .input(z.object({ ids: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      for (const id of input.ids) {
        await db.updateCompany(id, { approvalStatus: 'approved' });
      }
      await db.logActivity({ userId: ctx.user.id, action: "bulk_approve_companies", entityType: "company", entityId: input.ids.join(","), details: `Bulk approved ${input.ids.length} companies` });
      return { approved: input.ids.length };
    }),

  bulkRejectCompanies: orgScopedProcedure
    .input(z.object({ ids: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      for (const id of input.ids) {
        await db.updateCompany(id, { approvalStatus: 'rejected' });
      }
      await db.logActivity({ userId: ctx.user.id, action: "bulk_reject_companies", entityType: "company", entityId: input.ids.join(","), details: `Bulk rejected ${input.ids.length} companies` });
      return { rejected: input.ids.length };
    }),

  // AI Strategic Insights — generates contextual recommendations
  strategicInsights: orgScopedProcedure.query(async ({ ctx }) => {
    const { invokeLLM } = await import('../_core/llm');
    const allTasks = await db.getAllTasks({ orgId: ctx.orgId ?? undefined });
    const allContacts = await db.getAllContacts(ctx.orgId);
    const allCompanies = await db.getAllCompanies(ctx.orgId);
    const recentMeetings = await db.getAllMeetings({ limit: 10, orgId: ctx.orgId ?? undefined });
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
