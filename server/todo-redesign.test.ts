import { describe, it, expect } from "vitest";

// ============================================================================
// TO-DO REDESIGN TESTS
// Tests for the compact layout logic, focus filtering, and task operations
// ============================================================================

// ── Focus Filter Logic ────────────────────────────────────────────────────

describe("Focus Filter Logic", () => {
  const today = new Date(2026, 1, 18); // Feb 18 local
  
  const tasks = [
    { id: 1, title: "Overdue task", dueDate: new Date(2026, 1, 16), status: "open", priority: "high" },
    { id: 2, title: "Due today", dueDate: new Date(2026, 1, 18), status: "open", priority: "medium" },
    { id: 3, title: "Due tomorrow", dueDate: new Date(2026, 1, 19), status: "open", priority: "low" },
    { id: 4, title: "Due this week", dueDate: new Date(2026, 1, 21), status: "open", priority: "medium" },
    { id: 5, title: "Due next month", dueDate: new Date(2026, 2, 5), status: "open", priority: "low" },
    { id: 6, title: "No due date", dueDate: null, status: "open", priority: "medium" },
    { id: 7, title: "Completed", dueDate: new Date(2026, 1, 17), status: "completed", priority: "high" },
    { id: 8, title: "High priority no date", dueDate: null, status: "open", priority: "high" },
  ];

  function filterByFocus(tasks: any[], focus: "today" | "week" | "all", referenceDate: Date) {
    const todayStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    
    if (focus === "all") return tasks;
    
    return tasks.filter(t => {
      if (t.status === "completed") return false;
      if (!t.dueDate) {
        // Show high priority tasks with no date in "today" focus
        return focus === "today" ? t.priority === "high" : true;
      }
      const due = new Date(t.dueDate);
      if (due < todayStart) return true; // Always show overdue
      if (focus === "today") return due < todayEnd;
      if (focus === "week") return due < weekEnd;
      return true;
    });
  }

  it("today focus shows overdue + due today + high priority without date", () => {
    const result = filterByFocus(tasks, "today", today);
    expect(result.map(t => t.id)).toEqual([1, 2, 8]);
  });

  it("week focus shows overdue + due within 7 days + no-date tasks", () => {
    const result = filterByFocus(tasks, "week", today);
    // Should include: overdue(1), today(2), tomorrow(3), this week(4), no-date(6,8)
    // Should exclude: next month(5), completed(7)
    expect(result.map(t => t.id)).toContain(1);
    expect(result.map(t => t.id)).toContain(2);
    expect(result.map(t => t.id)).toContain(3);
    expect(result.map(t => t.id)).toContain(4);
    expect(result.map(t => t.id)).not.toContain(7); // completed excluded
  });

  it("all focus shows everything including completed", () => {
    const result = filterByFocus(tasks, "all", today);
    expect(result.length).toBe(8);
  });

  it("today focus excludes completed tasks", () => {
    const result = filterByFocus(tasks, "today", today);
    expect(result.find(t => t.status === "completed")).toBeUndefined();
  });

  it("overdue tasks always appear in today and week focus", () => {
    const todayResult = filterByFocus(tasks, "today", today);
    const weekResult = filterByFocus(tasks, "week", today);
    expect(todayResult.find(t => t.id === 1)).toBeDefined();
    expect(weekResult.find(t => t.id === 1)).toBeDefined();
  });
});

// ── Task Stats Computation ────────────────────────────────────────────────

describe("Task Stats Computation", () => {
  const tasks = [
    { status: "open", priority: "high", dueDate: "2026-02-16" },
    { status: "open", priority: "high", dueDate: "2026-02-18" },
    { status: "open", priority: "medium", dueDate: "2026-02-20" },
    { status: "open", priority: "low", dueDate: null },
    { status: "in_progress", priority: "high", dueDate: "2026-02-15" },
    { status: "completed", priority: "medium", dueDate: "2026-02-17" },
    { status: "completed", priority: "low", dueDate: "2026-02-14" },
  ];

  function computeStats(tasks: any[], referenceDate: Date) {
    const todayStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
    let open = 0, overdue = 0, highPriority = 0, completed = 0;
    
    for (const t of tasks) {
      if (t.status === "completed") {
        completed++;
        continue;
      }
      open++;
      if (t.priority === "high") highPriority++;
      if (t.dueDate) {
        const due = new Date(t.dueDate);
        if (due < todayStart) overdue++;
      }
    }
    
    return { open, overdue, highPriority, completed, total: tasks.length };
  }

  it("counts open tasks correctly (excludes completed)", () => {
    const stats = computeStats(tasks, new Date("2026-02-18"));
    expect(stats.open).toBe(5);
  });

  it("counts overdue tasks correctly", () => {
    const stats = computeStats(tasks, new Date("2026-02-18"));
    expect(stats.overdue).toBe(2); // Feb 16 and Feb 15
  });

  it("counts high priority tasks correctly", () => {
    const stats = computeStats(tasks, new Date("2026-02-18"));
    expect(stats.highPriority).toBe(3);
  });

  it("counts completed tasks correctly", () => {
    const stats = computeStats(tasks, new Date("2026-02-18"));
    expect(stats.completed).toBe(2);
  });

  it("total equals open + completed", () => {
    const stats = computeStats(tasks, new Date("2026-02-18"));
    expect(stats.total).toBe(stats.open + stats.completed);
  });

  it("handles empty task list", () => {
    const stats = computeStats([], new Date("2026-02-18"));
    expect(stats).toEqual({ open: 0, overdue: 0, highPriority: 0, completed: 0, total: 0 });
  });
});

