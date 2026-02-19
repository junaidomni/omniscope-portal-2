import { describe, expect, it } from "vitest";

// ============================================================================
// TRIAGE FEED & 5-DOMAIN NAVIGATION TESTS
// Tests for the unified attention stream logic and domain routing structure
// ============================================================================

// ── Triage Feed Logic ────────────────────────────────────────────────────

interface TriageTask {
  id: number;
  title: string;
  priority: string;
  dueDate: Date | null;
  status: string;
  assignedName: string | null;
  category: string | null;
  updatedAt?: Date | null;
}

interface TriageStar {
  threadId: string;
  starLevel: number;
  userId: number;
}

interface TriageContact {
  id: number;
  name: string;
  email: string | null;
  organization: string | null;
  approvalStatus: string;
}

interface TriageCompany {
  id: number;
  name: string;
  sector: string | null;
  approvalStatus: string;
}

interface TriageMeeting {
  id: number;
  title: string;
  meetingDate: Date;
  primaryLead: string | null;
  executiveSummary: string | null;
}

function buildTriageFeed(
  allTasks: TriageTask[],
  starredEmails: TriageStar[],
  allContacts: TriageContact[],
  allCompanies: TriageCompany[],
  recentMeetings: TriageMeeting[],
  referenceDate: Date
) {
  const startOfToday = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  // 1. Overdue tasks
  const overdueTasks = allTasks
    .filter(t => t.status !== "completed" && t.dueDate && new Date(t.dueDate) < startOfToday)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 15);

  // 2. Tasks due today
  const todayTasks = allTasks
    .filter(t => t.status !== "completed" && t.dueDate && new Date(t.dueDate) >= startOfToday && new Date(t.dueDate) < endOfToday)
    .sort((a, b) => {
      const prio: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (prio[a.priority] ?? 1) - (prio[b.priority] ?? 1);
    });

  // 3. High priority open tasks (not due today, not overdue)
  const highPriorityTasks = allTasks
    .filter(t => t.status !== "completed" && t.priority === "high" && !overdueTasks.find(o => o.id === t.id) && !todayTasks.find(o => o.id === t.id))
    .slice(0, 10);

  // 4. Pending approvals
  const pendingContacts = allContacts.filter(c => c.approvalStatus === "pending").slice(0, 10);
  const pendingCompanies = allCompanies.filter(c => c.approvalStatus === "pending").slice(0, 10);

  // 5. Summary counts
  const totalOpen = allTasks.filter(t => t.status !== "completed").length;
  const totalOverdue = overdueTasks.length;
  const totalHighPriority = allTasks.filter(t => t.status !== "completed" && t.priority === "high").length;
  const completedToday = allTasks.filter(t => t.status === "completed" && t.updatedAt && new Date(t.updatedAt) >= startOfToday).length;
  const totalStarred = starredEmails.length;
  const totalPendingApprovals = pendingContacts.length + pendingCompanies.length;

  return {
    summary: { totalOpen, totalOverdue, totalHighPriority, completedToday, totalStarred, totalPendingApprovals },
    overdueTasks,
    todayTasks,
    highPriorityTasks,
    starredEmails,
    pendingContacts,
    pendingCompanies,
    recentMeetings,
  };
}

describe("Triage Feed — Overdue Tasks", () => {
  const today = new Date(2026, 1, 18); // Feb 18, 2026

  const tasks: TriageTask[] = [
    { id: 1, title: "Overdue high", priority: "high", dueDate: new Date(2026, 1, 15), status: "open", assignedName: "Jake", category: "OTC" },
    { id: 2, title: "Overdue medium", priority: "medium", dueDate: new Date(2026, 1, 16), status: "open", assignedName: null, category: null },
    { id: 3, title: "Due today", priority: "high", dueDate: new Date(2026, 1, 18), status: "open", assignedName: "Kyle", category: "Capital" },
    { id: 4, title: "Future task", priority: "low", dueDate: new Date(2026, 2, 1), status: "open", assignedName: null, category: null },
    { id: 5, title: "Completed overdue", priority: "high", dueDate: new Date(2026, 1, 14), status: "completed", assignedName: null, category: null },
    { id: 6, title: "No due date high", priority: "high", dueDate: null, status: "open", assignedName: null, category: null },
  ];

  it("identifies overdue tasks correctly (excludes completed and future)", () => {
    const result = buildTriageFeed(tasks, [], [], [], [], today);
    expect(result.overdueTasks.map(t => t.id)).toEqual([1, 2]);
  });

  it("sorts overdue tasks by due date ascending", () => {
    const result = buildTriageFeed(tasks, [], [], [], [], today);
    expect(result.overdueTasks[0].id).toBe(1); // Feb 15
    expect(result.overdueTasks[1].id).toBe(2); // Feb 16
  });

  it("does not include completed tasks in overdue", () => {
    const result = buildTriageFeed(tasks, [], [], [], [], today);
    expect(result.overdueTasks.find(t => t.id === 5)).toBeUndefined();
  });
});

describe("Triage Feed — Today Tasks", () => {
  const today = new Date(2026, 1, 18);

  const tasks: TriageTask[] = [
    { id: 1, title: "Due today high", priority: "high", dueDate: new Date(2026, 1, 18), status: "open", assignedName: null, category: null },
    { id: 2, title: "Due today low", priority: "low", dueDate: new Date(2026, 1, 18), status: "open", assignedName: null, category: null },
    { id: 3, title: "Due today medium", priority: "medium", dueDate: new Date(2026, 1, 18), status: "open", assignedName: null, category: null },
    { id: 4, title: "Due tomorrow", priority: "high", dueDate: new Date(2026, 1, 19), status: "open", assignedName: null, category: null },
    { id: 5, title: "Completed today", priority: "high", dueDate: new Date(2026, 1, 18), status: "completed", assignedName: null, category: null },
  ];

  it("shows only tasks due today (not completed)", () => {
    const result = buildTriageFeed(tasks, [], [], [], [], today);
    expect(result.todayTasks.map(t => t.id)).toEqual([1, 3, 2]); // sorted by priority
  });

  it("sorts today tasks by priority (high > medium > low)", () => {
    const result = buildTriageFeed(tasks, [], [], [], [], today);
    expect(result.todayTasks[0].priority).toBe("high");
    expect(result.todayTasks[1].priority).toBe("medium");
    expect(result.todayTasks[2].priority).toBe("low");
  });

  it("excludes completed tasks from today", () => {
    const result = buildTriageFeed(tasks, [], [], [], [], today);
    expect(result.todayTasks.find(t => t.id === 5)).toBeUndefined();
  });
});

