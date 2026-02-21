import * as db from "../db";
import { invokeLLM } from "../_core/llm";
import { orgScopedProcedure, router } from "../_core/trpc";

export const aiInsightsRouter = router({
  followUpReminders: orgScopedProcedure.query(async ({ ctx }) => {
    const contacts = await db.getAllContacts(ctx.orgId);
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

  upcomingBirthdays: orgScopedProcedure.query(async ({ ctx }) => {
    const contacts = await db.getAllContacts(ctx.orgId);
    const employees = await db.getAllEmployees({ orgId: ctx.orgId ?? undefined });
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

  dailyBriefing: orgScopedProcedure.query(async ({ ctx }) => {
    const { invokeLLM } = await import("../_core/llm");
    
    // Gather data for AI analysis
    const allContacts = await db.getAllContacts(ctx.orgId);
    const allTasks = await db.getAllTasks({ orgId: ctx.orgId ?? undefined });
    const recentMeetings = await db.getAllMeetings({ limit: 20, orgId: ctx.orgId ?? undefined });
    const allEmployees = await db.getAllEmployees({ orgId: ctx.orgId ?? undefined });
    
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