// ── Task Sorting Logic ────────────────────────────────────────────────────

describe("Task Sorting Logic", () => {
  const tasks = [
    { id: 1, title: "Low no date", priority: "low", dueDate: null, status: "open" },
    { id: 2, title: "High overdue", priority: "high", dueDate: "2026-02-15", status: "open" },
    { id: 3, title: "Medium today", priority: "medium", dueDate: "2026-02-18", status: "open" },
    { id: 4, title: "High tomorrow", priority: "high", dueDate: "2026-02-19", status: "open" },
    { id: 5, title: "Completed", priority: "high", dueDate: "2026-02-16", status: "completed" },
  ];

  function sortTasks(tasks: any[]) {
    const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };
    
    return [...tasks].sort((a, b) => {
      // Completed always last
      if (a.status === "completed" && b.status !== "completed") return 1;
      if (b.status === "completed" && a.status !== "completed") return -1;
      
      // Then by priority (high first)
      const pa = priorityWeight[a.priority] || 0;
      const pb = priorityWeight[b.priority] || 0;
      if (pa !== pb) return pb - pa;
      
      // Then by due date (earliest first, null last)
      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;
      
      return 0;
    });
  }

  it("sorts completed tasks to the end", () => {
    const sorted = sortTasks(tasks);
    expect(sorted[sorted.length - 1].status).toBe("completed");
  });

  it("sorts high priority before medium and low", () => {
    const sorted = sortTasks(tasks);
    const openTasks = sorted.filter(t => t.status !== "completed");
    expect(openTasks[0].priority).toBe("high");
    expect(openTasks[1].priority).toBe("high");
  });

  it("sorts earlier due dates first within same priority", () => {
    const sorted = sortTasks(tasks);
    const highTasks = sorted.filter(t => t.priority === "high" && t.status !== "completed");
    expect(highTasks[0].id).toBe(2); // Feb 15 before Feb 19
    expect(highTasks[1].id).toBe(4);
  });

  it("sorts tasks without due date after tasks with due date", () => {
    const sorted = sortTasks(tasks);
    const openTasks = sorted.filter(t => t.status !== "completed");
    const lastOpen = openTasks[openTasks.length - 1];
    expect(lastOpen.dueDate).toBeNull();
  });
});

// ── Search Filtering ──────────────────────────────────────────────────────

describe("Task Search Filtering", () => {
  const tasks = [
    { id: 1, title: "Review contract for Dubai deal", assignedName: "Kyle", category: "Legal" },
    { id: 2, title: "Send pitch deck to investors", assignedName: "Jake", category: "Capital" },
    { id: 3, title: "Schedule meeting with Zulfiqar", assignedName: "Junaid", category: "Operations" },
    { id: 4, title: "Update CRM contacts", assignedName: "Kyle", category: "CRM" },
  ];

  function searchTasks(tasks: any[], query: string) {
    if (!query.trim()) return tasks;
    const q = query.toLowerCase();
    return tasks.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.assignedName && t.assignedName.toLowerCase().includes(q)) ||
      (t.category && t.category.toLowerCase().includes(q))
    );
  }

  it("filters by title keyword", () => {
    const result = searchTasks(tasks, "pitch");
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(2);
  });

  it("filters by assignee name", () => {
    const result = searchTasks(tasks, "kyle");
    expect(result.length).toBe(2);
  });

  it("filters by category", () => {
    const result = searchTasks(tasks, "legal");
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(1);
  });

  it("returns all tasks for empty query", () => {
    const result = searchTasks(tasks, "");
    expect(result.length).toBe(4);
  });

  it("returns empty for no match", () => {
    const result = searchTasks(tasks, "nonexistent");
    expect(result.length).toBe(0);
  });

  it("is case insensitive", () => {
    const result = searchTasks(tasks, "DUBAI");
    expect(result.length).toBe(1);
  });
});

// ── Compact Row Formatting ────────────────────────────────────────────────