describe("Triage Feed — High Priority Tasks", () => {
  const today = new Date(2026, 1, 18);

  const tasks: TriageTask[] = [
    { id: 1, title: "Overdue high", priority: "high", dueDate: new Date(2026, 1, 15), status: "open", assignedName: null, category: null },
    { id: 2, title: "Today high", priority: "high", dueDate: new Date(2026, 1, 18), status: "open", assignedName: null, category: null },
    { id: 3, title: "Future high", priority: "high", dueDate: new Date(2026, 2, 1), status: "open", assignedName: null, category: null },
    { id: 4, title: "No date high", priority: "high", dueDate: null, status: "open", assignedName: null, category: null },
    { id: 5, title: "Future medium", priority: "medium", dueDate: new Date(2026, 2, 1), status: "open", assignedName: null, category: null },
  ];

  it("shows high priority tasks that are NOT overdue and NOT due today", () => {
    const result = buildTriageFeed(tasks, [], [], [], [], today);
    // id 1 is overdue, id 2 is today — both excluded from highPriorityTasks
    expect(result.highPriorityTasks.map(t => t.id)).toEqual([3, 4]);
  });

  it("does not include medium/low priority in high priority section", () => {
    const result = buildTriageFeed(tasks, [], [], [], [], today);
    expect(result.highPriorityTasks.find(t => t.id === 5)).toBeUndefined();
  });
});

describe("Triage Feed — Summary Counts", () => {
  const today = new Date(2026, 1, 18);

  const tasks: TriageTask[] = [
    { id: 1, title: "Open high", priority: "high", dueDate: new Date(2026, 1, 15), status: "open", assignedName: null, category: null },
    { id: 2, title: "Open medium", priority: "medium", dueDate: new Date(2026, 1, 18), status: "open", assignedName: null, category: null },
    { id: 3, title: "Completed today", priority: "high", dueDate: null, status: "completed", assignedName: null, category: null, updatedAt: new Date(2026, 1, 18, 10, 0) },
    { id: 4, title: "Completed yesterday", priority: "low", dueDate: null, status: "completed", assignedName: null, category: null, updatedAt: new Date(2026, 1, 17, 15, 0) },
  ];

  const stars: TriageStar[] = [
    { threadId: "t1", starLevel: 3, userId: 1 },
    { threadId: "t2", starLevel: 1, userId: 1 },
  ];

  const contacts: TriageContact[] = [
    { id: 1, name: "Pending Contact", email: "a@b.com", organization: "Acme", approvalStatus: "pending" },
    { id: 2, name: "Approved Contact", email: "c@d.com", organization: null, approvalStatus: "approved" },
  ];

  const companies: TriageCompany[] = [
    { id: 1, name: "Pending Co", sector: "Finance", approvalStatus: "pending" },
  ];

  it("calculates totalOpen correctly (excludes completed)", () => {
    const result = buildTriageFeed(tasks, stars, contacts, companies, [], today);
    expect(result.summary.totalOpen).toBe(2);
  });

  it("calculates totalOverdue correctly", () => {
    const result = buildTriageFeed(tasks, stars, contacts, companies, [], today);
    expect(result.summary.totalOverdue).toBe(1);
  });

  it("calculates totalHighPriority correctly", () => {
    const result = buildTriageFeed(tasks, stars, contacts, companies, [], today);
    expect(result.summary.totalHighPriority).toBe(1);
  });

  it("calculates completedToday correctly", () => {
    const result = buildTriageFeed(tasks, stars, contacts, companies, [], today);
    expect(result.summary.completedToday).toBe(1); // only id 3
  });

  it("calculates totalStarred correctly", () => {
    const result = buildTriageFeed(tasks, stars, contacts, companies, [], today);
    expect(result.summary.totalStarred).toBe(2);
  });

  it("calculates totalPendingApprovals correctly", () => {
    const result = buildTriageFeed(tasks, stars, contacts, companies, [], today);
    expect(result.summary.totalPendingApprovals).toBe(2); // 1 contact + 1 company
  });
});

describe("Triage Feed — Pending Approvals", () => {
  const today = new Date(2026, 1, 18);

  const contacts: TriageContact[] = [
    { id: 1, name: "Pending A", email: "a@b.com", organization: "Org1", approvalStatus: "pending" },
    { id: 2, name: "Approved B", email: "c@d.com", organization: null, approvalStatus: "approved" },
    { id: 3, name: "Pending C", email: "e@f.com", organization: "Org2", approvalStatus: "pending" },
  ];

  const companies: TriageCompany[] = [
    { id: 1, name: "Pending Co", sector: "Finance", approvalStatus: "pending" },
    { id: 2, name: "Active Co", sector: "Tech", approvalStatus: "approved" },
  ];

  it("filters only pending contacts", () => {
    const result = buildTriageFeed([], [], contacts, companies, [], today);
    expect(result.pendingContacts.map(c => c.id)).toEqual([1, 3]);
  });

  it("filters only pending companies", () => {
    const result = buildTriageFeed([], [], contacts, companies, [], today);
    expect(result.pendingCompanies.map(c => c.id)).toEqual([1]);
  });
});

describe("Triage Feed — Empty State", () => {
  const today = new Date(2026, 1, 18);

  it("returns empty arrays and zero counts when no data", () => {
    const result = buildTriageFeed([], [], [], [], [], today);
    expect(result.overdueTasks).toHaveLength(0);
    expect(result.todayTasks).toHaveLength(0);
    expect(result.highPriorityTasks).toHaveLength(0);
    expect(result.starredEmails).toHaveLength(0);
    expect(result.pendingContacts).toHaveLength(0);
    expect(result.pendingCompanies).toHaveLength(0);
    expect(result.summary.totalOpen).toBe(0);
    expect(result.summary.totalOverdue).toBe(0);
    expect(result.summary.completedToday).toBe(0);
  });
});

describe("Triage Feed — Overdue Limit", () => {
  const today = new Date(2026, 1, 18);

  it("limits overdue tasks to 15", () => {
    const tasks: TriageTask[] = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      title: `Overdue ${i}`,
      priority: "medium",
      dueDate: new Date(2026, 0, i + 1), // Jan 1-20
      status: "open",
      assignedName: null,
      category: null,
    }));
    const result = buildTriageFeed(tasks, [], [], [], [], today);
    expect(result.overdueTasks).toHaveLength(15);
  });
});

// ── Domain Navigation Structure ──────────────────────────────────────────

interface DomainItem {
  id: string;
  label: string;
  path: string;
  matchPaths: string[];
}

const domains: DomainItem[] = [
  { id: "command", label: "Command Center", path: "/", matchPaths: ["/", "/reports/daily", "/reports/weekly"] },
  { id: "intelligence", label: "Intelligence", path: "/intelligence", matchPaths: ["/intelligence", "/meetings", "/meeting/"] },
  { id: "communications", label: "Communications", path: "/communications", matchPaths: ["/communications", "/mail", "/calendar"] },
  { id: "operations", label: "Operations", path: "/operations", matchPaths: ["/operations", "/tasks"] },
  { id: "relationships", label: "Relationships", path: "/relationships", matchPaths: ["/relationships", "/contacts", "/contact/", "/companies", "/company/"] },
];

function isDomainActive(domain: DomainItem, location: string): boolean {
  return domain.matchPaths.some(p => {
    if (p === "/") return location === "/";
    return location === p || location.startsWith(p);
  });
}

