import * as db from "./db";

/**
 * Analytics helper functions for dashboard metrics
 * All functions accept optional orgId to scope data to a specific organization.
 */

export interface DashboardMetrics {
  meetingsToday: number;
  meetingsThisWeek: number;
  meetingsThisMonth: number;
  totalMeetings: number;
  uniqueParticipants: number;
  uniqueOrganizations: number;
  openTasks: number;
  completedTasksToday: number;
  topSectors: Array<{ sector: string; count: number }>;
  topJurisdictions: Array<{ jurisdiction: string; count: number }>;
  recentMeetings: Array<any>;
}

export async function getDashboardMetrics(orgId?: number | null): Promise<DashboardMetrics> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Get all meetings scoped to org
  const allMeetings = await db.getAllMeetings({ orgId: orgId ?? undefined });
  
  // Calculate metrics
  const meetingsToday = allMeetings.filter(m => 
    new Date(m.meetingDate) >= startOfToday
  ).length;
  
  const meetingsThisWeek = allMeetings.filter(m => 
    new Date(m.meetingDate) >= startOfWeek
  ).length;
  
  const meetingsThisMonth = allMeetings.filter(m => 
    new Date(m.meetingDate) >= startOfMonth
  ).length;

  // Get unique participants and organizations
  const allParticipants = new Set<string>();
  const allOrganizations = new Set<string>();
  
  allMeetings.forEach(meeting => {
    try {
      const participants = JSON.parse(meeting.participants || '[]');
      if (Array.isArray(participants)) {
        participants.forEach((p: string) => allParticipants.add(p));
      }
    } catch (e) { /* skip invalid JSON */ }
    
    try {
      const orgs = JSON.parse(meeting.organizations || '[]');
      if (Array.isArray(orgs)) {
        orgs.forEach((o: string) => allOrganizations.add(o));
      }
    } catch (e) { /* skip invalid JSON */ }
  });

  // Get task metrics scoped to org
  const allTasks = await db.getAllTasks({ orgId: orgId ?? undefined });
  const openTasks = allTasks.filter(t => t.status !== 'completed').length;
  const completedTasksToday = allTasks.filter(t => 
    t.status === 'completed' && 
    t.updatedAt && 
    new Date(t.updatedAt) >= startOfToday
  ).length;

  // Get top sectors and jurisdictions
  const sectorCounts: Record<string, number> = {};
  const jurisdictionCounts: Record<string, number> = {};
  
  for (const meeting of allMeetings) {
    const tags = await db.getTagsForMeeting(meeting.id);
    tags.forEach(item => {
      if (item.tag.type === 'sector') {
        sectorCounts[item.tag.name] = (sectorCounts[item.tag.name] || 0) + 1;
      } else if (item.tag.type === 'jurisdiction') {
        jurisdictionCounts[item.tag.name] = (jurisdictionCounts[item.tag.name] || 0) + 1;
      }
    });
  }

  const topSectors = Object.entries(sectorCounts)
    .map(([sector, count]) => ({ sector, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topJurisdictions = Object.entries(jurisdictionCounts)
    .map(([jurisdiction, count]) => ({ jurisdiction, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Get recent meetings (last 5)
  const recentMeetings = allMeetings
    .sort((a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime())
    .slice(0, 5);

  return {
    meetingsToday,
    meetingsThisWeek,
    meetingsThisMonth,
    totalMeetings: allMeetings.length,
    uniqueParticipants: allParticipants.size,
    uniqueOrganizations: allOrganizations.size,
    openTasks,
    completedTasksToday,
    topSectors,
    topJurisdictions,
    recentMeetings,
  };
}

export interface DailySummary {
  date: string;
  meetingCount: number;
  meetings: Array<{
    id: number;
    title: string;
    time: string;
    participants: string[];
    organizations: string[];
    summary: string;
    keyHighlights: string[];
    opportunities: string[];
    risks: string[];
    keyQuotes: string[];
    sourceType: string;
  }>;
  tasksCreated: number;
  tasksCompleted: number;
  openTasksCount: number;
  inProgressTasksCount: number;
  allTasks: Array<{
    id: number;
    title: string;
    description: string | null;
    priority: string;
    status: string;
    assignedName: string | null;
    category: string | null;
    dueDate: string | null;
    meetingId: number | null;
  }>;
  topSectors: string[];
  topJurisdictions: string[];
  allOpportunities: string[];
  allRisks: string[];
}

export async function getDailySummary(date: Date, orgId?: number | null): Promise<DailySummary> {
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const meetings = await db.getAllMeetings({
    startDate: startOfDay,
    endDate: endOfDay,
    orgId: orgId ?? undefined,
  });

  const allOpportunities: string[] = [];
  const allRisks: string[] = [];

  const meetingDetails = meetings.map(m => {
    const opps = JSON.parse(m.opportunities || '[]');
    const risks = JSON.parse(m.risks || '[]');
    allOpportunities.push(...opps);
    allRisks.push(...risks);
    const participants = JSON.parse(m.participants || '[]');
    return {
      id: m.id,
      title: m.meetingTitle || participants.join(', ') || 'Untitled Meeting',
      time: new Date(m.meetingDate).toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit' 
      }),
      participants,
      organizations: JSON.parse(m.organizations || '[]'),
      summary: m.executiveSummary,
      keyHighlights: JSON.parse(m.strategicHighlights || '[]'),
      opportunities: opps,
      risks,
      keyQuotes: JSON.parse(m.keyQuotes || '[]'),
      sourceType: m.sourceType,
    };
  });

  // Get ALL tasks scoped to org
  const allTasks = await db.getAllTasks({ orgId: orgId ?? undefined });
  const tasksCreated = allTasks.filter(t => 
    new Date(t.createdAt) >= startOfDay && 
    new Date(t.createdAt) < endOfDay
  ).length;
  
  const tasksCompleted = allTasks.filter(t => 
    t.status === 'completed' &&
    t.updatedAt &&
    new Date(t.updatedAt) >= startOfDay && 
    new Date(t.updatedAt) < endOfDay
  ).length;

  const openTasksCount = allTasks.filter(t => t.status === 'open').length;
  const inProgressTasksCount = allTasks.filter(t => t.status === 'in_progress').length;

  // Map all active tasks for the report
  const activeTasks = allTasks.filter(t => t.status !== 'completed').map(t => ({
    id: t.id,
    title: t.title,
    description: t.description,
    priority: t.priority,
    status: t.status,
    assignedName: t.assignedName,
    category: t.category,
    dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
    meetingId: t.meetingId,
  }));

  // Get top sectors/jurisdictions for the day
  const sectorSet = new Set<string>();
  const jurisdictionSet = new Set<string>();
  
  for (const meeting of meetings) {
    const tags = await db.getTagsForMeeting(meeting.id);
    tags.forEach(item => {
      if (item.tag.type === 'sector') sectorSet.add(item.tag.name);
      if (item.tag.type === 'jurisdiction') jurisdictionSet.add(item.tag.name);
    });
  }

  return {
    date: startOfDay.toISOString(),
    meetingCount: meetings.length,
    meetings: meetingDetails,
    tasksCreated,
    tasksCompleted,
    openTasksCount,
    inProgressTasksCount,
    allTasks: activeTasks,
    topSectors: Array.from(sectorSet),
    topJurisdictions: Array.from(jurisdictionSet),
    allOpportunities,
    allRisks,
  };
}

export interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  meetingCount: number;
  uniqueParticipants: number;
  uniqueOrganizations: number;
  tasksCreated: number;
  tasksCompleted: number;
  openTasksCount: number;
  inProgressTasksCount: number;
  topSectors: Array<{ sector: string; count: number }>;
  topJurisdictions: Array<{ jurisdiction: string; count: number }>;
  keyOpportunities: string[];
  keyRisks: string[];
  dailyBreakdown: Array<{ date: string; meetingCount: number }>;
  meetings: Array<{
    id: number;
    title: string;
    date: string;
    participants: string[];
    organizations: string[];
    summary: string;
    keyHighlights: string[];
    sourceType: string;
  }>;
  allTasks: Array<{
    id: number;
    title: string;
    description: string | null;
    priority: string;
    status: string;
    assignedName: string | null;
    category: string | null;
    dueDate: string | null;
    meetingId: number | null;
  }>;
}

export async function getWeeklySummary(weekStart: Date, orgId?: number | null): Promise<WeeklySummary> {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const meetings = await db.getAllMeetings({
    startDate: weekStart,
    endDate: weekEnd,
    orgId: orgId ?? undefined,
  });

  // Count unique participants and organizations
  const participantSet = new Set<string>();
  const organizationSet = new Set<string>();
  const allOpportunities: string[] = [];
  const allRisks: string[] = [];
  
  const meetingDetails = meetings.map(m => {
    let participants: string[] = [];
    let organizations: string[] = [];
    let opportunities: string[] = [];
    let risks: string[] = [];
    let keyHighlights: string[] = [];
    try {
      participants = JSON.parse(m.participants || '[]');
      if (!Array.isArray(participants)) participants = [];
      participants.forEach((p: string) => participantSet.add(p));
    } catch (e) { participants = []; }
    try {
      organizations = JSON.parse(m.organizations || '[]');
      if (!Array.isArray(organizations)) organizations = [];
      organizations.forEach((o: string) => organizationSet.add(o));
    } catch (e) { organizations = []; }
    try {
      opportunities = JSON.parse(m.opportunities || '[]');
      if (Array.isArray(opportunities)) allOpportunities.push(...opportunities);
    } catch (e) { /* skip */ }
    try {
      risks = JSON.parse(m.risks || '[]');
      if (Array.isArray(risks)) allRisks.push(...risks);
    } catch (e) { /* skip */ }
    try {
      keyHighlights = JSON.parse(m.strategicHighlights || '[]');
      if (!Array.isArray(keyHighlights)) keyHighlights = [];
    } catch (e) { keyHighlights = []; }
    return {
      id: m.id,
      title: m.meetingTitle || participants.join(', ') || 'Untitled Meeting',
      date: new Date(m.meetingDate).toISOString(),
      participants,
      organizations,
      summary: m.executiveSummary,
      keyHighlights,
      sourceType: m.sourceType,
    };
  });

  // Get tasks scoped to org
  const allTasks = await db.getAllTasks({ orgId: orgId ?? undefined });
  const tasksCreated = allTasks.filter(t => 
    new Date(t.createdAt) >= weekStart && 
    new Date(t.createdAt) < weekEnd
  ).length;
  
  const tasksCompleted = allTasks.filter(t => 
    t.status === 'completed' &&
    t.updatedAt &&
    new Date(t.updatedAt) >= weekStart && 
    new Date(t.updatedAt) < weekEnd
  ).length;

  // Get sector and jurisdiction counts
  const sectorCounts: Record<string, number> = {};
  const jurisdictionCounts: Record<string, number> = {};
  
  for (const meeting of meetings) {
    const tags = await db.getTagsForMeeting(meeting.id);
    tags.forEach(item => {
      if (item.tag.type === 'sector') {
        sectorCounts[item.tag.name] = (sectorCounts[item.tag.name] || 0) + 1;
      } else if (item.tag.type === 'jurisdiction') {
        jurisdictionCounts[item.tag.name] = (jurisdictionCounts[item.tag.name] || 0) + 1;
      }
    });
  }

  const topSectors = Object.entries(sectorCounts)
    .map(([sector, count]) => ({ sector, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topJurisdictions = Object.entries(jurisdictionCounts)
    .map(([jurisdiction, count]) => ({ jurisdiction, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Daily breakdown
  const dailyBreakdown = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + i);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);
    
    const dayMeetings = meetings.filter(m => {
      const mDate = new Date(m.meetingDate);
      return mDate >= day && mDate < nextDay;
    });
    
    dailyBreakdown.push({
      date: day.toISOString(),
      meetingCount: dayMeetings.length,
    });
  }

  const openTasksCount = allTasks.filter(t => t.status === 'open').length;
  const inProgressTasksCount = allTasks.filter(t => t.status === 'in_progress').length;

  const activeTasks = allTasks.filter(t => t.status !== 'completed').map(t => ({
    id: t.id,
    title: t.title,
    description: t.description,
    priority: t.priority,
    status: t.status,
    assignedName: t.assignedName,
    category: t.category,
    dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
    meetingId: t.meetingId,
  }));

  return {
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    meetingCount: meetings.length,
    uniqueParticipants: participantSet.size,
    uniqueOrganizations: organizationSet.size,
    tasksCreated,
    tasksCompleted,
    openTasksCount,
    inProgressTasksCount,
    topSectors,
    topJurisdictions,
    keyOpportunities: allOpportunities.slice(0, 10),
    keyRisks: allRisks.slice(0, 10),
    dailyBreakdown,
    meetings: meetingDetails,
    allTasks: activeTasks,
  };
}