describe("Compact Row Formatting", () => {
  function formatDueDate(dueDate: string | null, referenceDate: Date): { label: string; isOverdue: boolean } {
    if (!dueDate) return { label: "", isOverdue: false };
    
    // Parse as local date to avoid UTC offset issues
    const parts = dueDate.split('-').map(Number);
    const due = new Date(parts[0], parts[1] - 1, parts[2]);
    const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
    
    const isOverdue = due < today;
    
    if (isOverdue) {
      const daysAgo = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      return { label: `${daysAgo}d overdue`, isOverdue: true };
    }
    
    if (due.getTime() === today.getTime()) return { label: "Today", isOverdue: false };
    if (due.getTime() === tomorrow.getTime()) return { label: "Tomorrow", isOverdue: false };
    
    return { label: due.toLocaleDateString("en-US", { month: "short", day: "numeric" }), isOverdue: false };
  }

  it("shows 'Today' for tasks due today", () => {
    const ref = new Date(2026, 1, 18); // Feb 18 local
    const result = formatDueDate(new Date(2026, 1, 18).toISOString().split('T')[0], ref);
    expect(result.label).toBe("Today");
    expect(result.isOverdue).toBe(false);
  });

  it("shows 'Tomorrow' for tasks due tomorrow", () => {
    const ref = new Date(2026, 1, 18);
    const result = formatDueDate(new Date(2026, 1, 19).toISOString().split('T')[0], ref);
    expect(result.label).toBe("Tomorrow");
    expect(result.isOverdue).toBe(false);
  });

  it("shows overdue days for past due tasks", () => {
    const ref = new Date(2026, 1, 18);
    const due = new Date(2026, 1, 15);
    const result = formatDueDate(due.toISOString().split('T')[0], ref);
    expect(result.isOverdue).toBe(true);
    expect(result.label).toMatch(/overdue/);
  });

  it("shows formatted date for future tasks", () => {
    const ref = new Date(2026, 1, 18);
    const due = new Date(2026, 2, 5); // Mar 5 local
    const result = formatDueDate(due.toISOString().split('T')[0], ref);
    expect(result.isOverdue).toBe(false);
    expect(result.label).toMatch(/Mar/);
  });

  it("returns empty for null due date", () => {
    const result = formatDueDate(null, new Date(2026, 1, 18));
    expect(result.label).toBe("");
    expect(result.isOverdue).toBe(false);
  });

  function getInitials(name: string): string {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  }

  it("generates correct initials from full name", () => {
    expect(getInitials("Jake Ryan")).toBe("JR");
    expect(getInitials("Kyle")).toBe("K");
    expect(getInitials("Junaid Qureshi")).toBe("JQ");
  });
});

// ── Kanban Column Logic ───────────────────────────────────────────────────

describe("Kanban Column Logic", () => {
  const tasks = [
    { id: 1, status: "open", priority: "high" },
    { id: 2, status: "open", priority: "low" },
    { id: 3, status: "in_progress", priority: "medium" },
    { id: 4, status: "in_progress", priority: "high" },
    { id: 5, status: "completed", priority: "medium" },
    { id: 6, status: "completed", priority: "low" },
  ];

  function groupByStatus(tasks: any[]) {
    const groups: Record<string, any[]> = { open: [], in_progress: [], completed: [] };
    for (const t of tasks) {
      if (groups[t.status]) groups[t.status].push(t);
    }
    return groups;
  }

  it("groups tasks by status correctly", () => {
    const groups = groupByStatus(tasks);
    expect(groups.open.length).toBe(2);
    expect(groups.in_progress.length).toBe(2);
    expect(groups.completed.length).toBe(2);
  });

  it("preserves all tasks in grouping", () => {
    const groups = groupByStatus(tasks);
    const total = groups.open.length + groups.in_progress.length + groups.completed.length;
    expect(total).toBe(tasks.length);
  });
});

// ── Quick Add Validation ──────────────────────────────────────────────────

describe("Quick Add Validation", () => {
  function validateQuickAdd(title: string): { valid: boolean; error?: string } {
    const trimmed = title.trim();
    if (!trimmed) return { valid: false, error: "Title is required" };
    if (trimmed.length > 500) return { valid: false, error: "Title too long (max 500)" };
    return { valid: true };
  }

  it("accepts valid title", () => {
    expect(validateQuickAdd("Review contract").valid).toBe(true);
  });

  it("rejects empty title", () => {
    const result = validateQuickAdd("");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Title is required");
  });

  it("rejects whitespace-only title", () => {
    const result = validateQuickAdd("   ");
    expect(result.valid).toBe(false);
  });

  it("rejects title over 500 characters", () => {
    const result = validateQuickAdd("a".repeat(501));
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Title too long (max 500)");
  });

  it("accepts title at exactly 500 characters", () => {
    expect(validateQuickAdd("a".repeat(500)).valid).toBe(true);
  });
});