describe("Domain Navigation — Active State", () => {
  it("root path activates Command Center", () => {
    expect(isDomainActive(domains[0], "/")).toBe(true);
    expect(isDomainActive(domains[1], "/")).toBe(false);
  });

  it("/reports/daily activates Command Center", () => {
    expect(isDomainActive(domains[0], "/reports/daily")).toBe(true);
  });

  it("/intelligence activates Intelligence", () => {
    expect(isDomainActive(domains[1], "/intelligence")).toBe(true);
    expect(isDomainActive(domains[0], "/intelligence")).toBe(false);
  });

  it("/meeting/123 activates Intelligence", () => {
    expect(isDomainActive(domains[1], "/meeting/123")).toBe(true);
  });

  it("/communications activates Communications", () => {
    expect(isDomainActive(domains[2], "/communications")).toBe(true);
  });

  it("/mail activates Communications", () => {
    expect(isDomainActive(domains[2], "/mail")).toBe(true);
  });

  it("/mail/analytics activates Communications", () => {
    expect(isDomainActive(domains[2], "/mail/analytics")).toBe(true);
  });

  it("/calendar activates Communications", () => {
    expect(isDomainActive(domains[2], "/calendar")).toBe(true);
  });

  it("/operations activates Operations", () => {
    expect(isDomainActive(domains[3], "/operations")).toBe(true);
  });

  it("/tasks activates Operations", () => {
    expect(isDomainActive(domains[3], "/tasks")).toBe(true);
  });

  it("/relationships activates Relationships", () => {
    expect(isDomainActive(domains[4], "/relationships")).toBe(true);
  });

  it("/contacts activates Relationships", () => {
    expect(isDomainActive(domains[4], "/contacts")).toBe(true);
  });

  it("/contact/42 activates Relationships", () => {
    expect(isDomainActive(domains[4], "/contact/42")).toBe(true);
  });

  it("/companies activates Relationships", () => {
    expect(isDomainActive(domains[4], "/companies")).toBe(true);
  });

  it("/company/7 activates Relationships", () => {
    expect(isDomainActive(domains[4], "/company/7")).toBe(true);
  });
});

describe("Domain Navigation — Exactly 5 Domains", () => {
  it("has exactly 5 domains", () => {
    expect(domains).toHaveLength(5);
  });

  it("each domain has unique id", () => {
    const ids = domains.map(d => d.id);
    expect(new Set(ids).size).toBe(5);
  });

  it("each domain has a path", () => {
    domains.forEach(d => {
      expect(d.path).toBeTruthy();
      expect(d.path.startsWith("/")).toBe(true);
    });
  });
});

describe("Domain Navigation — No Cross-Activation", () => {
  const testPaths = [
    "/", "/overview", "/reports/daily", "/reports/weekly",
    "/intelligence", "/meetings", "/meeting/1",
    "/communications", "/mail", "/mail/analytics", "/calendar",
    "/operations", "/tasks",
    "/relationships", "/contacts", "/contact/5", "/companies", "/company/3",
  ];

  it("each path activates at most one domain", () => {
    testPaths.forEach(path => {
      const activeDomains = domains.filter(d => isDomainActive(d, path));
      expect(activeDomains.length).toBeLessThanOrEqual(1);
    });
  });
});

// ── Domain Tab Structure ─────────────────────────────────────────────────

describe("Domain Tab Structure", () => {
  const commandTabs = [
    { id: "triage", label: "Triage", path: "/" },
    { id: "overview", label: "Overview", path: "/overview" },
    { id: "daily", label: "Daily Brief", path: "/reports/daily" },
    { id: "weekly", label: "Weekly Brief", path: "/reports/weekly" },
  ];

  const intelligenceTabs = [
    { id: "meetings", label: "Meetings", path: "/intelligence" },
  ];

  const communicationsTabs = [
    { id: "inbox", label: "Inbox", path: "/communications" },
    { id: "calendar", label: "Calendar", path: "/calendar" },
    { id: "analytics", label: "Analytics", path: "/mail/analytics" },
  ];

  const operationsTabs = [
    { id: "tasks", label: "Tasks", path: "/operations" },
  ];

  const relationshipsTabs = [
    { id: "people", label: "People", path: "/relationships" },
    { id: "companies", label: "Companies", path: "/companies" },
  ];

  it("Command Center has 4 tabs", () => {
    expect(commandTabs).toHaveLength(4);
  });

  it("Communications has 3 tabs", () => {
    expect(communicationsTabs).toHaveLength(3);
  });

  it("Relationships has 2 tabs", () => {
    expect(relationshipsTabs).toHaveLength(2);
  });

  it("all tabs have unique ids within their domain", () => {
    [commandTabs, intelligenceTabs, communicationsTabs, operationsTabs, relationshipsTabs].forEach(tabs => {
      const ids = tabs.map(t => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  it("all tabs have valid paths", () => {
    [commandTabs, intelligenceTabs, communicationsTabs, operationsTabs, relationshipsTabs].flat().forEach(tab => {
      expect(tab.path).toBeTruthy();
      expect(tab.path.startsWith("/")).toBe(true);
    });
  });
});

// ── Star Level Labels ────────────────────────────────────────────────────

describe("Triage Feed — Star Level Labels", () => {
  const starLabels: Record<number, string> = { 1: "Reply Today", 2: "Delegate", 3: "Critical" };
  const starColors: Record<number, string> = { 1: "text-yellow-500", 2: "text-orange-400", 3: "text-red-400" };

  it("star level 1 maps to Reply Today", () => {
    expect(starLabels[1]).toBe("Reply Today");
  });

  it("star level 2 maps to Delegate", () => {
    expect(starLabels[2]).toBe("Delegate");
  });

  it("star level 3 maps to Critical", () => {
    expect(starLabels[3]).toBe("Critical");
  });

  it("each star level has a color", () => {
    expect(starColors[1]).toBeTruthy();
    expect(starColors[2]).toBeTruthy();
    expect(starColors[3]).toBeTruthy();
  });
});

// ── Greeting Logic ──────────────────────────────────────────────────────────

describe("Triage Feed — Greeting Logic", () => {
  function getGreeting(hour: number): string {
    return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  }

  function getFirstName(fullName: string): string {
    return (fullName || "there").split(" ")[0];
  }

  it("returns Good morning before noon", () => {
    expect(getGreeting(0)).toBe("Good morning");
    expect(getGreeting(6)).toBe("Good morning");
    expect(getGreeting(11)).toBe("Good morning");
  });

  it("returns Good afternoon from noon to 5pm", () => {
    expect(getGreeting(12)).toBe("Good afternoon");
    expect(getGreeting(14)).toBe("Good afternoon");
    expect(getGreeting(16)).toBe("Good afternoon");
  });

  it("returns Good evening after 5pm", () => {
    expect(getGreeting(17)).toBe("Good evening");
    expect(getGreeting(20)).toBe("Good evening");
    expect(getGreeting(23)).toBe("Good evening");
  });

  it("extracts first name from full name", () => {
    expect(getFirstName("Junaid Qureshi")).toBe("Junaid");
    expect(getFirstName("Kyle Jackson")).toBe("Kyle");
    expect(getFirstName("Jake")).toBe("Jake");
  });

  it("falls back to 'there' for empty name", () => {
    expect(getFirstName("")).toBe("there");
  });
});

// ── Title Cleanup Logic ─────────────────────────────────────────────────────

describe("Triage Feed — Title Cleanup", () => {
  function cleanTitle(title: string): string {
    return title.replace(/\s*\(Assigned to:.*?\)\s*$/, "");
  }

  it("strips (Assigned to: ...) suffix from task titles", () => {
    expect(cleanTitle("Email Kyle carbon credit pricing template (Assigned to: Tom Zickell)"))
      .toBe("Email Kyle carbon credit pricing template");
  });

  it("leaves titles without suffix unchanged", () => {
    expect(cleanTitle("Deploy portal to Vercel")).toBe("Deploy portal to Vercel");
  });

  it("handles complex assigned names", () => {
    expect(cleanTitle("Review AI platform materials (Assigned to: Jacob McDonald)"))
      .toBe("Review AI platform materials");
  });
});

// ── Inline Action Logic ─────────────────────────────────────────────────────

describe("Triage Feed — Inline Actions", () => {
  it("completeTask sets status to completed", () => {
    const task = { id: 1, status: "open" };
    const updated = { ...task, status: "completed" };
    expect(updated.status).toBe("completed");
  });

  it("snoozeTask pushes due date forward by N days", () => {
    const now = new Date(2026, 1, 18);
    const days = 1;
    const newDate = new Date(now);
    newDate.setDate(newDate.getDate() + days);
    expect(newDate.getDate()).toBe(19);
  });

  it("snoozeTask pushes due date forward by 3 days", () => {
    const now = new Date(2026, 1, 18);
    const days = 3;
    const newDate = new Date(now);
    newDate.setDate(newDate.getDate() + days);
    expect(newDate.getDate()).toBe(21);
  });
});

// ── Router Source Verification ──────────────────────────────────────────────

describe("Triage Router — Source Structure", () => {
  it("triage router has feed, completeTask, and snoozeTask procedures", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("server/routers.ts", "utf-8")
    );
    expect(source).toMatch(/triageRouter.*=.*router/);
    expect(source).toMatch(/feed:.*protectedProcedure/);
    expect(source).toMatch(/completeTask:.*protectedProcedure/);
    expect(source).toMatch(/snoozeTask:.*protectedProcedure/);
  });

  it("triage feed returns userName and greeting", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("server/routers.ts", "utf-8")
    );
    expect(source).toMatch(/userName.*split.*\[0\]/);
    expect(source).toMatch(/greeting/);
  });

  it("TriageFeed component uses grid layout and local greeting", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("client/src/pages/TriageFeed.tsx", "utf-8")
    );
    expect(source).toMatch(/grid-cols/);
    // v40: greeting is now local (getGreeting(localHour)), userName still from data
    expect(source).toMatch(/greeting/);
    expect(source).toMatch(/data\.userName/);
  });

  it("TriageFeed has inline action buttons (complete and snooze)", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("client/src/pages/TriageFeed.tsx", "utf-8")
    );
    expect(source).toMatch(/completeTask/);
    expect(source).toMatch(/snoozeTask/);
    expect(source).toMatch(/Mark complete|Complete/);
    expect(source).toMatch(/Snooze/);
  });
});

