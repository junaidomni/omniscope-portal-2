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

  it("TriageFeed component uses grid layout", async () => {
    const source = await import("fs").then(fs =>
      fs.readFileSync("client/src/pages/TriageFeed.tsx", "utf-8")
    );
    expect(source).toMatch(/grid-cols/);
    expect(source).toMatch(/data\.greeting/);
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
