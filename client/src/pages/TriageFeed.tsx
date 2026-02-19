import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { useState, useEffect, useMemo, useCallback } from "react";
import OmniAvatar from "@/components/OmniAvatar";
import { useOmni } from "@/components/PortalLayout";
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
  Sun,
  Moon,
  Sunrise,
  ChevronRight,
  Trophy,
  CalendarDays,
  Inbox,
  X,
  Trash2,
  Edit3,
  Shield,
  ShieldX,
  Brain,
  Zap,
  Quote,
  Eye,
  EyeOff,
  ChevronDown,
  MailOpen,
  Filter,
} from "lucide-react";
import { toast } from "sonner";

// ─── Live clock hook ──────────────────────────────────────────────────────
function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// ─── Time-aware greeting (uses browser local time) ────────────────────────
function getGreeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getTimeIcon(hour: number) {
  if (hour < 6) return <Moon className="h-5 w-5 text-indigo-400" />;
  if (hour < 12) return <Sunrise className="h-5 w-5 text-amber-400" />;
  if (hour < 17) return <Sun className="h-5 w-5 text-yellow-400" />;
  return <Moon className="h-5 w-5 text-indigo-400" />;
}

// ─── Contextual status line based on workload ─────────────────────────────
function getStatusLine(data: any, hour: number) {
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

// ─── Situational summary (natural language briefing) ──────────────────────
function getSituationalSummary(data: any, hour: number) {
  const { summary } = data;
  const parts: string[] = [];

  if (summary.totalOverdue > 0) {
    parts.push(`${summary.totalOverdue} overdue task${summary.totalOverdue > 1 ? "s" : ""}`);
  }
  if (data.todayTasks?.length > 0) {
    parts.push(`${data.todayTasks.length} due today`);
  }
  if (summary.totalHighPriority > 0 && summary.totalOverdue === 0) {
    parts.push(`${summary.totalHighPriority} high-priority`);
  }
  if (summary.totalPendingApprovals > 0) {
    parts.push(`${summary.totalPendingApprovals} pending approval${summary.totalPendingApprovals > 1 ? "s" : ""}`);
  }
  if (data.recentMeetings?.length > 0) {
    const todayMeetings = data.recentMeetings.filter((m: any) => new Date(m.meetingDate).toDateString() === new Date().toDateString());
    if (todayMeetings.length > 0) {
      parts.push(`${todayMeetings.length} meeting${todayMeetings.length > 1 ? "s" : ""} today`);
    }
  }
  if (data.tomorrowTasks?.length > 0) {
    parts.push(`${data.tomorrowTasks.length} tomorrow`);
  }

  if (parts.length === 0) {
    if (hour >= 22 || hour < 6) return "Everything is quiet. Rest well.";
    return "All clear. Nothing requires your attention.";
  }

  return parts.join(" · ");
}

// ─── Quotes system ────────────────────────────────────────────────────────
const QUOTES = {
  strategic: [
    { text: "Focus is saying no to a thousand things.", author: "Steve Jobs" },
    { text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
    { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
    { text: "Strategy without tactics is the slowest route to victory.", author: "Sun Tzu" },
    { text: "Speed is the ultimate weapon in business.", author: "Jack Welch" },
  ],
  stoic: [
    { text: "You have power over your mind — not outside events.", author: "Marcus Aurelius" },
    { text: "The obstacle is the way.", author: "Marcus Aurelius" },
    { text: "Waste no more time arguing about what a good man should be. Be one.", author: "Marcus Aurelius" },
    { text: "He who fears death will never do anything worthy of a man who is alive.", author: "Seneca" },
    { text: "It is not that we have a short time to live, but that we waste a great deal of it.", author: "Seneca" },
  ],
  operational: [
    { text: "Plans are useless, but planning is indispensable.", author: "Dwight D. Eisenhower" },
    { text: "Execution is the chariot of genius.", author: "William Blake" },
    { text: "What gets measured gets managed.", author: "Peter Drucker" },
    { text: "Move fast and break things. Unless you are breaking stuff, you are not moving fast enough.", author: "Mark Zuckerberg" },
    { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  ],
};

function getDailyQuote() {
  const allQuotes = [...QUOTES.strategic, ...QUOTES.stoic, ...QUOTES.operational];
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return allQuotes[dayOfYear % allQuotes.length];
}

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

// ─── Task Quick Action Modal ──────────────────────────────────────────────
function TaskModal({
  task,
  onClose,
  onComplete,
  onDelete,
  onUpdate,
  onSnooze,
  isActing,
}: {
  task: { id: number; title: string; priority: string; dueDate: any; assignedName: string | null; category: string | null; status: string; notes?: string };
  onClose: () => void;
  onComplete: (id: number) => void;
  onDelete: (id: number) => void;
  onUpdate: (id: number, updates: any) => void;
  onSnooze: (id: number, days: number) => void;
  isActing: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title.replace(/\s*\(Assigned to:.*?\)\s*$/, ""));
  const [editPriority, setEditPriority] = useState(task.priority);
  const [editNotes, setEditNotes] = useState(task.notes || "");
  const [editCategory, setEditCategory] = useState(task.category || "");

  const handleSave = () => {
    onUpdate(task.id, {
      title: editTitle,
      priority: editPriority,
      notes: editNotes || null,
      category: editCategory || null,
    });
    setIsEditing(false);
  };

  const cleanTitle = task.title.replace(/\s*\(Assigned to:.*?\)\s*$/, "");
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <PriorityBadge priority={isEditing ? editPriority : task.priority} />
            <span className="text-xs text-zinc-500">
              {task.status === "completed" ? "Completed" : task.status === "in_progress" ? "In Progress" : "Open"}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pb-4 space-y-4">
          {isEditing ? (
            <>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-600"
                placeholder="Task title"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 block">Priority</label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-600"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 block">Category</label>
                  <input
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-600"
                    placeholder="e.g. OTC, Gold"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 block">Notes</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-600 resize-none"
                  placeholder="Add context or notes..."
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-black font-medium text-sm py-2 rounded-lg transition-colors"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <h3 className="text-base font-semibold text-white mb-1">{cleanTitle}</h3>
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  {dueDate && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  )}
                  {task.assignedName && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {task.assignedName}
                    </span>
                  )}
                  {task.category && (
                    <span className="bg-zinc-800 px-1.5 py-0.5 rounded text-[10px]">{task.category}</span>
                  )}
                </div>
              </div>
              {task.notes && (
                <p className="text-sm text-zinc-400 leading-relaxed bg-zinc-800/50 rounded-lg px-3 py-2">{task.notes}</p>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        {!isEditing && (
          <div className="flex items-center gap-2 px-5 pb-5">
            <button
              onClick={() => onComplete(task.id)}
              disabled={isActing}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm py-2.5 rounded-lg transition-colors"
            >
              {isActing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Complete
            </button>
            <button
              onClick={() => onSnooze(task.id, 1)}
              className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm py-2.5 px-4 rounded-lg transition-colors"
            >
              <Timer className="h-3.5 w-3.5" />
              Snooze
            </button>
            <button
              onClick={() => setIsEditing(true)}
              className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg transition-colors"
            >
              <Edit3 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete(task.id)}
              className="p-2.5 bg-zinc-800 hover:bg-red-950 text-zinc-500 hover:text-red-400 rounded-lg transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Approval Modal ──────────────────────────────────────────────────────
function ApprovalModal({
  item,
  type,
  onClose,
  onApprove,
  onReject,
  isActing,
}: {
  item: any;
  type: "contact" | "company";
  onClose: () => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  isActing: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            {type === "contact" ? (
              <UserPlus className="h-4 w-4 text-blue-400" />
            ) : (
              <Building2 className="h-4 w-4 text-purple-400" />
            )}
            <span className="text-xs text-zinc-500 uppercase tracking-wider">
              Pending {type}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pb-4">
          <h3 className="text-base font-semibold text-white mb-1">{item.name}</h3>
          {type === "contact" && item.organization && (
            <p className="text-xs text-zinc-500">{item.organization}</p>
          )}
          {type === "company" && item.sector && (
            <p className="text-xs text-zinc-500">{item.sector}</p>
          )}
        </div>

        <div className="flex items-center gap-2 px-5 pb-5">
          <button
            onClick={() => onApprove(item.id)}
            disabled={isActing}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm py-2.5 rounded-lg transition-colors"
          >
            <Shield className="h-3.5 w-3.5" />
            Approve
          </button>
          <button
            onClick={() => onReject(item.id)}
            disabled={isActing}
            className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-red-950 text-zinc-300 hover:text-red-400 font-medium text-sm py-2.5 rounded-lg transition-colors"
          >
            <ShieldX className="h-3.5 w-3.5" />
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Task card (for overdue + today) ──────────────────────────────────────
function TaskCard({
  task,
  showOverdue,
  onClick,
  onQuickComplete,
  isActing,
}: {
  task: { id: number; title: string; priority: string; dueDate: any; assignedName: string | null; category: string | null };
  showOverdue?: boolean;
  onClick?: () => void;
  onQuickComplete?: (id: number) => void;
  isActing?: boolean;
}) {
  const cleanTitle = task.title.replace(/\s*\(Assigned to:.*?\)\s*$/, "");
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;

  return (
    <div
      onClick={onClick}
      className="group bg-zinc-900/60 border border-zinc-800/40 rounded-xl p-3.5 hover:border-zinc-700/50 hover:bg-zinc-900/80 transition-all duration-200 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <PriorityBadge priority={task.priority} />
        {onQuickComplete && (
          <button
            onClick={(e) => { e.stopPropagation(); onQuickComplete(task.id); }}
            disabled={isActing}
            className="p-1 rounded hover:bg-emerald-950/50 text-zinc-600 hover:text-emerald-400 transition-colors opacity-0 group-hover:opacity-100"
            title="Complete"
          >
            {isActing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
      <p className="text-sm text-zinc-200 font-medium group-hover:text-white transition-colors line-clamp-2 mb-2">
        {cleanTitle}
      </p>
      <div className="flex items-center gap-2 text-[10px] text-zinc-500">
        {showOverdue && dueDate && (
          <span className="text-red-400 font-medium">
            {Math.ceil((Date.now() - dueDate.getTime()) / 86400000)}d overdue
          </span>
        )}
        {task.assignedName && <span className="truncate">{task.assignedName}</span>}
        {task.category && <span className="bg-zinc-800/60 px-1.5 py-0.5 rounded">{task.category}</span>}
      </div>
    </div>
  );
}

// ─── Compact task row (for tomorrow + week) ──────────────────────────────
function CompactTaskRow({
  task,
  showDate,
  onClick,
}: {
  task: { id: number; title: string; priority: string; dueDate: any; assignedName: string | null; category: string | null };
  showDate?: boolean;
  onClick?: () => void;
}) {
  const cleanTitle = task.title.replace(/\s*\(Assigned to:.*?\)\s*$/, "");
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;

  return (
    <div
      onClick={onClick}
      className="group flex items-center gap-3 bg-zinc-900/50 border border-zinc-800/40 rounded-lg px-3 py-2.5 hover:border-zinc-700/50 transition-colors cursor-pointer"
    >
      <PriorityBadge priority={task.priority} />
      <span className="text-sm text-zinc-200 truncate flex-1 group-hover:text-white transition-colors">
        {cleanTitle}
      </span>
      {showDate && dueDate && (
        <span className="text-[10px] text-zinc-500 shrink-0">
          {dueDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
        </span>
      )}
      {task.assignedName && (
        <span className="text-[10px] text-zinc-500 shrink-0 hidden sm:inline">{task.assignedName}</span>
      )}
      <ChevronRight className="h-3 w-3 text-zinc-700 group-hover:text-zinc-500 transition-colors shrink-0" />
    </div>
  );
}

// ─── Completed task row ───────────────────────────────────────────────────
function CompletedRow({
  task,
}: {
  task: { id: number; title: string; assignedName: string | null; completedAt: any };
}) {
  const cleanTitle = task.title.replace(/\s*\(Assigned to:.*?\)\s*$/, "");
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-emerald-950/10 border border-emerald-900/15">
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
      <span className="text-sm text-zinc-400 line-through truncate flex-1">{cleanTitle}</span>
      {task.assignedName && (
        <span className="text-[10px] text-zinc-600 shrink-0">{task.assignedName}</span>
      )}
    </div>
  );
}

// ─── Meeting card ─────────────────────────────────────────────────────────
function MeetingCard({
  meeting,
}: {
  meeting: { id: number; title: string | null; meetingDate: any; primaryLead: string; executiveSummary: string };
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
  collapsible,
  defaultOpen = true,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  accentColor: string;
  linkTo?: string;
  linkLabel?: string;
  children: React.ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-3">
        <button
          className="flex items-center gap-2"
          onClick={collapsible ? () => setOpen(!open) : undefined}
        >
          <div className={`p-1.5 rounded-lg ${accentColor}`}>{icon}</div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {count !== undefined && count > 0 && (
            <span className="text-xs text-zinc-500 font-mono bg-zinc-800/50 px-1.5 py-0.5 rounded">
              {count}
            </span>
          )}
          {collapsible && (
            <ChevronDown className={`h-3.5 w-3.5 text-zinc-600 transition-transform duration-200 ${open ? "" : "-rotate-90"}`} />
          )}
        </button>
        {linkTo && (
          <Link href={linkTo}>
            <span className="text-xs text-zinc-500 hover:text-yellow-500 transition-colors flex items-center gap-1 cursor-pointer">
              {linkLabel || "View all"} <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        )}
      </div>
      {(!collapsible || open) && children}
    </div>
  );
}

// ─── Filter type for stat card drill-down ───────────────────────────────
type TriageFilter = "open" | "overdue" | "high" | "done" | "starred" | "pending" | null;

// ─── Stat card (compact, clickable for filtering) ────────────────────────
function StatCard({
  icon,
  label,
  value,
  color,
  active,
  onClick,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  active?: boolean;
  onClick?: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full border rounded-xl px-3 py-2.5 flex items-center gap-2.5 transition-all duration-200 cursor-pointer text-left ${
        active
          ? "bg-yellow-600/15 border-yellow-500/40 ring-1 ring-yellow-500/20"
          : highlight
            ? "bg-yellow-950/15 border-yellow-800/30 hover:border-yellow-700/40"
            : "bg-zinc-900/40 border-zinc-800/40 hover:border-zinc-700/50"
      }`}
    >
      <div className={`p-1.5 rounded-lg ${color}`}>{icon}</div>
      <div>
        <div className={`text-base font-bold font-mono ${active ? "text-yellow-400" : "text-white"}`}>{value}</div>
        <div className={`text-[9px] uppercase tracking-wider leading-tight ${active ? "text-yellow-500/70" : "text-zinc-500"}`}>{label}</div>
      </div>
    </button>
  );
}

// ─── Inline Strategic Insights (for greeting bar) ────────────────────────
function InlineInsights() {
  const { data, isLoading } = trpc.triage.strategicInsights.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-4 bg-zinc-800/40 rounded animate-pulse w-full" />
        ))}
      </div>
    );
  }

  if (!data?.insights?.length) {
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/60" />
        <span>No critical risks detected.</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data.insights.map((insight: string, i: number) => (
        <div key={i} className="flex items-start gap-2">
          <Zap className="h-3 w-3 text-yellow-500/70 mt-0.5 shrink-0" />
          <p className="text-xs text-zinc-400 leading-relaxed">{insight}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Unread Emails Section ───────────────────────────────────────────────
function UnreadEmailsSection() {
  const { data: threads, isLoading } = trpc.mail.listThreads.useQuery(
    { folder: "inbox", page: 1, pageSize: 20 },
    { retry: false }
  );

  if (isLoading) {
    return (
      <Section
        icon={<MailOpen className="h-4 w-4 text-violet-400" />}
        title="Unread Emails"
        accentColor="bg-violet-950/40"
        linkTo="/communications"
        linkLabel="Open inbox"
      >
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-zinc-900/50 border border-zinc-800/40 rounded-lg animate-pulse" />
          ))}
        </div>
      </Section>
    );
  }

  if (!threads?.threads?.length) return null;

  // Filter unread emails
  const unreadEmails = threads.threads.filter((t: any) => t.unread);
  // Also get today's emails for the "recent" view
  const today = new Date();
  const todayStr = today.toDateString();
  const todayEmails = threads.threads.filter((t: any) => {
    const d = t.lastMessageDate ? new Date(t.lastMessageDate) : null;
    return d && d.toDateString() === todayStr;
  });

  // Show unread first, then today's emails if no unread
  const displayEmails = unreadEmails.length > 0 ? unreadEmails : todayEmails;
  const sectionTitle = unreadEmails.length > 0 ? "Unread Emails" : "Today's Emails";
  const displayCount = displayEmails.length;

  if (displayCount === 0) return null;

  return (
    <Section
      icon={<MailOpen className="h-4 w-4 text-violet-400" />}
      title={sectionTitle}
      count={displayCount}
      accentColor="bg-violet-950/40"
      linkTo="/communications"
      linkLabel="Open inbox"
      collapsible
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {displayEmails.slice(0, 8).map((t: any) => (
          <Link key={t.threadId} href="/communications">
            <div className="group flex items-center gap-3 bg-zinc-900/50 border border-zinc-800/40 rounded-lg px-3 py-2.5 hover:border-zinc-700/50 transition-colors cursor-pointer">
              <Mail className="h-3.5 w-3.5 text-violet-400/60 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-zinc-200 truncate group-hover:text-white transition-colors">
                  {t.subject || "(no subject)"}
                </p>
                <p className="text-[10px] text-zinc-500 truncate">
                  {t.from || t.participants?.[0] || "Unknown sender"}
                </p>
              </div>
              {t.unread && (
                <span className="h-2 w-2 rounded-full bg-violet-500 shrink-0" />
              )}
              <span className="text-[10px] text-zinc-600 shrink-0">
                {t.lastMessageDate ? new Date(t.lastMessageDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) : ""}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </Section>
  );
}

// ─── Greeting Bar (redesigned v46 — stat cards inside) ───────────────────────
function GreetingBar({
  greeting, userName, statusLine, situationalSummary, timeIcon,
  timeString, dateString, tzAbbr, quote, showQuote, setShowQuote,
  summary, activeFilter, onFilterChange,
}: {
  greeting: string; userName: string; statusLine: string; situationalSummary: string;
  timeIcon: React.ReactNode; timeString: string; dateString: string; tzAbbr: string;
  quote: { text: string; author: string }; showQuote: boolean; setShowQuote: (v: boolean) => void;
  summary: { totalOpen: number; totalOverdue: number; totalHighPriority: number; completedToday: number; totalStarred: number; totalPendingApprovals: number };
  activeFilter: TriageFilter;
  onFilterChange: (f: TriageFilter) => void;
}) {
  const { omniMode, openChat } = useOmni();
  const [omniHover, setOmniHover] = useState(false);

  const toggleFilter = (f: TriageFilter) => {
    onFilterChange(activeFilter === f ? null : f);
  };

  return (
    <div className="bg-gradient-to-br from-zinc-900/80 via-zinc-900/60 to-zinc-900/40 border border-zinc-800/40 rounded-2xl p-5 lg:p-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:gap-6">
        {/* Left: Greeting + Summary + Quote + Insights */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3 mb-2">
            <div className="hidden sm:flex p-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700/30 shrink-0">
              {timeIcon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-4">
                <h1 className="text-2xl lg:text-3xl font-semibold text-white tracking-tight">
                  {greeting}, <span className="text-yellow-500">{userName}</span>
                </h1>
                {/* Mobile clock */}
                <div className="text-right hidden sm:block lg:hidden shrink-0">
                  <div className="text-lg font-mono text-white tracking-wider tabular-nums">{timeString}</div>
                  <p className="text-[10px] text-zinc-500">{dateString}</p>
                </div>
              </div>
              <p className="text-sm text-zinc-400 mt-1 font-medium">{statusLine}</p>
              <div className="flex items-center gap-2 mt-1.5 text-xs text-zinc-500 font-mono">
                <span>{situationalSummary}</span>
              </div>
            </div>
          </div>

          {/* Quote */}
          {showQuote && (
            <div className="flex items-center gap-2 mt-2 pl-0 sm:pl-[52px]">
              <Quote className="h-3 w-3 text-yellow-600/30 shrink-0" />
              <p className="text-[11px] text-zinc-600 italic truncate">
                "{quote.text}" <span className="text-zinc-700 not-italic">— {quote.author}</span>
              </p>
              <button
                onClick={() => setShowQuote(false)}
                className="p-0.5 rounded hover:bg-zinc-800 text-zinc-700 hover:text-zinc-500 transition-colors shrink-0"
              >
                <EyeOff className="h-3 w-3" />
              </button>
            </div>
          )}
          {!showQuote && (
            <button
              onClick={() => setShowQuote(true)}
              className="mt-2 pl-0 sm:pl-[52px] flex items-center gap-1.5 text-[10px] text-zinc-700 hover:text-zinc-500 transition-colors"
            >
              <Eye className="h-3 w-3" /> Show quote
            </button>
          )}

        </div>

        {/* Center-Right: Omni Character (large, interactive) */}
        {omniMode !== "hidden" && (
          <div className="hidden lg:flex flex-col items-center justify-center shrink-0 w-[160px] pt-2">
            <div
              className="cursor-pointer transition-transform duration-300 hover:scale-105"
              onMouseEnter={() => setOmniHover(true)}
              onMouseLeave={() => setOmniHover(false)}
              onClick={openChat}
              title="Ask Omni"
            >
              <OmniAvatar
                mode={omniMode}
                state={omniHover ? "wave" : "idle"}
                size={110}
                badge={false}
              />
            </div>
            <p className="text-[10px] text-zinc-600 mt-2 text-center">Click to ask Omni</p>
          </div>
        )}

        {/* Right: Clock */}
        <div className="hidden lg:flex flex-col items-end shrink-0">
          <div className="text-right">
            <div className="text-xl font-mono text-white tracking-wider tabular-nums">{timeString}</div>
            <p className="text-[10px] text-zinc-500 mt-0.5">{dateString}</p>
            <p className="text-[9px] text-zinc-600">{tzAbbr}</p>
          </div>
        </div>
      </div>

      {/* ── Insights + Stats side-by-side ─────────────────────────── */}
      <div className="mt-4 pt-4 border-t border-zinc-800/30">
        <div className="flex flex-col lg:flex-row lg:gap-6">
          {/* Left: Strategic Insights */}
          <div className="flex-1 min-w-0 mb-4 lg:mb-0">
            <div className="flex items-center gap-1.5 mb-2">
              <Brain className="h-3 w-3 text-yellow-500/60" />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Strategic Insights</span>
              <span className="text-[9px] text-yellow-600/40 ml-2">AI</span>
            </div>
            <InlineInsights />
          </div>

          {/* Vertical divider (desktop only) */}
          <div className="hidden lg:block w-px bg-zinc-800/40 self-stretch" />

          {/* Right: Quick Stats */}
          <div className="lg:w-[420px] xl:w-[480px] shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Filter className="h-3 w-3 text-zinc-600" />
                <span className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium">Quick Stats</span>
              </div>
              {activeFilter && (
                <button
                  onClick={() => onFilterChange(null)}
                  className="flex items-center gap-1 text-[10px] text-yellow-500 hover:text-yellow-400 transition-colors"
                >
                  <X className="h-3 w-3" />
                  Clear filter
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <StatCard icon={<ListTodo className="h-3.5 w-3.5 text-zinc-300" />} label="Open Tasks" value={summary.totalOpen} color="bg-zinc-800/60" active={activeFilter === "open"} onClick={() => toggleFilter("open")} />
              <StatCard icon={<AlertTriangle className="h-3.5 w-3.5 text-red-400" />} label="Overdue" value={summary.totalOverdue} color="bg-red-950/40" active={activeFilter === "overdue"} onClick={() => toggleFilter("overdue")} highlight={summary.totalOverdue > 0} />
              <StatCard icon={<Flame className="h-3.5 w-3.5 text-yellow-400" />} label="High Priority" value={summary.totalHighPriority} color="bg-yellow-950/40" active={activeFilter === "high"} onClick={() => toggleFilter("high")} />
              <StatCard icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />} label="Done Today" value={summary.completedToday} color="bg-emerald-950/40" active={activeFilter === "done"} onClick={() => toggleFilter("done")} />
              <StatCard icon={<Star className="h-3.5 w-3.5 text-yellow-400" />} label="Starred Mail" value={summary.totalStarred} color="bg-yellow-950/40" active={activeFilter === "starred"} onClick={() => toggleFilter("starred")} />
              <StatCard icon={<Users className="h-3.5 w-3.5 text-blue-400" />} label="Pending" value={summary.totalPendingApprovals} color="bg-blue-950/40" active={activeFilter === "pending"} onClick={() => toggleFilter("pending")} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Triage Feed ──────────────────────────────────────────────────────
export default function TriageFeed() {
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.triage.feed.useQuery();
  const [actingIds, setActingIds] = useState<Set<number>>(new Set());
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [selectedApproval, setSelectedApproval] = useState<{ item: any; type: "contact" | "company" } | null>(null);
  const [activeFilter, setActiveFilter] = useState<TriageFilter>(null);
  const [showQuote, setShowQuote] = useState(() => {
    const stored = localStorage.getItem("omniscope-show-quote");
    return stored !== null ? stored === "true" : true;
  });
  const now = useLiveClock();

  useEffect(() => {
    localStorage.setItem("omniscope-show-quote", String(showQuote));
  }, [showQuote]);

  // Mutations
  const completeMutation = trpc.triage.completeTask.useMutation({
    onMutate: ({ taskId }) => setActingIds((p) => new Set(p).add(taskId)),
    onSuccess: (_, { taskId }) => {
      toast.success("Task completed");
      setActingIds((p) => { const n = new Set(p); n.delete(taskId); return n; });
      setSelectedTask(null);
      utils.triage.feed.invalidate();
    },
    onError: (_, { taskId }) => {
      setActingIds((p) => { const n = new Set(p); n.delete(taskId); return n; });
      toast.error("Could not complete task");
    },
  });

  const deleteMutation = trpc.triage.deleteTask.useMutation({
    onSuccess: () => {
      toast.success("Task deleted");
      setSelectedTask(null);
      utils.triage.feed.invalidate();
    },
    onError: () => toast.error("Could not delete task"),
  });

  const updateMutation = trpc.triage.updateTask.useMutation({
    onSuccess: () => {
      toast.success("Task updated");
      setSelectedTask(null);
      utils.triage.feed.invalidate();
    },
    onError: () => toast.error("Could not update task"),
  });

  const snoozeMutation = trpc.triage.snoozeTask.useMutation({
    onSuccess: () => {
      toast.success("Task snoozed to tomorrow");
      setSelectedTask(null);
      utils.triage.feed.invalidate();
    },
    onError: () => toast.error("Could not snooze task"),
  });

  const approveContactMutation = trpc.triage.approveContact.useMutation({
    onSuccess: () => {
      toast.success("Contact approved");
      setSelectedApproval(null);
      utils.triage.feed.invalidate();
    },
    onError: () => toast.error("Could not approve contact"),
  });

  const rejectContactMutation = trpc.triage.rejectContact.useMutation({
    onSuccess: () => {
      toast.success("Contact rejected");
      setSelectedApproval(null);
      utils.triage.feed.invalidate();
    },
    onError: () => toast.error("Could not reject contact"),
  });

  const approveCompanyMutation = trpc.triage.approveCompany.useMutation({
    onSuccess: () => {
      toast.success("Company approved");
      setSelectedApproval(null);
      utils.triage.feed.invalidate();
    },
    onError: () => toast.error("Could not approve company"),
  });

  const rejectCompanyMutation = trpc.triage.rejectCompany.useMutation({
    onSuccess: () => {
      toast.success("Company rejected");
      setSelectedApproval(null);
      utils.triage.feed.invalidate();
    },
    onError: () => toast.error("Could not reject company"),
  });

  // Local time values
  const localHour = now.getHours();
  const greeting = getGreeting(localHour);
  const timeIcon = getTimeIcon(localHour);
  const timeString = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
  const dateString = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const tzAbbr = Intl.DateTimeFormat("en-US", { timeZoneName: "short" }).formatToParts(now).find(p => p.type === "timeZoneName")?.value || "";
  const quote = useMemo(() => getDailyQuote(), []);

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
  const statusLine = getStatusLine(data, localHour);
  const situationalSummary = getSituationalSummary(data, localHour);
  const hasOverdue = data.overdueTasks.length > 0;
  const hasTodayTasks = data.todayTasks.length > 0;
  const hasHighPriority = data.highPriorityTasks.length > 0;
  const hasStarredEmails = data.starredEmails.length > 0;
  const hasPendingContacts = data.pendingContacts.length > 0;
  const hasPendingCompanies = data.pendingCompanies.length > 0;
  const hasRecentMeetings = data.recentMeetings.length > 0;
  const hasTomorrowTasks = (data.tomorrowTasks?.length ?? 0) > 0;
  const hasWeekTasks = (data.weekTasks?.length ?? 0) > 0;
  const hasCompletedToday = (data.completedTodayTasks?.length ?? 0) > 0;

  const nothingToTriage =
    !hasOverdue && !hasTodayTasks && !hasHighPriority && !hasStarredEmails && !hasPendingContacts && !hasPendingCompanies;
  const allTodayDone = !hasOverdue && !hasTodayTasks && hasCompletedToday;

  return (
    <div className="p-5 lg:p-6 max-w-[1400px] mx-auto space-y-4">
      {/* ── Task Modal ──────────────────────────────────────────────── */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onComplete={(id) => completeMutation.mutate({ taskId: id })}
          onDelete={(id) => deleteMutation.mutate({ taskId: id })}
          onUpdate={(id, updates) => updateMutation.mutate({ taskId: id, ...updates })}
          onSnooze={(id, days) => snoozeMutation.mutate({ taskId: id, days })}
          isActing={actingIds.has(selectedTask.id)}
        />
      )}

      {/* ── Approval Modal ──────────────────────────────────────────── */}
      {selectedApproval && (
        <ApprovalModal
          item={selectedApproval.item}
          type={selectedApproval.type}
          onClose={() => setSelectedApproval(null)}
          onApprove={(id) =>
            selectedApproval.type === "contact"
              ? approveContactMutation.mutate({ contactId: id })
              : approveCompanyMutation.mutate({ companyId: id })
          }
          onReject={(id) =>
            selectedApproval.type === "contact"
              ? rejectContactMutation.mutate({ contactId: id })
              : rejectCompanyMutation.mutate({ companyId: id })
          }
          isActing={false}
        />
      )}

      {/* ── Greeting bar with integrated insights ──────────────────── */}
      <GreetingBar
        greeting={greeting}
        userName={data.userName}
        statusLine={statusLine}
        situationalSummary={situationalSummary}
        timeIcon={timeIcon}
        timeString={timeString}
        dateString={dateString}
        tzAbbr={tzAbbr}
        quote={quote}
        showQuote={showQuote}
        setShowQuote={setShowQuote}
        summary={summary}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      {/* ── Active filter indicator ─────────────────────────────────────── */}
      {activeFilter && (
        <div className="flex items-center gap-2 bg-yellow-950/15 border border-yellow-800/25 rounded-xl px-4 py-2.5">
          <Filter className="h-3.5 w-3.5 text-yellow-500" />
          <span className="text-sm text-yellow-400 font-medium">
            {activeFilter === "open" && "Showing all open tasks"}
            {activeFilter === "overdue" && "Showing overdue tasks"}
            {activeFilter === "high" && "Showing high priority tasks"}
            {activeFilter === "done" && "Showing tasks completed today"}
            {activeFilter === "starred" && "Showing starred emails"}
            {activeFilter === "pending" && "Showing pending approvals"}
          </span>
          <button
            onClick={() => setActiveFilter(null)}
            className="ml-auto p-1 rounded hover:bg-yellow-900/30 text-yellow-500 hover:text-yellow-400 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── FILTERED VIEW: When a stat card is active ─────────────── */}
      {activeFilter === "open" && (
        <Section
          icon={<ListTodo className="h-4 w-4 text-zinc-300" />}
          title="All Open Tasks"
          count={summary.totalOpen}
          accentColor="bg-zinc-800/60"
          linkTo="/operations"
          linkLabel="Manage in Operations"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {[...data.overdueTasks, ...data.todayTasks, ...data.highPriorityTasks, ...(data.tomorrowTasks || []), ...(data.weekTasks || [])]
              .filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i)
              .map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  showOverdue={data.overdueTasks.some(o => o.id === t.id)}
                  onClick={() => setSelectedTask(t)}
                  onQuickComplete={(id) => completeMutation.mutate({ taskId: id })}
                  isActing={actingIds.has(t.id)}
                />
              ))}
          </div>
        </Section>
      )}

      {activeFilter === "overdue" && (
        <Section
          icon={<AlertTriangle className="h-4 w-4 text-red-400" />}
          title="Overdue Tasks"
          count={data.overdueTasks.length}
          accentColor="bg-red-950/40"
          linkTo="/operations"
          className="bg-red-950/5 border border-red-900/15 rounded-xl p-4"
        >
          {data.overdueTasks.length === 0 ? (
            <p className="text-sm text-zinc-500 py-4 text-center">No overdue tasks. You're on track.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {data.overdueTasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  showOverdue
                  onClick={() => setSelectedTask(t)}
                  onQuickComplete={(id) => completeMutation.mutate({ taskId: id })}
                  isActing={actingIds.has(t.id)}
                />
              ))}
            </div>
          )}
        </Section>
      )}

      {activeFilter === "high" && (
        <Section
          icon={<Flame className="h-4 w-4 text-orange-400" />}
          title="High Priority Tasks"
          count={summary.totalHighPriority}
          accentColor="bg-orange-950/40"
          linkTo="/operations"
        >
          {data.highPriorityTasks.length === 0 ? (
            <p className="text-sm text-zinc-500 py-4 text-center">No high priority tasks.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {[...data.overdueTasks.filter(t => t.priority === 'high'), ...data.todayTasks.filter(t => t.priority === 'high'), ...data.highPriorityTasks]
                .filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i)
                .map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    showOverdue={data.overdueTasks.some(o => o.id === t.id)}
                    onClick={() => setSelectedTask(t)}
                    onQuickComplete={(id) => completeMutation.mutate({ taskId: id })}
                    isActing={actingIds.has(t.id)}
                  />
                ))}
            </div>
          )}
        </Section>
      )}

      {activeFilter === "done" && (
        <Section
          icon={<Trophy className="h-4 w-4 text-emerald-400" />}
          title="Completed Today"
          count={data.completedTodayTasks?.length || 0}
          accentColor="bg-emerald-950/40"
        >
          {!data.completedTodayTasks?.length ? (
            <p className="text-sm text-zinc-500 py-4 text-center">No tasks completed today yet.</p>
          ) : (
            <div className="space-y-1.5">
              {data.completedTodayTasks.map((t) => (
                <CompletedRow key={t.id} task={t} />
              ))}
            </div>
          )}
        </Section>
      )}

      {activeFilter === "starred" && (
        <Section
          icon={<Star className="h-4 w-4 text-yellow-500" />}
          title="Starred Emails"
          count={data.starredEmails.length}
          accentColor="bg-yellow-950/40"
          linkTo="/communications"
          linkLabel="Open inbox"
        >
          {data.starredEmails.length === 0 ? (
            <p className="text-sm text-zinc-500 py-4 text-center">No starred emails.</p>
          ) : (
            <div className="space-y-1.5">
              {data.starredEmails.map((s) => {
                const starLabels: Record<number, string> = { 1: "Reply Today", 2: "Delegate", 3: "Critical" };
                const starColors: Record<number, string> = { 1: "text-yellow-500", 2: "text-orange-400", 3: "text-red-400" };
                return (
                  <Link key={s.threadId} href="/communications">
                    <div className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800/40 rounded-lg px-3 py-2 hover:border-zinc-700/50 transition-colors cursor-pointer">
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
          )}
        </Section>
      )}

      {activeFilter === "pending" && (
        <Section
          icon={<UserPlus className="h-4 w-4 text-blue-400" />}
          title="Pending Approvals"
          count={data.pendingContacts.length + data.pendingCompanies.length}
          accentColor="bg-blue-950/40"
          linkTo="/relationships"
        >
          {data.pendingContacts.length === 0 && data.pendingCompanies.length === 0 ? (
            <p className="text-sm text-zinc-500 py-4 text-center">No pending approvals.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {data.pendingContacts.map((c) => (
                <div
                  key={`c-${c.id}`}
                  onClick={() => setSelectedApproval({ item: c, type: "contact" })}
                  className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800/40 rounded-lg px-3 py-2 hover:border-zinc-700/50 transition-colors cursor-pointer"
                >
                  <UserPlus className="h-3.5 w-3.5 text-blue-400/60" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-zinc-200 truncate">{c.name}</p>
                    {c.organization && <p className="text-[10px] text-zinc-500 truncate">{c.organization}</p>}
                  </div>
                  <ChevronRight className="h-3 w-3 text-zinc-700" />
                </div>
              ))}
              {data.pendingCompanies.map((c) => (
                <div
                  key={`co-${c.id}`}
                  onClick={() => setSelectedApproval({ item: c, type: "company" })}
                  className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800/40 rounded-lg px-3 py-2 hover:border-zinc-700/50 transition-colors cursor-pointer"
                >
                  <Building2 className="h-3.5 w-3.5 text-purple-400/60" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-zinc-200 truncate">{c.name}</p>
                    {c.sector && <p className="text-[10px] text-zinc-500 truncate">{c.sector}</p>}
                  </div>
                  <ChevronRight className="h-3 w-3 text-zinc-700" />
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ── DEFAULT VIEW: No filter active ─────────────────────────── */}
      {!activeFilter && (
        <>
          {/* Celebration */}
          {allTodayDone && (
            <div className="flex items-center gap-3 bg-emerald-950/15 border border-emerald-800/25 rounded-xl p-4">
              <div className="p-2 rounded-full bg-emerald-950/40">
                <Trophy className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-emerald-400">All tasks completed for today</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {data.completedTodayTasks?.length || 0} completed.
                  {hasTomorrowTasks ? ` ${data.tomorrowTasks?.length} coming tomorrow.` : ""}
                </p>
              </div>
              <Link href="/operations">
                <span className="text-xs text-emerald-500 hover:text-emerald-400 flex items-center gap-1 cursor-pointer">
                  View all <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            </div>
          )}

          {/* All clear */}
          {nothingToTriage && !allTodayDone && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-3 rounded-full bg-emerald-950/30 border border-emerald-800/30 mb-3">
                <Sparkles className="h-6 w-6 text-emerald-500" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1">All Clear</h3>
              <p className="text-sm text-zinc-500 max-w-sm">
                Nothing requires your immediate attention.
              </p>
            </div>
          )}

          {/* Overdue */}
          {hasOverdue && (
            <Section
              icon={<AlertTriangle className="h-4 w-4 text-red-400" />}
              title="Overdue"
              count={data.overdueTasks.length}
              accentColor="bg-red-950/40"
              linkTo="/operations"
              className="bg-red-950/5 border border-red-900/15 rounded-xl p-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {data.overdueTasks.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    showOverdue
                    onClick={() => setSelectedTask(t)}
                    onQuickComplete={(id) => completeMutation.mutate({ taskId: id })}
                    isActing={actingIds.has(t.id)}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* Due today */}
          {hasTodayTasks && (
            <Section
              icon={<Clock className="h-4 w-4 text-yellow-500" />}
              title="Due Today"
              count={data.todayTasks.length}
              accentColor="bg-yellow-950/40"
              linkTo="/operations"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {data.todayTasks.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    onClick={() => setSelectedTask(t)}
                    onQuickComplete={(id) => completeMutation.mutate({ taskId: id })}
                    isActing={actingIds.has(t.id)}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* Two-column: High Priority + Approvals/Starred */}
          {(hasHighPriority || hasStarredEmails || hasPendingContacts || hasPendingCompanies) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {hasHighPriority && (
                <Section
                  icon={<Flame className="h-4 w-4 text-orange-400" />}
                  title="High Priority"
                  count={data.highPriorityTasks.length}
                  accentColor="bg-orange-950/40"
                  linkTo="/operations"
                >
                  <div className="space-y-1.5">
                    {data.highPriorityTasks.slice(0, 6).map((t) => {
                      const cleanTitle = t.title.replace(/\s*\(Assigned to:.*?\)\s*$/, "");
                      return (
                        <div
                          key={t.id}
                          onClick={() => setSelectedTask(t)}
                          className="group flex items-center gap-3 bg-zinc-900/50 border border-zinc-800/40 rounded-lg px-3 py-2 hover:border-zinc-700/50 transition-colors cursor-pointer"
                        >
                          <PriorityBadge priority={t.priority} />
                          <span className="text-sm text-zinc-200 truncate flex-1 group-hover:text-white transition-colors">
                            {cleanTitle}
                          </span>
                          {t.assignedName && (
                            <span className="text-[10px] text-zinc-500 shrink-0 hidden sm:inline">{t.assignedName}</span>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); completeMutation.mutate({ taskId: t.id }); }}
                            disabled={actingIds.has(t.id)}
                            className="p-1 rounded hover:bg-emerald-950/50 text-zinc-600 hover:text-emerald-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                            title="Complete"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </Section>
              )}

              <div className="space-y-4">
                {hasStarredEmails && (
                  <Section
                    icon={<Star className="h-4 w-4 text-yellow-500" />}
                    title="Starred Emails"
                    count={data.starredEmails.length}
                    accentColor="bg-yellow-950/40"
                    linkTo="/communications"
                  >
                    <div className="space-y-1.5">
                      {data.starredEmails.map((s) => {
                        const starLabels: Record<number, string> = { 1: "Reply Today", 2: "Delegate", 3: "Critical" };
                        const starColors: Record<number, string> = { 1: "text-yellow-500", 2: "text-orange-400", 3: "text-red-400" };
                        return (
                          <Link key={s.threadId} href="/communications">
                            <div className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800/40 rounded-lg px-3 py-2 hover:border-zinc-700/50 transition-colors cursor-pointer">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {data.pendingContacts.map((c) => (
                        <div
                          key={`c-${c.id}`}
                          onClick={() => setSelectedApproval({ item: c, type: "contact" })}
                          className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800/40 rounded-lg px-3 py-2 hover:border-zinc-700/50 transition-colors cursor-pointer"
                        >
                          <UserPlus className="h-3.5 w-3.5 text-blue-400/60" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-zinc-200 truncate">{c.name}</p>
                            {c.organization && <p className="text-[10px] text-zinc-500 truncate">{c.organization}</p>}
                          </div>
                          <ChevronRight className="h-3 w-3 text-zinc-700" />
                        </div>
                      ))}
                      {data.pendingCompanies.map((c) => (
                        <div
                          key={`co-${c.id}`}
                          onClick={() => setSelectedApproval({ item: c, type: "company" })}
                          className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800/40 rounded-lg px-3 py-2 hover:border-zinc-700/50 transition-colors cursor-pointer"
                        >
                          <Building2 className="h-3.5 w-3.5 text-purple-400/60" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-zinc-200 truncate">{c.name}</p>
                            {c.sector && <p className="text-[10px] text-zinc-500 truncate">{c.sector}</p>}
                          </div>
                          <ChevronRight className="h-3 w-3 text-zinc-700" />
                        </div>
                      ))}
                    </div>
                  </Section>
                )}
              </div>
            </div>
          )}

          {/* Unread Emails */}
          <UnreadEmailsSection />

          {/* Completed today */}
          {hasCompletedToday && (
            <Section
              icon={<Trophy className="h-4 w-4 text-emerald-400" />}
              title="Completed Today"
              count={data.completedTodayTasks?.length}
              accentColor="bg-emerald-950/40"
              collapsible
              defaultOpen={false}
            >
              <div className="space-y-1.5">
                {data.completedTodayTasks?.map((t) => (
                  <CompletedRow key={t.id} task={t} />
                ))}
              </div>
            </Section>
          )}

          {/* Tomorrow + This week */}
          {(hasTomorrowTasks || hasWeekTasks) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {hasTomorrowTasks && (
                <Section
                  icon={<Sunrise className="h-4 w-4 text-amber-400" />}
                  title="Tomorrow"
                  count={data.tomorrowTasks?.length}
                  accentColor="bg-amber-950/40"
                  linkTo="/operations"
                  collapsible
                >
                  <div className="space-y-1.5">
                    {data.tomorrowTasks?.map((t) => (
                      <CompactTaskRow key={t.id} task={t} onClick={() => setSelectedTask({ ...t, notes: "" })} />
                    ))}
                  </div>
                </Section>
              )}

              {hasWeekTasks && (
                <Section
                  icon={<CalendarDays className="h-4 w-4 text-blue-400" />}
                  title="This Week"
                  count={data.weekTasks?.length}
                  accentColor="bg-blue-950/40"
                  linkTo="/operations"
                  collapsible
                >
                  <div className="space-y-1.5">
                    {data.weekTasks?.map((t) => (
                      <CompactTaskRow key={t.id} task={t} showDate onClick={() => setSelectedTask({ ...t, notes: "" })} />
                    ))}
                  </div>
                </Section>
              )}
            </div>
          )}

          {/* Recent meetings */}
          {hasRecentMeetings && (
            <Section
              icon={<Calendar className="h-4 w-4 text-emerald-400" />}
              title="Recent Intelligence"
              count={data.recentMeetings.length}
              accentColor="bg-emerald-950/40"
              linkTo="/intelligence"
              linkLabel="All meetings"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {data.recentMeetings.map((m) => (
                  <MeetingCard key={m.id} meeting={m} />
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