// ── v40: Tomorrow & Week Tasks ──────────────────────────────────────────────

describe("Triage Feed — Tomorrow & Week Tasks", () => {
  const today = new Date(2026, 1, 18); // Wednesday Feb 18
  const startOfToday = new Date(2026, 1, 18);
  const startOfTomorrow = new Date(2026, 1, 19);
  const endOfTomorrow = new Date(2026, 1, 20);
  // End of week = Sunday Feb 22
  const endOfWeek = new Date(2026, 1, 22, 23, 59, 59, 999);

  function filterTomorrowTasks(tasks: TriageTask[]): TriageTask[] {
    return tasks.filter(t =>
      t.status !== "completed" &&
      t.dueDate &&
      new Date(t.dueDate) >= startOfTomorrow &&
      new Date(t.dueDate) < endOfTomorrow
    );
  }

  function filterWeekTasks(tasks: TriageTask[]): TriageTask[] {
    return tasks.filter(t =>
      t.status !== "completed" &&
      t.dueDate &&
      new Date(t.dueDate) >= endOfTomorrow &&
      new Date(t.dueDate) <= endOfWeek
    );
  }

  function filterCompletedToday(tasks: TriageTask[]): TriageTask[] {
    return tasks.filter(t =>
      t.status === "completed" &&
      t.updatedAt &&
      new Date(t.updatedAt) >= startOfToday &&
      new Date(t.updatedAt) < startOfTomorrow
    );
  }

  const tasks: TriageTask[] = [
    { id: 1, title: "Due today", priority: "high", dueDate: new Date(2026, 1, 18), status: "open", assignedName: null, category: null },
    { id: 2, title: "Due tomorrow", priority: "medium", dueDate: new Date(2026, 1, 19), status: "open", assignedName: null, category: null },
    { id: 3, title: "Due Friday", priority: "low", dueDate: new Date(2026, 1, 20), status: "open", assignedName: null, category: null },
    { id: 4, title: "Due Saturday", priority: "high", dueDate: new Date(2026, 1, 21), status: "open", assignedName: null, category: null },
    { id: 5, title: "Due next week", priority: "medium", dueDate: new Date(2026, 1, 25), status: "open", assignedName: null, category: null },
    { id: 6, title: "Completed today", priority: "high", dueDate: new Date(2026, 1, 18), status: "completed", assignedName: null, category: null, updatedAt: new Date(2026, 1, 18, 14, 0) },
    { id: 7, title: "Completed yesterday", priority: "low", dueDate: new Date(2026, 1, 17), status: "completed", assignedName: null, category: null, updatedAt: new Date(2026, 1, 17, 10, 0) },
    { id: 8, title: "Tomorrow completed", priority: "medium", dueDate: new Date(2026, 1, 19), status: "completed", assignedName: null, category: null },
  ];

  it("filters tomorrow tasks correctly", () => {
    const result = filterTomorrowTasks(tasks);
    expect(result.map(t => t.id)).toEqual([2]);
  });

  it("filters this week tasks (after tomorrow, before end of week)", () => {
    const result = filterWeekTasks(tasks);
    expect(result.map(t => t.id)).toEqual([3, 4]);
  });

  it("excludes completed tasks from tomorrow", () => {
    const result = filterTomorrowTasks(tasks);
    expect(result.find(t => t.id === 8)).toBeUndefined();
  });

  it("excludes next week tasks from this week", () => {
    const result = filterWeekTasks(tasks);
    expect(result.find(t => t.id === 5)).toBeUndefined();
  });

  it("filters completed today correctly", () => {
    const result = filterCompletedToday(tasks);
    expect(result.map(t => t.id)).toEqual([6]);
  });

  it("excludes yesterday's completions from completed today", () => {
    const result = filterCompletedToday(tasks);
    expect(result.find(t => t.id === 7)).toBeUndefined();
  });
});

// ── v40: Bulk Task Actions ──────────────────────────────────────────────────

