import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Star,
  Mail,
  UserPlus,
  Building2,
  Calendar,
  Flame,
  Loader2,
  Check,
  Timer,
  ArrowRight,
  Sparkles,
  ListTodo,
  Users,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";

// ─── Priority badge ────────────────────────────────────────────────────────
function PriorityBadge({ priority }: { priority: string }) {
  const config = {
    high: { bg: "bg-red-500/20", text: "text-red-400", label: "High" },
    medium: { bg: "bg-yellow-500/15", text: "text-yellow-500", label: "Med" },
    low: { bg: "bg-zinc-500/20", text: "text-zinc-400", label: "Low" },
  };
  const c = config[priority as keyof typeof config] || config.medium;
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

// ─── Task card (grid item) ─────────────────────────────────────────────────
function TaskCard({
  task,
  showOverdue,
  onComplete,
  onSnooze,
  isActing,
}: {
  task: {
    id: number;
    title: string;
    priority: string;
    dueDate: any;
    assignedName: string | null;
    category: string | null;
    status: string;
  };
  showOverdue?: boolean;
  onComplete: (id: number) => void;
  onSnooze: (id: number) => void;
  isActing: boolean;
}) {
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const now = new Date();
  const isOverdue = dueDate && dueDate < new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysOverdue = dueDate
    ? Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Clean up title — strip "(Assigned to: ...)" suffix
  const cleanTitle = task.title.replace(/\s*\(Assigned to:.*?\)\s*$/, "");

  return (
    <div className="group relative bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-4 hover:border-zinc-700/60 hover:bg-zinc-900/80 transition-all duration-200">
      {/* Top row: priority + overdue badge */}
      <div className="flex items-center gap-2 mb-2">
        <PriorityBadge priority={task.priority} />
        {showOverdue && isOverdue && daysOverdue > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-950/50 text-red-400 font-medium">
            {daysOverdue}d overdue
          </span>
        )}
        {dueDate && !isOverdue && (
          <span className="text-[10px] text-zinc-500">
            {dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}
        {task.category && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 ml-auto">
            {task.category}
          </span>
        )}
      </div>

      {/* Title */}
      <Link href="/operations">
        <p className="text-sm text-zinc-200 leading-relaxed line-clamp-2 hover:text-white transition-colors cursor-pointer mb-3">
          {cleanTitle}
        </p>
      </Link>

      {/* Bottom row: assignee + actions */}
      <div className="flex items-center justify-between">
        {task.assignedName ? (
          <span className="text-[11px] text-zinc-500 truncate max-w-[140px]">
            {task.assignedName}
          </span>
        ) : (
          <span className="text-[11px] text-zinc-600 italic">Unassigned</span>
        )}

        {/* Inline actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onComplete(task.id); }}
            disabled={isActing}
            className="p-1.5 rounded-lg hover:bg-emerald-950/50 text-zinc-500 hover:text-emerald-400 transition-colors"
            title="Mark complete"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onSnooze(task.id); }}
            disabled={isActing}
            className="p-1.5 rounded-lg hover:bg-yellow-950/50 text-zinc-500 hover:text-yellow-400 transition-colors"
            title="Snooze 1 day"
          >
            <Timer className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Meeting card (grid item) ──────────────────────────────────────────────
function MeetingCard({
  meeting,
}: {
  meeting: {
    id: number;
    title: string | null;
    meetingDate: any;
    primaryLead: string;
    executiveSummary: string;
  };
}) {
  const date = new Date(meeting.meetingDate);
  const isToday = new Date().toDateString() === date.toDateString();
  const isYesterday = new Date(Date.now() - 86400000).toDateString() === date.toDateString();
  const dateLabel = isToday ? "Today" : isYesterday ? "Yesterday" : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <Link href={`/meeting/${meeting.id}`}>
      <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-4 hover:border-zinc-700/60 hover:bg-zinc-900/80 transition-all duration-200 cursor-pointer group h-full">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="h-3.5 w-3.5 text-emerald-500/70" />
          <span className="text-[10px] text-zinc-500 font-medium">{dateLabel}</span>
        </div>
        <p className="text-sm text-zinc-200 font-medium group-hover:text-white transition-colors line-clamp-1 mb-1.5">
          {meeting.title || "Untitled Meeting"}
        </p>
        <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
          {meeting.executiveSummary?.slice(0, 120)}
          {(meeting.executiveSummary?.length ?? 0) > 120 ? "..." : ""}
        </p>
      </div>
    </Link>
  );
}

// ─── Section wrapper ───────────────────────────────────────────────────────
function Section({
  icon,
  title,
  count,
  accentColor,
  linkTo,
  linkLabel,
  children,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  accentColor: string;
  linkTo?: string;
  linkLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-lg ${accentColor}`}>{icon}</div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {count !== undefined && count > 0 && (
            <span className="text-xs text-zinc-500 font-mono bg-zinc-800/50 px-1.5 py-0.5 rounded">
              {count}
            </span>
          )}
        </div>
        {linkTo && (
          <Link href={linkTo}>
            <span className="text-xs text-zinc-500 hover:text-yellow-500 transition-colors flex items-center gap-1 cursor-pointer">
              {linkLabel || "View all"} <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Stat card ─────────────────────────────────────────────────────────────
function StatCard({
  icon,
  label,
  value,
  color,
  linkTo,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  linkTo?: string;
}) {
  const inner = (
    <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-xl px-4 py-3 flex items-center gap-3 hover:border-zinc-700/50 transition-colors cursor-pointer">
      <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
      <div>
        <div className="text-lg font-bold font-mono text-white">{value}</div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</div>
      </div>
    </div>
  );
  return linkTo ? <Link href={linkTo}>{inner}</Link> : inner;
}

// ─── Main Triage Feed ──────────────────────────────────────────────────────
export default function TriageFeed() {
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.triage.feed.useQuery();
  const [actingTaskIds, setActingTaskIds] = useState<Set<number>>(new Set());

  const completeMutation = trpc.triage.completeTask.useMutation({
    onMutate: ({ taskId }) => {
      setActingTaskIds((prev) => new Set(prev).add(taskId));
    },
    onSuccess: (_, { taskId }) => {
      toast.success("Task completed");
      setActingTaskIds((prev) => { const next = new Set(prev); next.delete(taskId); return next; });
      utils.triage.feed.invalidate();
    },
    onError: (_, { taskId }) => {
      setActingTaskIds((prev) => { const next = new Set(prev); next.delete(taskId); return next; });
      toast.error("Could not complete task");
    },
  });

  const snoozeMutation = trpc.triage.snoozeTask.useMutation({
    onMutate: ({ taskId }) => {
      setActingTaskIds((prev) => new Set(prev).add(taskId));
    },
    onSuccess: (_, { taskId }) => {
      toast.success("Task snoozed to tomorrow");
      setActingTaskIds((prev) => { const next = new Set(prev); next.delete(taskId); return next; });
      utils.triage.feed.invalidate();
    },
    onError: (_, { taskId }) => {
      setActingTaskIds((prev) => { const next = new Set(prev); next.delete(taskId); return next; });
      toast.error("Could not snooze task");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-yellow-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500">
        Failed to load triage feed
      </div>
    );
  }

  const { summary } = data;
  const hasOverdue = data.overdueTasks.length > 0;
  const hasTodayTasks = data.todayTasks.length > 0;
  const hasHighPriority = data.highPriorityTasks.length > 0;
  const hasStarredEmails = data.starredEmails.length > 0;
  const hasPendingContacts = data.pendingContacts.length > 0;
  const hasPendingCompanies = data.pendingCompanies.length > 0;
  const hasRecentMeetings = data.recentMeetings.length > 0;
  const nothingToTriage =
    !hasOverdue && !hasTodayTasks && !hasHighPriority && !hasStarredEmails && !hasPendingContacts && !hasPendingCompanies;

  // Time-based sub-greeting
  const hour = new Date().getHours();
  const subGreeting = hour < 12
    ? "Here's what needs your attention this morning."
    : hour < 17
    ? "Here's what's on your plate this afternoon."
    : "Here's a summary of what still needs attention.";

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-8">
      {/* ── Personal greeting ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            {data.greeting}, <span className="text-yellow-500">{data.userName}</span>
          </h1>
          <p className="text-sm text-zinc-500 mt-1">{subGreeting}</p>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-xs text-zinc-600">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* ── Quick stats row ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          icon={<ListTodo className="h-4 w-4 text-zinc-300" />}
          label="Open Tasks"
          value={summary.totalOpen}
          color="bg-zinc-800/60"
          linkTo="/operations"
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4 text-red-400" />}
          label="Overdue"
          value={summary.totalOverdue}
          color="bg-red-950/40"
          linkTo="/operations"
        />
        <StatCard
          icon={<Flame className="h-4 w-4 text-yellow-400" />}
          label="High Priority"
          value={summary.totalHighPriority}
          color="bg-yellow-950/40"
          linkTo="/operations"
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
          label="Done Today"
          value={summary.completedToday}
          color="bg-emerald-950/40"
        />
        <StatCard
          icon={<Star className="h-4 w-4 text-yellow-400" />}
          label="Starred Mail"
          value={summary.totalStarred}
          color="bg-yellow-950/40"
          linkTo="/communications"
        />
        <StatCard
          icon={<Users className="h-4 w-4 text-blue-400" />}
          label="Pending"
          value={summary.totalPendingApprovals}
          color="bg-blue-950/40"
          linkTo="/relationships"
        />
      </div>

      {/* ── All clear state ───────────────────────────────────────────── */}
      {nothingToTriage && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 rounded-full bg-emerald-950/30 border border-emerald-800/30 mb-4">
            <Sparkles className="h-8 w-8 text-emerald-500" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">All Clear</h3>
          <p className="text-sm text-zinc-500 max-w-sm">
            Nothing requires your immediate attention. Check back later or review
            the overview for a broader picture.
          </p>
        </div>
      )}

      {/* ── Overdue tasks (grid) ──────────────────────────────────────── */}
      {hasOverdue && (
        <Section
          icon={<AlertTriangle className="h-4 w-4 text-red-400" />}
          title="Overdue"
          count={data.overdueTasks.length}
          accentColor="bg-red-950/40"
          linkTo="/operations"
          className="bg-red-950/5 border border-red-900/15 rounded-2xl p-5"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {data.overdueTasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                showOverdue
                onComplete={(id) => completeMutation.mutate({ taskId: id })}
                onSnooze={(id) => snoozeMutation.mutate({ taskId: id, days: 1 })}
                isActing={actingTaskIds.has(t.id)}
              />
            ))}
          </div>
        </Section>
      )}

      {/* ── Due today (grid) ──────────────────────────────────────────── */}
      {hasTodayTasks && (
        <Section
          icon={<Clock className="h-4 w-4 text-yellow-500" />}
          title="Due Today"
          count={data.todayTasks.length}
          accentColor="bg-yellow-950/40"
          linkTo="/operations"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {data.todayTasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                onComplete={(id) => completeMutation.mutate({ taskId: id })}
                onSnooze={(id) => snoozeMutation.mutate({ taskId: id, days: 1 })}
                isActing={actingTaskIds.has(t.id)}
              />
            ))}
          </div>
        </Section>
      )}

      {/* ── Two-column layout: High Priority + Starred/Approvals ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* High priority */}
        {hasHighPriority && (
          <Section
            icon={<Flame className="h-4 w-4 text-orange-400" />}
            title="High Priority"
            count={data.highPriorityTasks.length}
            accentColor="bg-orange-950/40"
            linkTo="/operations"
          >
            <div className="space-y-2">
              {data.highPriorityTasks.slice(0, 6).map((t) => {
                const cleanTitle = t.title.replace(/\s*\(Assigned to:.*?\)\s*$/, "");
                return (
                  <div key={t.id} className="group flex items-center gap-3 bg-zinc-900/50 border border-zinc-800/40 rounded-lg px-3 py-2.5 hover:border-zinc-700/50 transition-colors">
                    <PriorityBadge priority={t.priority} />
                    <Link href="/operations">
                      <span className="text-sm text-zinc-200 truncate flex-1 hover:text-white transition-colors cursor-pointer">
                        {cleanTitle}
                      </span>
                    </Link>
                    {t.assignedName && (
                      <span className="text-[10px] text-zinc-500 shrink-0 hidden sm:inline">{t.assignedName}</span>
                    )}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => completeMutation.mutate({ taskId: t.id })}
                        disabled={actingTaskIds.has(t.id)}
                        className="p-1 rounded hover:bg-emerald-950/50 text-zinc-500 hover:text-emerald-400 transition-colors"
                        title="Complete"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Starred emails + Pending approvals column */}
        <div className="space-y-6">
          {hasStarredEmails && (
            <Section
              icon={<Star className="h-4 w-4 text-yellow-500" />}
              title="Starred Emails"
              count={data.starredEmails.length}
              accentColor="bg-yellow-950/40"
              linkTo="/communications"
            >
              <div className="space-y-2">
                {data.starredEmails.map((s) => {
                  const starLabels: Record<number, string> = { 1: "Reply Today", 2: "Delegate", 3: "Critical" };
                  const starColors: Record<number, string> = { 1: "text-yellow-500", 2: "text-orange-400", 3: "text-red-400" };
                  return (
                    <Link key={s.threadId} href="/communications">
                      <div className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800/40 rounded-lg px-3 py-2.5 hover:border-zinc-700/50 transition-colors cursor-pointer">
                        <Mail className="h-3.5 w-3.5 text-zinc-500" />
                        <span className="text-sm text-zinc-300 truncate flex-1 font-mono">
                          {s.threadId.slice(0, 16)}...
                        </span>
                        <span className={`text-xs ${starColors[s.starLevel] || "text-zinc-400"}`}>
                          {"★".repeat(s.starLevel)} {starLabels[s.starLevel] || ""}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </Section>
          )}

          {(hasPendingContacts || hasPendingCompanies) && (
            <Section
              icon={<UserPlus className="h-4 w-4 text-blue-400" />}
              title="Pending Approvals"
              count={data.pendingContacts.length + data.pendingCompanies.length}
              accentColor="bg-blue-950/40"
              linkTo="/relationships"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {data.pendingContacts.map((c) => (
                  <Link key={`c-${c.id}`} href={`/contact/${c.id}`}>
                    <div className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800/40 rounded-lg px-3 py-2.5 hover:border-zinc-700/50 transition-colors cursor-pointer">
                      <UserPlus className="h-3.5 w-3.5 text-blue-400/60" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-zinc-200 truncate">{c.name}</p>
                        {c.organization && <p className="text-[10px] text-zinc-500 truncate">{c.organization}</p>}
                      </div>
                    </div>
                  </Link>
                ))}
                {data.pendingCompanies.map((c) => (
                  <Link key={`co-${c.id}`} href={`/company/${c.id}`}>
                    <div className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800/40 rounded-lg px-3 py-2.5 hover:border-zinc-700/50 transition-colors cursor-pointer">
                      <Building2 className="h-3.5 w-3.5 text-purple-400/60" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-zinc-200 truncate">{c.name}</p>
                        {c.sector && <p className="text-[10px] text-zinc-500 truncate">{c.sector}</p>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </Section>
          )}

          {/* If no starred or pending, show placeholder */}
          {!hasStarredEmails && !hasPendingContacts && !hasPendingCompanies && hasHighPriority && (
            <div className="bg-zinc-900/30 border border-zinc-800/30 rounded-xl p-6 flex flex-col items-center justify-center text-center">
              <BarChart3 className="h-6 w-6 text-zinc-600 mb-2" />
              <p className="text-xs text-zinc-500">No starred emails or pending approvals</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Recent meetings (grid) ────────────────────────────────────── */}
      {hasRecentMeetings && (
        <Section
          icon={<Calendar className="h-4 w-4 text-emerald-400" />}
          title="Recent Intelligence"
          count={data.recentMeetings.length}
          accentColor="bg-emerald-950/40"
          linkTo="/intelligence"
          linkLabel="All meetings"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {data.recentMeetings.map((m) => (
              <MeetingCard key={m.id} meeting={m} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