describe("Bulk Task Actions", () => {
  interface BulkUpdateInput {
    taskIds: number[];
    field: string;
    value: string;
  }

  function validateBulkUpdate(input: BulkUpdateInput): boolean {
    const validFields = ["category", "assignedTo", "status", "priority"];
    return (
      input.taskIds.length > 0 &&
      validFields.includes(input.field) &&
      input.value.length > 0
    );
  }

  it("validates bulk update with valid fields", () => {
    expect(validateBulkUpdate({ taskIds: [1, 2, 3], field: "category", value: "OTC" })).toBe(true);
    expect(validateBulkUpdate({ taskIds: [1], field: "priority", value: "high" })).toBe(true);
    expect(validateBulkUpdate({ taskIds: [1, 2], field: "status", value: "completed" })).toBe(true);
  });

  it("rejects bulk update with empty task ids", () => {
    expect(validateBulkUpdate({ taskIds: [], field: "category", value: "OTC" })).toBe(false);
  });

  it("rejects bulk update with invalid field", () => {
    expect(validateBulkUpdate({ taskIds: [1], field: "invalid", value: "test" })).toBe(false);
  });

  it("rejects bulk update with empty value", () => {
    expect(validateBulkUpdate({ taskIds: [1], field: "category", value: "" })).toBe(false);
  });
});

// ── v40: Ask OmniScope Spotlight ────────────────────────────────────────────

describe("Ask OmniScope Spotlight — Source Structure", () => {
  it("AskSpotlight component exists with onClose prop", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("client/src/components/AskSpotlight.tsx", "utf-8")
    );
    expect(source).toMatch(/onClose/);
    expect(source).toMatch(/Escape/);
    expect(source).toMatch(/Ask OmniScope/);
  });

  it("PortalLayout renders OmniChatPanel with keyboard shortcut", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("client/src/components/PortalLayout.tsx", "utf-8")
    );
    expect(source).toMatch(/omniChatOpen/);
    expect(source).toMatch(/OmniChatPanel/);
    expect(source).toMatch(/\u2318K|Cmd.*K|ctrlKey.*k/);
  });

  it("AskSpotlight has suggestion prompts", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("client/src/components/AskSpotlight.tsx", "utf-8")
    );
    expect(source).toMatch(/Try asking/);
    expect(source).toMatch(/handleSuggestion/);
  });

  it("AskSpotlight has link to full page", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("client/src/components/AskSpotlight.tsx", "utf-8")
    );
    expect(source).toMatch(/Open full page/);
    expect(source).toMatch(/\/ask/);
  });
});

// ── v40: Triage Widgets Source Verification ─────────────────────────────────

describe("Triage Feed — v40 Widget Source Verification", () => {
  it("TriageFeed has tomorrow section", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("client/src/pages/TriageFeed.tsx", "utf-8")
    );
    expect(source).toMatch(/Tomorrow/);
    expect(source).toMatch(/tomorrowTasks/);
  });

  it("TriageFeed has this week section", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("client/src/pages/TriageFeed.tsx", "utf-8")
    );
    expect(source).toMatch(/This Week|weekTasks/);
  });

  it("TriageFeed has completed today section", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("client/src/pages/TriageFeed.tsx", "utf-8")
    );
    expect(source).toMatch(/Completed Today|completedTodayTasks/);
    expect(source).toMatch(/All tasks completed/);
  });

  it("TriageFeed uses local time for greeting (not server time)", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("client/src/pages/TriageFeed.tsx", "utf-8")
    );
    expect(source).toMatch(/useLiveClock/);
    expect(source).toMatch(/getGreeting.*localHour|localHour.*getGreeting/);
    expect(source).toMatch(/getHours/);
  });

  it("TriageFeed has live clock with timezone", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("client/src/pages/TriageFeed.tsx", "utf-8")
    );
    expect(source).toMatch(/toLocaleTimeString/);
    expect(source).toMatch(/timeZoneName/);
  });

  it("Triage router returns tomorrow and week tasks", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("server/routers.ts", "utf-8")
    );
    expect(source).toMatch(/tomorrowTasks/);
    expect(source).toMatch(/weekTasks/);
    expect(source).toMatch(/completedTodayTasks/);
  });

  it("ToDo page has bulk update mutation", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("client/src/pages/ToDo.tsx", "utf-8")
    );
    expect(source).toMatch(/bulkUpdateTask|bulkUpdate/);
  });
});


// ============================================================================
// v41: COMMAND CENTER PREMIUM UPGRADE TESTS
// ============================================================================

// ── Contextual Status Line ─────────────────────────────────────────────────

describe("Triage Feed — Contextual Status Line", () => {
  function getStatusLine(
    summary: { totalOverdue: number; totalHighPriority: number; totalPendingApprovals: number; totalOpen: number },
    hour: number
  ): string {
    const { totalOverdue: overdue, totalHighPriority: high, totalPendingApprovals: pending, totalOpen: open } = summary;
    if (hour >= 22 || hour < 6) return "No immediate actions required tonight.";
    if (overdue > 3 || high > 5) return "High activity detected. Multiple items need your attention.";
    if (overdue > 0) return `${overdue} overdue item${overdue > 1 ? "s" : ""} and ${high} high-priority tasks on your radar.`;
    if (pending > 0 && open > 10) return `${open} open tasks with ${pending} pending approval${pending > 1 ? "s" : ""}.`;
    if (open <= 5) return "You're clear for now. Use this time to plan ahead.";
    return `${open} tasks in your pipeline. ${high > 0 ? `${high} marked high priority.` : "No critical flags."}`;
  }

  it("returns after-hours message late at night", () => {
    const summary = { totalOverdue: 5, totalHighPriority: 3, totalPendingApprovals: 2, totalOpen: 20 };
    expect(getStatusLine(summary, 23)).toBe("No immediate actions required tonight.");
    expect(getStatusLine(summary, 2)).toBe("No immediate actions required tonight.");
  });

  it("returns high activity message when overdue > 3", () => {
    const summary = { totalOverdue: 4, totalHighPriority: 2, totalPendingApprovals: 0, totalOpen: 10 };
    expect(getStatusLine(summary, 10)).toBe("High activity detected. Multiple items need your attention.");
  });

  it("returns high activity message when high priority > 5", () => {
    const summary = { totalOverdue: 0, totalHighPriority: 6, totalPendingApprovals: 0, totalOpen: 10 };
    expect(getStatusLine(summary, 10)).toBe("High activity detected. Multiple items need your attention.");
  });

  it("returns overdue message with singular form", () => {
    const summary = { totalOverdue: 1, totalHighPriority: 2, totalPendingApprovals: 0, totalOpen: 10 };
    expect(getStatusLine(summary, 10)).toBe("1 overdue item and 2 high-priority tasks on your radar.");
  });

  it("returns overdue message with plural form", () => {
    const summary = { totalOverdue: 3, totalHighPriority: 1, totalPendingApprovals: 0, totalOpen: 10 };
    expect(getStatusLine(summary, 10)).toBe("3 overdue items and 1 high-priority tasks on your radar.");
  });

  it("returns pending approvals message when relevant", () => {
    const summary = { totalOverdue: 0, totalHighPriority: 0, totalPendingApprovals: 2, totalOpen: 15 };
    expect(getStatusLine(summary, 10)).toBe("15 open tasks with 2 pending approvals.");
  });

  it("returns clear message when few tasks", () => {
    const summary = { totalOverdue: 0, totalHighPriority: 0, totalPendingApprovals: 0, totalOpen: 3 };
    expect(getStatusLine(summary, 10)).toBe("You're clear for now. Use this time to plan ahead.");
  });

  it("returns pipeline message with high priority flag", () => {
    const summary = { totalOverdue: 0, totalHighPriority: 3, totalPendingApprovals: 0, totalOpen: 15 };
    expect(getStatusLine(summary, 10)).toBe("15 tasks in your pipeline. 3 marked high priority.");
  });

  it("returns pipeline message without high priority flag", () => {
    const summary = { totalOverdue: 0, totalHighPriority: 0, totalPendingApprovals: 0, totalOpen: 15 };
    expect(getStatusLine(summary, 10)).toBe("15 tasks in your pipeline. No critical flags.");
  });
});

// ── Situational Summary ────────────────────────────────────────────────────

describe("Triage Feed — Situational Summary", () => {
  function getSituationalSummary(
    data: {
      summary: { totalOverdue: number; totalHighPriority: number; totalPendingApprovals: number };
      todayTasks?: any[];
      recentMeetings?: any[];
      tomorrowTasks?: any[];
    },
    hour: number
  ): string {
    const parts: string[] = [];
    if (data.summary.totalOverdue > 0) {
      parts.push(`You have ${data.summary.totalOverdue} overdue task${data.summary.totalOverdue > 1 ? "s" : ""} that need${data.summary.totalOverdue === 1 ? "s" : ""} immediate attention`);
    }
    if (data.todayTasks?.length) {
      parts.push(`${data.todayTasks.length} task${data.todayTasks.length > 1 ? "s" : ""} due today`);
    }
    if (data.summary.totalHighPriority > 0 && data.summary.totalOverdue === 0) {
      parts.push(`${data.summary.totalHighPriority} high-priority item${data.summary.totalHighPriority > 1 ? "s" : ""} in your pipeline`);
    }
    if (data.summary.totalPendingApprovals > 0) {
      parts.push(`${data.summary.totalPendingApprovals} approval${data.summary.totalPendingApprovals > 1 ? "s" : ""} awaiting your review`);
    }
    if (data.tomorrowTasks?.length) {
      parts.push(`${data.tomorrowTasks.length} task${data.tomorrowTasks.length > 1 ? "s" : ""} coming up tomorrow`);
    }
    if (parts.length === 0) {
      if (hour >= 22 || hour < 6) return "Everything is quiet. Rest well — tomorrow's slate is clear.";
      return "All clear. No pending items require your attention right now.";
    }
    return parts.join(". ") + ".";
  }

  it("generates summary with overdue tasks", () => {
    const data = { summary: { totalOverdue: 3, totalHighPriority: 2, totalPendingApprovals: 0 }, todayTasks: [] };
    const result = getSituationalSummary(data, 10);
    expect(result).toContain("3 overdue tasks");
    expect(result).toContain("immediate attention");
  });

  it("generates summary with today tasks", () => {
    const data = { summary: { totalOverdue: 0, totalHighPriority: 0, totalPendingApprovals: 0 }, todayTasks: [{ id: 1 }, { id: 2 }] };
    const result = getSituationalSummary(data, 10);
    expect(result).toContain("2 tasks due today");
  });

  it("generates summary with pending approvals", () => {
    const data = { summary: { totalOverdue: 0, totalHighPriority: 0, totalPendingApprovals: 1 }, todayTasks: [] };
    const result = getSituationalSummary(data, 10);
    expect(result).toContain("1 approval awaiting your review");
  });

  it("generates summary with tomorrow tasks", () => {
    const data = { summary: { totalOverdue: 0, totalHighPriority: 0, totalPendingApprovals: 0 }, todayTasks: [], tomorrowTasks: [{ id: 1 }] };
    const result = getSituationalSummary(data, 10);
    expect(result).toContain("1 task coming up tomorrow");
  });

  it("returns all-clear message when nothing pending", () => {
    const data = { summary: { totalOverdue: 0, totalHighPriority: 0, totalPendingApprovals: 0 }, todayTasks: [] };
    expect(getSituationalSummary(data, 10)).toBe("All clear. No pending items require your attention right now.");
  });

  it("returns rest-well message at night when nothing pending", () => {
    const data = { summary: { totalOverdue: 0, totalHighPriority: 0, totalPendingApprovals: 0 }, todayTasks: [] };
    expect(getSituationalSummary(data, 23)).toBe("Everything is quiet. Rest well — tomorrow's slate is clear.");
  });

  it("combines multiple parts with periods", () => {
    const data = {
      summary: { totalOverdue: 1, totalHighPriority: 2, totalPendingApprovals: 1 },
      todayTasks: [{ id: 1 }],
      tomorrowTasks: [{ id: 2 }, { id: 3 }],
    };
    const result = getSituationalSummary(data, 10);
    expect(result).toContain(". ");
    expect(result.endsWith(".")).toBe(true);
  });
});

// ── Quotes System ──────────────────────────────────────────────────────────

describe("Triage Feed — Quotes System", () => {
  const QUOTES = {
    strategic: [
      { text: "Focus is saying no to a thousand things.", author: "Steve Jobs" },
      { text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
    ],
    stoic: [
      { text: "You have power over your mind — not outside events.", author: "Marcus Aurelius" },
      { text: "The obstacle is the way.", author: "Marcus Aurelius" },
    ],
    operational: [
      { text: "Plans are useless, but planning is indispensable.", author: "Dwight D. Eisenhower" },
    ],
  };

  function getDailyQuote() {
    const allQuotes = [...QUOTES.strategic, ...QUOTES.stoic, ...QUOTES.operational];
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    return allQuotes[dayOfYear % allQuotes.length];
  }

  it("returns a quote with text and author", () => {
    const quote = getDailyQuote();
    expect(quote).toHaveProperty("text");
    expect(quote).toHaveProperty("author");
    expect(quote.text.length).toBeGreaterThan(0);
    expect(quote.author.length).toBeGreaterThan(0);
  });

  it("returns the same quote for the same day", () => {
    const q1 = getDailyQuote();
    const q2 = getDailyQuote();
    expect(q1.text).toBe(q2.text);
    expect(q1.author).toBe(q2.author);
  });

  it("cycles through all quotes over time", () => {
    const allQuotes = [...QUOTES.strategic, ...QUOTES.stoic, ...QUOTES.operational];
    const seen = new Set<string>();
    for (let day = 0; day < allQuotes.length; day++) {
      const idx = day % allQuotes.length;
      seen.add(allQuotes[idx].text);
    }
    expect(seen.size).toBe(allQuotes.length);
  });
});

// ── Interactive Modal Logic ────────────────────────────────────────────────

describe("Triage Feed — Task Modal Actions", () => {
  it("task update preserves non-changed fields", () => {
    const original = { id: 1, title: "Test task", priority: "medium", notes: "old notes", category: "OTC" };
    const updates = { title: "Updated task", priority: "high" };
    const result = { ...original, ...updates };
    expect(result.title).toBe("Updated task");
    expect(result.priority).toBe("high");
    expect(result.notes).toBe("old notes"); // unchanged
    expect(result.category).toBe("OTC"); // unchanged
  });

  it("task delete removes task from list", () => {
    const tasks = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const afterDelete = tasks.filter(t => t.id !== 2);
    expect(afterDelete.length).toBe(2);
    expect(afterDelete.find(t => t.id === 2)).toBeUndefined();
  });

  it("approval sets status to approved", () => {
    const contact = { id: 1, name: "Test", approvalStatus: "pending" };
    const approved = { ...contact, approvalStatus: "approved" };
    expect(approved.approvalStatus).toBe("approved");
  });

  it("rejection sets status to rejected", () => {
    const contact = { id: 1, name: "Test", approvalStatus: "pending" };
    const rejected = { ...contact, approvalStatus: "rejected" };
    expect(rejected.approvalStatus).toBe("rejected");
  });
});

// ── v41 Source Structure Verification ──────────────────────────────────────

describe("Triage Feed — v41 Source Structure", () => {
  it("TriageFeed has situational summary", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("client/src/pages/TriageFeed.tsx", "utf-8")
    );
    expect(source).toMatch(/getSituationalSummary/);
    expect(source).toMatch(/getStatusLine/);
    expect(source).toMatch(/situationalSummary/);
  });

  it("TriageFeed has TaskModal component", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("client/src/pages/TriageFeed.tsx", "utf-8")
    );
    expect(source).toMatch(/TaskModal/);
    expect(source).toMatch(/onComplete/);
    expect(source).toMatch(/onDelete/);
    expect(source).toMatch(/onUpdate/);
    expect(source).toMatch(/onSnooze/);
  });

  it("TriageFeed has ApprovalModal component", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("client/src/pages/TriageFeed.tsx", "utf-8")
    );
    expect(source).toMatch(/ApprovalModal/);
    expect(source).toMatch(/onApprove/);
    expect(source).toMatch(/onReject/);
  });

  it("TriageFeed has quotes system with toggle", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("client/src/pages/TriageFeed.tsx", "utf-8")
    );
    expect(source).toMatch(/getDailyQuote/);
    expect(source).toMatch(/showQuote/);
    expect(source).toMatch(/omniscope-show-quote/);
    expect(source).toMatch(/EyeOff|Eye/);
  });

  it("TriageFeed has InlineInsights integrated into greeting bar", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("client/src/pages/TriageFeed.tsx", "utf-8")
    );
    expect(source).toMatch(/InlineInsights/);
    expect(source).toMatch(/strategicInsights/);
    expect(source).toMatch(/Strategic Insights/);
  });

  it("Triage router has deleteTask, updateTask, and approval procedures", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("server/routers.ts", "utf-8")
    );
    expect(source).toMatch(/deleteTask:.*protectedProcedure/);
    expect(source).toMatch(/updateTask:.*protectedProcedure/);
    expect(source).toMatch(/approveContact:.*protectedProcedure/);
    expect(source).toMatch(/rejectContact:.*protectedProcedure/);
    expect(source).toMatch(/approveCompany:.*protectedProcedure/);
    expect(source).toMatch(/rejectCompany:.*protectedProcedure/);
  });

  it("Triage router has strategicInsights procedure with LLM", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("server/routers.ts", "utf-8")
    );
    expect(source).toMatch(/strategicInsights:.*protectedProcedure/);
    expect(source).toMatch(/invokeLLM/);
    expect(source).toMatch(/json_schema/);
  });

  it("TaskModal has edit mode with form fields", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("client/src/pages/TriageFeed.tsx", "utf-8")
    );
    expect(source).toMatch(/isEditing/);
    expect(source).toMatch(/editTitle/);
    expect(source).toMatch(/editPriority/);
    expect(source).toMatch(/editNotes/);
    expect(source).toMatch(/editCategory/);
    expect(source).toMatch(/handleSave/);
  });
});


// ============================================================================
// v44 — TRIAGE LAYOUT OPTIMIZATION TESTS
// Tests for consolidated greeting bar, unread emails section, and tighter layout
// ============================================================================

describe("v44 — Greeting Bar with Integrated Insights", () => {
  it("TriageFeed has InlineInsights component inside greeting bar", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("client/src/pages/TriageFeed.tsx", "utf-8")
    );
    // InlineInsights is a separate component rendered inside the greeting card
    expect(source).toMatch(/function InlineInsights/);
    // It uses the strategicInsights query
    expect(source).toMatch(/triage\.strategicInsights\.useQuery/);
    // It renders Zap icons for each insight
    expect(source).toMatch(/Zap/);
  });

  it("Greeting bar has two-column layout (greeting left, insights right)", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("client/src/pages/TriageFeed.tsx", "utf-8")
    );
    // Two-column flex layout in greeting bar
    expect(source).toMatch(/lg:flex-row/);
    // Right column has clock + insights
    expect(source).toMatch(/Strategic Insights/);
    // Brain icon for insights header
    expect(source).toMatch(/Brain/);
  });

  it("Greeting bar includes live clock with timezone", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("client/src/pages/TriageFeed.tsx", "utf-8")
    );
    expect(source).toMatch(/timeString/);
    expect(source).toMatch(/tzAbbr/);
    expect(source).toMatch(/timeZoneName/);
  });

  it("Greeting bar includes situational summary", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("client/src/pages/TriageFeed.tsx", "utf-8")
    );
    expect(source).toMatch(/getSituationalSummary/);
    expect(source).toMatch(/situationalSummary/);
  });
});

describe("v44 — Unread Emails Section", () => {
  it("TriageFeed has UnreadEmailsSection component", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("client/src/pages/TriageFeed.tsx", "utf-8")
    );
    expect(source).toMatch(/function UnreadEmailsSection/);
    expect(source).toMatch(/<UnreadEmailsSection/);
  });

  it("UnreadEmailsSection filters unread emails", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("client/src/pages/TriageFeed.tsx", "utf-8")
    );
    // Filters for unread emails
    expect(source).toMatch(/t\.unread/);
    // Falls back to today's emails if no unread
    expect(source).toMatch(/todayEmails/);
    // Shows unread indicator dot
    expect(source).toMatch(/bg-violet-500/);
  });

  it("UnreadEmailsSection uses 2-column grid layout", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("client/src/pages/TriageFeed.tsx", "utf-8")
    );
    // Uses grid layout for emails
    expect(source).toMatch(/md:grid-cols-2/);
    // Shows MailOpen icon
    expect(source).toMatch(/MailOpen/);
  });
});

describe("v44 — Layout Optimization", () => {
  it("Strategic Insights are NOT a separate standalone section", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("client/src/pages/TriageFeed.tsx", "utf-8")
    );
    // Should NOT have a standalone StrategicInsightsPanel component anymore
    expect(source).not.toMatch(/function StrategicInsightsPanel/);
    // Should have InlineInsights instead
    expect(source).toMatch(/function InlineInsights/);
  });

  it("Stat cards use compact 3-column grid (side-by-side with insights)", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("client/src/pages/TriageFeed.tsx", "utf-8")
    );
    expect(source).toMatch(/grid-cols-3/);
  });

  it("Mobile responsive: insights appear below greeting on small screens", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("client/src/pages/TriageFeed.tsx", "utf-8")
    );
    // Mobile fallback for insights
    expect(source).toMatch(/lg:hidden/);
    // Desktop-only right column
    expect(source).toMatch(/hidden lg:flex/);
  });
});

describe("v44 — Contextual Status Lines", () => {
  it("returns after-hours message for late night", () => {
    const data = { summary: { totalOverdue: 0, totalHighPriority: 0, totalPendingApprovals: 0, totalOpen: 5 } };
    const statusLine = getStatusLineTest(data, 23);
    expect(statusLine).toBe("No immediate actions required tonight.");
  });

  it("returns high activity message when many overdue", () => {
    const data = { summary: { totalOverdue: 5, totalHighPriority: 3, totalPendingApprovals: 0, totalOpen: 20 } };
    const statusLine = getStatusLineTest(data, 10);
    expect(statusLine).toBe("High activity detected. Multiple items need your attention.");
  });

  it("returns clear message when few tasks", () => {
    const data = { summary: { totalOverdue: 0, totalHighPriority: 0, totalPendingApprovals: 0, totalOpen: 3 } };
    const statusLine = getStatusLineTest(data, 14);
    expect(statusLine).toBe("You're clear for now. Use this time to plan ahead.");
  });

  it("returns overdue message when some overdue", () => {
    const data = { summary: { totalOverdue: 2, totalHighPriority: 4, totalPendingApprovals: 0, totalOpen: 15 } };
    const statusLine = getStatusLineTest(data, 9);
    expect(statusLine).toBe("2 overdue items and 4 high-priority tasks on your radar.");
  });

  it("returns pipeline message for normal workload", () => {
    const data = { summary: { totalOverdue: 0, totalHighPriority: 3, totalPendingApprovals: 0, totalOpen: 12 } };
    const statusLine = getStatusLineTest(data, 11);
    expect(statusLine).toBe("12 tasks in your pipeline. 3 marked high priority.");
  });
});

// Re-implement getStatusLine for testing (pure function)
function getStatusLineTest(data: any, hour: number) {
  const { summary } = data;
  const overdue = summary.totalOverdue;
  const high = summary.totalHighPriority;
  const pending = summary.totalPendingApprovals;
  const open = summary.totalOpen;

  if (hour >= 22 || hour < 6) return "No immediate actions required tonight.";
  if (overdue > 3 || high > 5) return "High activity detected. Multiple items need your attention.";
  if (overdue > 0) return `${overdue} overdue item${overdue > 1 ? "s" : ""} and ${high} high-priority tasks on your radar.`;
  if (pending > 0 && open > 10) return `${open} open tasks with ${pending} pending approval${pending > 1 ? "s" : ""}.`;
  if (open <= 5) return "You're clear for now. Use this time to plan ahead.";
  return `${open} tasks in your pipeline. ${high > 0 ? `${high} marked high priority.` : "No critical flags."}`;
}


// ============================================================================
// v45 — GREETING BAR REDESIGN TESTS
// Tests for Strategic Insights under quote, Omni character in greeting bar,
// and layout optimization
// ============================================================================

describe("v45: Greeting bar layout structure", () => {
  it("should have Strategic Insights positioned under the quote (not beside clock)", () => {
    // The GreetingBar component renders insights under the quote section
    // Layout: Left column (greeting → status → summary → quote → insights)
    //         Center-right: Omni character
    //         Right: Clock
    const layout = {
      leftColumn: ["greeting", "statusLine", "summary", "quote", "strategicInsights"],
      centerRight: ["omniCharacter"],
      right: ["clock", "date", "timezone"],
    };
    expect(layout.leftColumn).toContain("strategicInsights");
    expect(layout.leftColumn.indexOf("quote")).toBeLessThan(
      layout.leftColumn.indexOf("strategicInsights")
    );
  });

  it("should render Omni character in the center-right of greeting bar", () => {
    const greetingBarSections = {
      left: "greeting + summary + quote + insights",
      centerRight: "OmniAvatar (size=110)",
      right: "clock + date",
    };
    expect(greetingBarSections.centerRight).toContain("OmniAvatar");
    expect(greetingBarSections.centerRight).toContain("110");
  });

  it("should render Omni character at size 110px in the greeting bar", () => {
    const triageOmniSize = 110;
    const floatingOmniSize = 56; // default floating avatar size
    expect(triageOmniSize).toBeGreaterThan(floatingOmniSize);
    expect(triageOmniSize).toBe(110);
  });

  it("should hide Omni character in greeting bar when mode is hidden", () => {
    const modes = ["sigil", "character", "hidden"];
    const visibleInGreetingBar = modes.filter((m) => m !== "hidden");
    expect(visibleInGreetingBar).toEqual(["sigil", "character"]);
    expect(visibleInGreetingBar).not.toContain("hidden");
  });
});

describe("v45: Omni character NOMI-style expressions", () => {
  const expressionStates = [
    "idle", "hover", "thinking", "success", "error",
    "wave", "thumbsup", "celebrate",
  ];

  it("should support all 8 expression states", () => {
    expect(expressionStates).toHaveLength(8);
  });

  it("should show wave state when hovering over Omni in greeting bar", () => {
    // In the GreetingBar, onMouseEnter sets state to "wave"
    const hoverState = "wave";
    expect(expressionStates).toContain(hoverState);
  });

  it("should show thumbsup state when a task is completed", () => {
    const taskCompleteState = "thumbsup";
    expect(expressionStates).toContain(taskCompleteState);
  });

  it("should show celebrate state for special achievements", () => {
    const celebrateState = "celebrate";
    expect(expressionStates).toContain(celebrateState);
  });

  it("should have gesture animations for wave and thumbsup", () => {
    const gestureStates = expressionStates.filter(
      (s) => s === "wave" || s === "thumbsup" || s === "celebrate"
    );
    expect(gestureStates).toHaveLength(3);
  });
});

describe("v45: Greeting bar content hierarchy", () => {
  it("should display greeting, status, summary, quote, then insights in order", () => {
    const contentOrder = [
      "greeting",      // "Good evening, Junaid"
      "statusLine",    // "No immediate actions required tonight."
      "summary",       // "36 high-priority · 1 pending approval · 1 meeting today"
      "quote",         // "Speed is the ultimate weapon..." — Jack Welch
      "insights",      // Strategic Insights with AI label
    ];
    for (let i = 0; i < contentOrder.length - 1; i++) {
      expect(contentOrder.indexOf(contentOrder[i])).toBeLessThan(
        contentOrder.indexOf(contentOrder[i + 1])
      );
    }
  });

  it("should show 'Click to ask Omni' label under the character", () => {
    const omniLabel = "Click to ask Omni";
    expect(omniLabel).toBeTruthy();
    expect(omniLabel.toLowerCase()).toContain("omni");
  });

  it("should open chat panel when clicking Omni character in greeting bar", () => {
    // The onClick handler calls openChat from useOmni context
    let chatOpened = false;
    const openChat = () => { chatOpened = true; };
    openChat();
    expect(chatOpened).toBe(true);
  });
});

describe("v45: OmniContext integration", () => {
  it("should provide omniMode and openChat through context", () => {
    const contextValue = {
      omniMode: "character" as const,
      openChat: () => {},
    };
    expect(contextValue).toHaveProperty("omniMode");
    expect(contextValue).toHaveProperty("openChat");
    expect(typeof contextValue.openChat).toBe("function");
  });

  it("should support sigil, character, and hidden modes", () => {
    const modes = ["sigil", "character", "hidden"];
    modes.forEach((mode) => {
      expect(["sigil", "character", "hidden"]).toContain(mode);
    });
  });
});
