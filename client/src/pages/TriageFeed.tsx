import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { useState, useEffect, useMemo, useCallback } from "react";
import OmniAvatar, { OmniState, getOmniPreferences } from "@/components/OmniAvatar";
import { useOmni, useDesign } from "@/components/PortalLayout";
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
  ChevronUp,
  MailOpen,
  Filter,
  Minimize2,
  Maximize2,
  GitMerge,
  Search,
  ArrowDown,
  Briefcase,
  Activity,
  TrendingUp,
  Target,
  BarChart3,
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
    parts.push(`${summary.totalOverdue} overdue`);
  }
  if (data.todayTasks?.length > 0) {
    parts.push(`${data.todayTasks.length} due today`);
  }
  if (summary.totalHighPriority > 0 && summary.totalOverdue === 0) {
    parts.push(`${summary.totalHighPriority} high-priority`);
  }
  if (summary.totalPendingApprovals > 0) {
    parts.push(`${summary.totalPendingApprovals} pending`);
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
    high: { bg: "bg-red-500/15 border border-red-500/20", text: "text-red-400", label: "High" },
    medium: { bg: "bg-yellow-500/10 border border-yellow-500/15", text: "text-yellow-500", label: "Med" },
    low: { bg: "bg-zinc-500/15 border border-zinc-500/20", text: "text-zinc-400", label: "Low" },
  };
  const c = config[priority as keyof typeof config] || config.medium;
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
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
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <div
        className="relative bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-3xl shadow-2xl shadow-black/50 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-3">
          <div className="flex items-center gap-3">
            <PriorityBadge priority={isEditing ? editPriority : task.priority} />
            <span className="text-xs text-zinc-500 font-medium">
              {task.status === "completed" ? "Completed" : task.status === "in_progress" ? "In Progress" : "Open"}
            </span>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-zinc-800/80 text-zinc-500 hover:text-white transition-all duration-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-5 space-y-4">
          {isEditing ? (
            <>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-yellow-600/50 focus:ring-1 focus:ring-yellow-600/20 transition-all"
                placeholder="Task title"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 block font-medium">Priority</label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value)}
                    className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-600/50 transition-all"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 block font-medium">Category</label>
                  <input
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-600/50 transition-all"
                    placeholder="e.g. OTC, Gold"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 block font-medium">Notes</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-600/50 transition-all resize-none"
                  placeholder="Additional notes..."
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleSave} className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-black font-semibold text-sm py-2.5 rounded-xl transition-all duration-200">Save</button>
                <button onClick={() => setIsEditing(false)} className="px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-sm py-2.5 rounded-xl transition-all duration-200">Cancel</button>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-white leading-snug">{cleanTitle}</h3>
              <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
                {dueDate && (
                  <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" />{dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                )}
                {task.assignedName && <span className="flex items-center gap-1.5"><Users className="h-3 w-3" />{task.assignedName}</span>}
                {task.category && <span className="bg-zinc-800/80 px-2 py-0.5 rounded-full text-zinc-400">{task.category}</span>}
              </div>
              {task.notes && <p className="text-sm text-zinc-400 leading-relaxed bg-zinc-800/30 rounded-xl p-3">{task.notes}</p>}

              {/* Action grid */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => onComplete(task.id)}
                  disabled={isActing}
                  className="flex items-center justify-center gap-2 bg-emerald-600/90 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-sm py-3 rounded-xl transition-all duration-200"
                >
                  {isActing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Complete
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center justify-center gap-2 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 font-medium text-sm py-3 rounded-xl transition-all duration-200"
                >
                  <Edit3 className="h-4 w-4" /> Edit
                </button>
                <button
                  onClick={() => onSnooze(task.id, 1)}
                  disabled={isActing}
                  className="flex items-center justify-center gap-2 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 font-medium text-sm py-3 rounded-xl transition-all duration-200"
                >
                  <Timer className="h-4 w-4" /> Snooze
                </button>
                <button
                  onClick={() => onDelete(task.id)}
                  disabled={isActing}
                  className="flex items-center justify-center gap-2 bg-zinc-800/80 hover:bg-red-950/60 text-zinc-400 hover:text-red-400 font-medium text-sm py-3 rounded-xl transition-all duration-200"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              </div>
            </>
          )}
        </div>
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
  onMerge,
  isActing,
}: {
  item: any;
  type: "contact" | "company";
  onClose: () => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onMerge?: (pendingId: number, mergeIntoId: number) => void;
  isActing: boolean;
}) {
  const [showMerge, setShowMerge] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: searchResults = [] } = type === "contact"
    ? trpc.contacts.search.useQuery({ query: searchQuery }, { enabled: searchQuery.trim().length > 1 })
    : trpc.companies.search.useQuery({ query: searchQuery }, { enabled: searchQuery.trim().length > 1 });

  const hasDuplicates = item.duplicates && item.duplicates.length > 0;

  const confidenceColor = (c: number) => {
    if (c >= 80) return "border-emerald-500/30 text-emerald-400 bg-emerald-500/10";
    if (c >= 50) return "border-yellow-500/30 text-yellow-400 bg-yellow-500/10";
    return "border-zinc-600/30 text-zinc-400 bg-zinc-500/10";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <div
        className="relative bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-3xl shadow-2xl shadow-black/50 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-3">
          <div className="flex items-center gap-3">
            {type === "contact" ? (
              <div className="h-8 w-8 rounded-xl bg-blue-500/15 flex items-center justify-center">
                <UserPlus className="h-4 w-4 text-blue-400" />
              </div>
            ) : (
              <div className="h-8 w-8 rounded-xl bg-purple-500/15 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-purple-400" />
              </div>
            )}
            <div>
              <h3 className="text-base font-semibold text-white">{item.name}</h3>
              <p className="text-xs text-zinc-500">
                {type === "contact" ? (item.organization || item.email || "New contact") : (item.sector || "New company")}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-zinc-800/80 text-zinc-500 hover:text-white transition-all duration-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Details */}
        <div className="px-6 pb-3">
          <div className="bg-zinc-800/30 rounded-xl p-3 space-y-1.5">
            {type === "contact" && (
              <>
                {item.email && <p className="text-xs text-zinc-400"><span className="text-zinc-600">Email:</span> {item.email}</p>}
                {item.phone && <p className="text-xs text-zinc-400"><span className="text-zinc-600">Phone:</span> {item.phone}</p>}
                {item.organization && <p className="text-xs text-zinc-400"><span className="text-zinc-600">Org:</span> {item.organization}</p>}
                {item.title && <p className="text-xs text-zinc-400"><span className="text-zinc-600">Title:</span> {item.title}</p>}
              </>
            )}
            {type === "company" && (
              <>
                {item.sector && <p className="text-xs text-zinc-400"><span className="text-zinc-600">Sector:</span> {item.sector}</p>}
                {item.domain && <p className="text-xs text-zinc-400"><span className="text-zinc-600">Domain:</span> {item.domain}</p>}
              </>
            )}
          </div>
        </div>

        {/* Duplicate suggestions */}
        {hasDuplicates && (
          <div className="mx-6 mb-3">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-2">Possible Duplicates</p>
            <div className="space-y-1.5">
              {item.duplicates.map((d: any) => (
                <div
                  key={d.id}
                  className="group flex items-center justify-between gap-2 bg-zinc-800/40 border border-zinc-700/30 rounded-xl px-3 py-2 hover:border-yellow-700/30 transition-all cursor-pointer"
                  onClick={() => onMerge?.(item.id, d.id)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-zinc-200 truncate">{d.name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                      {d.email && <span className="truncate">{d.email}</span>}
                      {d.organization && <span>{d.organization}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${confidenceColor(d.confidence)}`}>
                      {d.confidence}%
                    </span>
                    <span className="text-xs text-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {type === "contact" ? "Same person" : "Same company"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manual Merge Search */}
        {showMerge && (
          <div className="mx-6 mb-3">
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder={`Search existing ${type === 'contact' ? 'contacts' : 'companies'} to merge with...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-800/60 border border-zinc-700/40 rounded-xl pl-9 pr-3 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-yellow-800/60 transition-all"
                autoFocus
              />
            </div>
            {searchQuery.trim() && searchResults.length > 0 && (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {searchResults.map((c: any) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-2 bg-zinc-900/60 border border-zinc-800/40 rounded-xl px-3 py-2 hover:border-yellow-800/40 transition-colors cursor-pointer group"
                    onClick={() => onMerge?.(item.id, c.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-zinc-200 truncate">{c.name}</p>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                        {c.organization && <span>{c.organization}</span>}
                        {c.email && <span className="truncate">{c.email}</span>}
                      </div>
                    </div>
                    <span className="text-xs text-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      Merge into this
                    </span>
                  </div>
                ))}
              </div>
            )}
            {searchQuery.trim() && searchResults.length === 0 && (
              <p className="text-xs text-zinc-600 text-center py-3">No matching contacts found</p>
            )}
            {!searchQuery.trim() && (
              <p className="text-xs text-zinc-600 text-center py-3">Type a name, email, or organization to find contacts</p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="px-6 pb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onApprove(item.id)}
              disabled={isActing}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600/90 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-sm py-3 rounded-xl transition-all duration-200"
            >
              <Shield className="h-3.5 w-3.5" />
              Approve
            </button>
            {onMerge && (
              <button
                onClick={() => setShowMerge(!showMerge)}
                className={`flex items-center justify-center gap-2 font-semibold text-sm py-3 px-5 rounded-xl transition-all duration-200 ${
                  showMerge
                    ? "bg-yellow-600/20 text-yellow-400 border border-yellow-700/40"
                    : "bg-zinc-800/80 hover:bg-yellow-950/40 text-zinc-300 hover:text-yellow-400"
                }`}
              >
                <GitMerge className="h-3.5 w-3.5" />
                Merge
              </button>
            )}
            <button
              onClick={() => onReject(item.id)}
              disabled={isActing}
              className="flex-1 flex items-center justify-center gap-2 bg-zinc-800/80 hover:bg-red-950/60 text-zinc-300 hover:text-red-400 font-semibold text-sm py-3 rounded-xl transition-all duration-200"
            >
              <ShieldX className="h-3.5 w-3.5" />
              Reject
            </button>
          </div>
          {!showMerge && hasDuplicates && (
            <p className="text-[10px] text-zinc-600 text-center mt-2">
              Click a suggestion above or use Merge to search manually
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Task card (premium design) ──────────────────────────────────────────
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
      className="group relative bg-zinc-900/50 backdrop-blur-sm border border-zinc-800/50 rounded-2xl p-4 hover:border-zinc-700/60 hover:bg-zinc-900/70 transition-all duration-300 cursor-pointer hover:shadow-xl hover:shadow-black/20 hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <PriorityBadge priority={task.priority} />
        {onQuickComplete && (
          <button
            onClick={(e) => { e.stopPropagation(); onQuickComplete(task.id); }}
            disabled={isActing}
            className="p-1.5 rounded-xl hover:bg-emerald-950/50 text-zinc-600 hover:text-emerald-400 transition-all duration-200 opacity-0 group-hover:opacity-100"
            title="Complete"
          >
            {isActing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
      <p className="text-sm text-zinc-200 font-medium group-hover:text-white transition-colors line-clamp-2 mb-2.5 leading-relaxed">
        {cleanTitle}
      </p>
      <div className="flex items-center gap-2 text-[10px] text-zinc-500">
        {showOverdue && dueDate && (
          <span className="text-red-400 font-semibold flex items-center gap-1">
            <AlertTriangle className="h-2.5 w-2.5" />
            {Math.ceil((Date.now() - dueDate.getTime()) / 86400000)}d overdue
          </span>
        )}
        {task.assignedName && <span className="truncate">{task.assignedName}</span>}
        {task.category && <span className="bg-zinc-800/60 px-2 py-0.5 rounded-full">{task.category}</span>}
      </div>
    </div>
  );
}

// ─── Compact task row ──────────────────────────────────────────────────
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
      className="group flex items-center gap-3 bg-zinc-900/40 border border-zinc-800/40 rounded-xl px-4 py-3 hover:border-zinc-700/50 hover:bg-zinc-900/60 transition-all duration-200 cursor-pointer"
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
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-emerald-950/10 border border-emerald-900/15">
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
      <div className="bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/50 rounded-2xl p-4 hover:border-zinc-700/60 hover:bg-zinc-900/60 transition-all duration-300 cursor-pointer group h-full hover:shadow-xl hover:shadow-black/20 hover:-translate-y-0.5">
        <div className="flex items-center gap-2 mb-2.5">
          <div className="h-6 w-6 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Calendar className="h-3 w-3 text-emerald-500/70" />
          </div>
          <span className="text-[10px] text-zinc-500 font-medium">{dateLabel}</span>
        </div>
        <p className="text-sm text-zinc-200 font-medium group-hover:text-white transition-colors line-clamp-1 mb-2">
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

// ─── Section wrapper (premium) ────────────────────────────────────────────
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
    <div className={`animate-fade-in-up ${className || ''}`}>
      <div className="flex items-center justify-between mb-4">
        <button
          className="flex items-center gap-2.5"
          onClick={collapsible ? () => setOpen(!open) : undefined}
        >
          <div className={`p-2 rounded-xl ${accentColor}`}>{icon}</div>
          <h3 className="text-sm font-semibold text-white tracking-tight">{title}</h3>
          {count !== undefined && count > 0 && (
            <span className="text-[10px] text-zinc-400 font-mono bg-zinc-800/60 px-2 py-0.5 rounded-full">
              {count}
            </span>
          )}
          {collapsible && (
            <ChevronDown className={`h-3.5 w-3.5 text-zinc-600 transition-transform duration-300 ${open ? "" : "-rotate-90"}`} />
          )}
        </button>
        {linkTo && (
          <Link href={linkTo}>
            <span className="text-xs text-zinc-500 hover:text-yellow-500 transition-colors flex items-center gap-1.5 cursor-pointer font-medium">
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

// ─── Stat card (Apple-grade glassmorphism) ──────────────────────────────
function StatCard({
  icon,
  label,
  value,
  color,
  active,
  onClick,
  highlight,
  hasNotification,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  active?: boolean;
  onClick?: () => void;
  highlight?: boolean;
  hasNotification?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative w-full border rounded-2xl px-3.5 py-3 flex items-center gap-3 transition-all duration-300 cursor-pointer text-left hover:scale-[1.03] active:scale-[0.97] backdrop-blur-sm ${
        active
          ? "bg-yellow-500/10 border-yellow-500/30 shadow-lg shadow-yellow-500/5"
          : highlight
            ? "bg-red-950/10 border-red-800/20 hover:border-red-700/30 hover:shadow-lg hover:shadow-red-500/5"
            : "bg-zinc-900/30 border-zinc-800/40 hover:border-zinc-700/50 hover:bg-zinc-900/50"
      }`}
    >
      {hasNotification && value > 0 && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-zinc-900" />
        </span>
      )}
      <div className={`p-2 rounded-xl ${color}`}>{icon}</div>
      <div>
        <div className={`text-lg font-bold font-mono leading-none ${active ? "text-yellow-400" : "text-white"}`}>{value}</div>
        <div className={`text-[9px] uppercase tracking-widest leading-tight mt-0.5 ${active ? "text-yellow-500/70" : "text-zinc-500"}`}>{label}</div>
      </div>
    </button>
  );
}

// ─── Inline Strategic Insights ────────────────────────────────────────
function InlineInsights() {
  const [, navigate] = useLocation();
  const { data, isLoading } = trpc.triage.strategicInsights.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="space-y-2.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-4 bg-zinc-800/30 rounded-lg animate-pulse w-full" />
        ))}
      </div>
    );
  }

  if (!data?.insights?.length) {
    return (
      <div className="flex items-center gap-2.5 text-xs text-zinc-500">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/60" />
        <span>No critical risks detected.</span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {data.insights.map((insight: any, i: number) => {
        const text = typeof insight === 'string' ? insight : insight.text;
        const linkTo = typeof insight === 'string' ? null : insight.linkTo;
        const linkLabel = typeof insight === 'string' ? null : insight.linkLabel;
        const isClickable = !!linkTo;

        return (
          <div
            key={i}
            className={`flex items-start gap-2.5 group ${
              isClickable ? 'cursor-pointer hover:bg-zinc-800/20 -mx-2 px-2 py-1.5 rounded-xl transition-all duration-200' : 'py-1'
            }`}
            onClick={isClickable ? () => navigate(linkTo) : undefined}
            role={isClickable ? 'button' : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onKeyDown={isClickable ? (e) => { if (e.key === 'Enter') navigate(linkTo); } : undefined}
          >
            <Zap className={`h-3 w-3 mt-0.5 shrink-0 transition-colors ${
              isClickable ? 'text-yellow-500/70 group-hover:text-yellow-400' : 'text-yellow-500/70'
            }`} />
            <div className="min-w-0 flex-1">
              <p className={`text-xs leading-relaxed transition-colors ${
                isClickable ? 'text-zinc-400 group-hover:text-zinc-200' : 'text-zinc-400'
              }`}>{text}</p>
              {isClickable && linkLabel && (
                <span className="text-[9px] text-yellow-600/50 group-hover:text-yellow-500/80 transition-colors flex items-center gap-0.5 mt-0.5">
                  <ArrowRight className="h-2 w-2" /> {linkLabel}
                </span>
              )}
            </div>
          </div>
        );
      })}
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
            <div key={i} className="h-14 bg-zinc-900/50 border border-zinc-800/40 rounded-xl animate-pulse" />
          ))}
        </div>
      </Section>
    );
  }

  if (!threads?.threads?.length) return null;

  const unreadEmails = threads.threads.filter((t: any) => t.unread);
  const today = new Date();
  const todayStr = today.toDateString();
  const todayEmails = threads.threads.filter((t: any) => {
    const d = t.lastMessageDate ? new Date(t.lastMessageDate) : null;
    return d && d.toDateString() === todayStr;
  });

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
            <div className="group flex items-center gap-3 bg-zinc-900/40 border border-zinc-800/40 rounded-xl px-4 py-3 hover:border-zinc-700/50 hover:bg-zinc-900/60 transition-all duration-200 cursor-pointer">
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

// ═══════════════════════════════════════════════════════════════════════════
// HERO GREETING — Tesla/Apple-grade design
// ═══════════════════════════════════════════════════════════════════════════
function HeroGreeting({
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
  const { theme } = useDesign();
  const [omniHover, setOmniHover] = useState(false);

  const toggleFilter = (f: TriageFilter) => {
    onFilterChange(activeFilter === f ? null : f);
  };

  // ── Event-driven Omni state machine ──
  // Derives Omni's emotional state from real triage data.
  const omniEmotionalState: OmniState = useMemo(() => {
    // If proactive states are disabled, always return idle
    const prefs = getOmniPreferences();
    if (!prefs.proactiveStates) return "idle";
    // Critical: overdue items demand attention
    if (summary.totalOverdue > 3) return "alert";
    if (summary.totalOverdue > 0) return "concerned";
    // High priority load
    if (summary.totalHighPriority > 5) return "focused";
    // Pending approvals building up
    if (summary.totalPendingApprovals > 5) return "waiting";
    // All clear, tasks done
    if (summary.totalOpen === 0 && summary.completedToday > 0) return "proud";
    if (summary.completedToday > 3 && summary.totalOverdue === 0) return "relaxed";
    // Light workload
    if (summary.totalOpen < 5 && summary.totalOverdue === 0) return "relaxed";
    // Default: calm idle
    return "idle";
  }, [summary]);

  const healthScore = useMemo(() => {
    const overdue = summary.totalOverdue;
    const high = summary.totalHighPriority;
    if (overdue > 3 || high > 5) return "critical";
    if (overdue > 0 || high > 2) return "attention";
    return "clear";
  }, [summary]);

  const healthColor = healthScore === "critical" ? "from-red-500/20 to-red-600/5" : healthScore === "attention" ? "from-yellow-500/15 to-yellow-600/5" : "from-emerald-500/10 to-emerald-600/5";
  const healthBorder = healthScore === "critical" ? "border-red-500/20" : healthScore === "attention" ? "border-yellow-500/15" : "border-emerald-500/10";

  return (
    <div className="relative overflow-hidden">
      <div className={`relative bg-gradient-to-br ${healthColor} border ${healthBorder} rounded-3xl backdrop-blur-sm overflow-hidden`}>
        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />

        {/* ── Row 1: Compact greeting bar ── */}
        <div className="relative px-6 lg:px-8 pt-5 pb-3">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Greeting */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-1.5 rounded-lg bg-white/5 border border-white/5 shrink-0">
                {timeIcon}
              </div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight truncate">
                {greeting}, <span className="bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">{userName}</span>
              </h1>
            </div>

            {/* Right: Clock */}
            <div className="hidden sm:flex items-center gap-3 shrink-0">
              <div className="text-right">
                <div className="text-xl font-mono text-white tracking-wider tabular-nums font-bold leading-none">{timeString}</div>
                <p className="text-[10px] text-zinc-500 mt-0.5">{dateString} · {tzAbbr}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Row 2: Omni (centered, prominent) + flanked by Insights & Stats ── */}
        <div className="relative px-6 lg:px-8 pb-5 pt-1">
          <div className="flex flex-col lg:flex-row items-stretch gap-5">
            {/* Left: Strategic Insights */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="h-5 w-5 rounded-md bg-yellow-500/10 flex items-center justify-center">
                  <Brain className="h-2.5 w-2.5 text-yellow-500" />
                </div>
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Strategic Insights</span>
                <span className="text-[8px] text-yellow-600/50 bg-yellow-600/10 px-1.5 py-0.5 rounded-full font-medium">AI</span>
              </div>
              <InlineInsights />
            </div>

            {/* Center: Omni Avatar (larger, prominent) */}
            {omniMode !== "hidden" && (
              <div className="hidden lg:flex flex-col items-center justify-center shrink-0 px-6">
                <div
                  className="cursor-pointer transition-all duration-300 hover:scale-110"
                  onMouseEnter={() => setOmniHover(true)}
                  onMouseLeave={() => setOmniHover(false)}
                  onClick={openChat}
                  title="Ask Omni"
                >
                  <OmniAvatar
                    mode={omniMode}
                    state={omniHover ? "wave" : omniEmotionalState}
                    size={120}
                    badge={false}
                    theme={theme}
                  />
                </div>
                <p className="text-[10px] text-zinc-500 mt-1.5 font-medium">Ask Omni</p>
              </div>
            )}

            {/* Right: Quick Stats */}
            <div className="lg:w-[400px] xl:w-[440px] shrink-0">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded-md bg-zinc-700/30 flex items-center justify-center">
                    <BarChart3 className="h-2.5 w-2.5 text-zinc-400" />
                  </div>
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Quick Stats</span>
                </div>
                {activeFilter && (
                  <button
                    onClick={() => onFilterChange(null)}
                    className="flex items-center gap-1 text-[10px] text-yellow-500 hover:text-yellow-400 transition-colors font-medium"
                  >
                    <X className="h-3 w-3" />
                    Clear
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <StatCard icon={<ListTodo className="h-3.5 w-3.5 text-zinc-300" />} label="Open Tasks" value={summary.totalOpen} color="bg-zinc-800/50" active={activeFilter === "open"} onClick={() => toggleFilter("open")} />
                <StatCard icon={<AlertTriangle className="h-3.5 w-3.5 text-red-400" />} label="Overdue" value={summary.totalOverdue} color="bg-red-950/40" active={activeFilter === "overdue"} onClick={() => toggleFilter("overdue")} highlight={summary.totalOverdue > 0} />
                <StatCard icon={<Flame className="h-3.5 w-3.5 text-yellow-400" />} label="High Priority" value={summary.totalHighPriority} color="bg-yellow-950/40" active={activeFilter === "high"} onClick={() => toggleFilter("high")} />
                <StatCard icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />} label="Done Today" value={summary.completedToday} color="bg-emerald-950/40" active={activeFilter === "done"} onClick={() => toggleFilter("done")} />
                <StatCard icon={<Star className="h-3.5 w-3.5 text-yellow-400" />} label="Starred Mail" value={summary.totalStarred} color="bg-yellow-950/40" active={activeFilter === "starred"} onClick={() => toggleFilter("starred")} />
                <StatCard icon={<Users className="h-3.5 w-3.5 text-blue-400" />} label="Pending" value={summary.totalPendingApprovals} color="bg-blue-950/40" active={activeFilter === "pending"} onClick={() => toggleFilter("pending")} hasNotification={summary.totalPendingApprovals > 0} />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Omni (visible on small screens) */}
        {omniMode !== "hidden" && (
          <div className="lg:hidden flex justify-center pb-4">
            <div
              className="cursor-pointer transition-all duration-300 hover:scale-110"
              onClick={openChat}
              title="Ask Omni"
            >
              <OmniAvatar
                mode={omniMode}
                state={omniEmotionalState}
                size={80}
                badge={false}
                theme={theme}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN TRIAGE FEED
// ═══════════════════════════════════════════════════════════════════════════
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
    onSuccess: (_data, variables) => {
      setSelectedApproval(null);
      utils.triage.feed.invalidate();
      utils.contacts.list.invalidate();
      toast("Contact approved", {
        description: "Click Undo to reverse",
        action: { label: "Undo", onClick: () => rejectContactMutation.mutate({ contactId: variables.contactId }) },
        duration: 5000,
      });
    },
    onError: () => toast.error("Could not approve contact"),
  });

  const rejectContactMutation = trpc.triage.rejectContact.useMutation({
    onSuccess: (_data, variables) => {
      setSelectedApproval(null);
      utils.triage.feed.invalidate();
      utils.contacts.list.invalidate();
      toast("Contact rejected", {
        description: "Click Undo to reverse",
        action: { label: "Undo", onClick: () => approveContactMutation.mutate({ contactId: variables.contactId }) },
        duration: 5000,
      });
    },
    onError: () => toast.error("Could not reject contact"),
  });

  const approveCompanyMutation = trpc.triage.approveCompany.useMutation({
    onSuccess: (_data, variables) => {
      setSelectedApproval(null);
      utils.triage.feed.invalidate();
      utils.companies.list.invalidate();
      toast("Company approved", {
        description: "Click Undo to reverse",
        action: { label: "Undo", onClick: () => rejectCompanyMutation.mutate({ companyId: variables.companyId }) },
        duration: 5000,
      });
    },
    onError: () => toast.error("Could not approve company"),
  });

  const rejectCompanyMutation = trpc.triage.rejectCompany.useMutation({
    onSuccess: (_data, variables) => {
      setSelectedApproval(null);
      utils.triage.feed.invalidate();
      utils.companies.list.invalidate();
      toast("Company rejected", {
        description: "Click Undo to reverse",
        action: { label: "Undo", onClick: () => approveCompanyMutation.mutate({ companyId: variables.companyId }) },
        duration: 5000,
      });
    },
    onError: () => toast.error("Could not reject company"),
  });

  const mergeAndApproveMutation = trpc.triage.mergeAndApprove.useMutation({
    onSuccess: (data) => {
      toast.success(`Merged into ${data.mergedInto}`);
      setSelectedApproval(null);
      utils.triage.feed.invalidate();
    },
    onError: () => toast.error("Could not merge contact"),
  });

  const mergeCompanyMutation = trpc.triage.mergeCompany.useMutation({
    onSuccess: (data) => {
      toast.success(`Merged into ${data.mergedInto}`);
      setSelectedApproval(null);
      utils.triage.feed.invalidate();
    },
    onError: () => toast.error("Could not merge company"),
  });

  const approveSuggestionMutation = trpc.contacts.approveSuggestion.useMutation({
    onSuccess: (_data, variables) => {
      utils.triage.feed.invalidate();
      toast("Suggestion approved", {
        description: "Click Undo to reverse",
        action: { label: "Undo", onClick: () => rejectSuggestionMutation.mutate({ id: variables.id }) },
        duration: 5000,
      });
    },
    onError: () => toast.error("Could not approve suggestion"),
  });

  const rejectSuggestionMutation = trpc.contacts.rejectSuggestion.useMutation({
    onSuccess: (_data, variables) => {
      utils.triage.feed.invalidate();
      toast("Suggestion dismissed", {
        description: "Click Undo to reverse",
        action: { label: "Undo", onClick: () => approveSuggestionMutation.mutate({ id: variables.id }) },
        duration: 5000,
      });
    },
    onError: () => toast.error("Could not dismiss suggestion"),
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
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-600" />
          <p className="text-xs text-zinc-500 font-medium">Loading your triage feed...</p>
        </div>
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
  const hasPendingSuggestions = (data.pendingSuggestions?.length ?? 0) > 0;
  const hasRecentMeetings = data.recentMeetings.length > 0;
  const hasTomorrowTasks = (data.tomorrowTasks?.length ?? 0) > 0;
  const hasWeekTasks = (data.weekTasks?.length ?? 0) > 0;
  const hasCompletedToday = (data.completedTodayTasks?.length ?? 0) > 0;

  const nothingToTriage =
    !hasOverdue && !hasTodayTasks && !hasHighPriority && !hasStarredEmails && !hasPendingContacts && !hasPendingCompanies && !hasPendingSuggestions;
  const allTodayDone = !hasOverdue && !hasTodayTasks && hasCompletedToday;

  return (
    <div className="p-5 lg:p-6 max-w-[1400px] mx-auto space-y-5">
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
          onMerge={(pendingId, mergeIntoId) => {
            if (selectedApproval.type === "contact") {
              mergeAndApproveMutation.mutate({ pendingId, mergeIntoId });
            } else {
              mergeCompanyMutation.mutate({ pendingId, mergeIntoId });
            }
          }}
          isActing={false}
        />
      )}

      {/* ── Hero Greeting ──────────────────────────────────────────── */}
      <HeroGreeting
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
        <div className="flex items-center gap-2.5 bg-yellow-500/5 border border-yellow-500/15 rounded-2xl px-5 py-3">
          <div className="h-7 w-7 rounded-xl bg-yellow-500/10 flex items-center justify-center">
            <Filter className="h-3.5 w-3.5 text-yellow-500" />
          </div>
          <span className="text-sm text-yellow-400 font-semibold">
            {activeFilter === "open" && "Showing all open tasks"}
            {activeFilter === "overdue" && "Showing overdue tasks"}
            {activeFilter === "high" && "Showing high priority tasks"}
            {activeFilter === "done" && "Showing tasks completed today"}
            {activeFilter === "starred" && "Showing starred emails"}
            {activeFilter === "pending" && "Showing pending approvals"}
          </span>
          <button
            onClick={() => setActiveFilter(null)}
            className="ml-auto p-1.5 rounded-xl hover:bg-yellow-900/20 text-yellow-500 hover:text-yellow-400 transition-all"
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
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
          className="bg-red-950/5 border border-red-900/10 rounded-2xl p-5"
        >
          {data.overdueTasks.length === 0 ? (
            <p className="text-sm text-zinc-500 py-4 text-center">No overdue tasks. You're on track.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {data.overdueTasks.map((t) => (
                <TaskCard key={t.id} task={t} showOverdue onClick={() => setSelectedTask(t)} onQuickComplete={(id) => completeMutation.mutate({ taskId: id })} isActing={actingIds.has(t.id)} />
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
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {[...data.overdueTasks.filter(t => t.priority === 'high'), ...data.todayTasks.filter(t => t.priority === 'high'), ...data.highPriorityTasks]
                .filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i)
                .map((t) => (
                  <TaskCard key={t.id} task={t} showOverdue={data.overdueTasks.some(o => o.id === t.id)} onClick={() => setSelectedTask(t)} onQuickComplete={(id) => completeMutation.mutate({ taskId: id })} isActing={actingIds.has(t.id)} />
                ))}
            </div>
          )}
        </Section>
      )}

      {activeFilter === "done" && (
        <Section icon={<Trophy className="h-4 w-4 text-emerald-400" />} title="Completed Today" count={data.completedTodayTasks?.length || 0} accentColor="bg-emerald-950/40">
          {!data.completedTodayTasks?.length ? (
            <p className="text-sm text-zinc-500 py-4 text-center">No tasks completed today yet.</p>
          ) : (
            <div className="space-y-2">
              {data.completedTodayTasks.map((t) => <CompletedRow key={t.id} task={t} />)}
            </div>
          )}
        </Section>
      )}

      {activeFilter === "starred" && (
        <Section icon={<Star className="h-4 w-4 text-yellow-500" />} title="Starred Emails" count={data.starredEmails.length} accentColor="bg-yellow-950/40" linkTo="/communications" linkLabel="Open inbox">
          {data.starredEmails.length === 0 ? (
            <p className="text-sm text-zinc-500 py-4 text-center">No starred emails.</p>
          ) : (
            <div className="space-y-2">
              {data.starredEmails.map((s) => {
                const starLabels: Record<number, string> = { 1: "Reply Today", 2: "Delegate", 3: "Critical" };
                const starColors: Record<number, string> = { 1: "text-yellow-500", 2: "text-orange-400", 3: "text-red-400" };
                return (
                  <Link key={s.threadId} href="/communications">
                    <div className="flex items-center gap-3 bg-zinc-900/40 border border-zinc-800/40 rounded-xl px-4 py-3 hover:border-zinc-700/50 transition-all cursor-pointer">
                      <Mail className="h-3.5 w-3.5 text-zinc-500" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-zinc-200 truncate">{s.subject || s.fromName || s.threadId.slice(0, 16) + "..."}</p>
                        {s.fromName && <p className="text-[10px] text-zinc-500 truncate">{s.fromName}{s.fromEmail ? ` <${s.fromEmail}>` : ""}</p>}
                      </div>
                      <span className={`text-xs shrink-0 ${starColors[s.starLevel] || "text-zinc-400"}`}>
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
        <>
        <Section icon={<UserPlus className="h-4 w-4 text-blue-400" />} title="Pending Approvals" count={data.pendingContacts.length + data.pendingCompanies.length} accentColor="bg-blue-950/40" linkTo="/relationships">
          {data.pendingContacts.length === 0 && data.pendingCompanies.length === 0 ? (
            <p className="text-sm text-zinc-500 py-4 text-center">No pending approvals.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.pendingContacts.map((c) => (
                <div key={`c-${c.id}`} onClick={() => setSelectedApproval({ item: c, type: "contact" })} className="flex items-center gap-3 bg-zinc-900/40 border border-zinc-800/40 rounded-xl px-4 py-3 hover:border-zinc-700/50 transition-all cursor-pointer">
                  <UserPlus className="h-3.5 w-3.5 text-blue-400/60" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-zinc-200 truncate">{c.name}</p>
                    {c.organization && <p className="text-[10px] text-zinc-500 truncate">{c.organization}</p>}
                  </div>
                  <ChevronRight className="h-3 w-3 text-zinc-700" />
                </div>
              ))}
              {data.pendingCompanies.map((c) => (
                <div key={`co-${c.id}`} onClick={() => setSelectedApproval({ item: c, type: "company" })} className="flex items-center gap-3 bg-zinc-900/40 border border-zinc-800/40 rounded-xl px-4 py-3 hover:border-zinc-700/50 transition-all cursor-pointer">
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

        {hasPendingSuggestions && (
          <Section icon={<Brain className="h-4 w-4 text-violet-400" />} title="Data Review Suggestions" count={data.pendingSuggestions?.length} accentColor="bg-violet-950/40">
            <div className="space-y-2">
              {data.pendingSuggestions?.map((s: any) => {
                const typeLabels: Record<string, string> = { company_link: "Company Association", enrichment: "Contact Enrichment", company_enrichment: "Company Enrichment" };
                return (
                  <div key={s.id} className="group flex items-center gap-3 bg-zinc-900/40 border border-zinc-800/40 rounded-xl px-4 py-3 hover:border-zinc-700/50 transition-all">
                    <Brain className="h-3.5 w-3.5 text-violet-400/60" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-zinc-200 truncate">
                        {s.type === 'company_link' ? `Link ${s.contactName} → ${s.suggestedCompanyName}` :
                         s.type === 'enrichment' ? `Enrich ${s.contactName}` : `Enrich ${s.companyName}`}
                      </p>
                      <p className="text-[10px] text-zinc-500">{typeLabels[s.type]} {s.confidence ? `• ${s.confidence}%` : ''}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => approveSuggestionMutation.mutate({ id: s.id })} className="p-1.5 rounded-xl hover:bg-emerald-950/50 text-zinc-600 hover:text-emerald-400 transition-all" title="Approve"><Check className="h-3.5 w-3.5" /></button>
                      <button onClick={() => rejectSuggestionMutation.mutate({ id: s.id })} className="p-1.5 rounded-xl hover:bg-red-950/50 text-zinc-600 hover:text-red-400 transition-all" title="Dismiss"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}
        </>
      )}

      {/* ── DEFAULT VIEW: No filter active ─────────────────────────── */}
      {!activeFilter && (
        <>
          {/* Celebration */}
          {allTodayDone && (
            <div className="flex items-center gap-4 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl p-5">
              <div className="p-3 rounded-2xl bg-emerald-500/10">
                <Trophy className="h-6 w-6 text-emerald-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-emerald-400">All tasks completed for today</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {data.completedTodayTasks?.length || 0} completed.
                  {hasTomorrowTasks ? ` ${data.tomorrowTasks?.length} coming tomorrow.` : ""}
                </p>
              </div>
              <Link href="/operations">
                <span className="text-xs text-emerald-500 hover:text-emerald-400 flex items-center gap-1.5 cursor-pointer font-medium">
                  View all <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            </div>
          )}

          {/* All clear */}
          {nothingToTriage && !allTodayDone && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 rounded-3xl bg-emerald-500/5 border border-emerald-500/10 mb-4">
                <Sparkles className="h-8 w-8 text-emerald-500" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">All Clear</h3>
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
              className="bg-red-950/5 border border-red-900/10 rounded-2xl p-5"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {data.overdueTasks.map((t) => (
                  <TaskCard key={t.id} task={t} showOverdue onClick={() => setSelectedTask(t)} onQuickComplete={(id) => completeMutation.mutate({ taskId: id })} isActing={actingIds.has(t.id)} />
                ))}
              </div>
            </Section>
          )}

          {/* Due today */}
          {hasTodayTasks && (
            <Section icon={<Clock className="h-4 w-4 text-yellow-500" />} title="Due Today" count={data.todayTasks.length} accentColor="bg-yellow-950/40" linkTo="/operations">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {data.todayTasks.map((t) => (
                  <TaskCard key={t.id} task={t} onClick={() => setSelectedTask(t)} onQuickComplete={(id) => completeMutation.mutate({ taskId: id })} isActing={actingIds.has(t.id)} />
                ))}
              </div>
            </Section>
          )}

          {/* Two-column: High Priority + Approvals/Starred */}
          {(hasHighPriority || hasStarredEmails || hasPendingContacts || hasPendingCompanies) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {hasHighPriority && (
                <Section icon={<Flame className="h-4 w-4 text-orange-400" />} title="High Priority" count={data.highPriorityTasks.length} accentColor="bg-orange-950/40" linkTo="/operations">
                  <div className="space-y-2">
                    {data.highPriorityTasks.slice(0, 6).map((t) => {
                      const cleanTitle = t.title.replace(/\s*\(Assigned to:.*?\)\s*$/, "");
                      return (
                        <div key={t.id} onClick={() => setSelectedTask(t)} className="group flex items-center gap-3 bg-zinc-900/40 border border-zinc-800/40 rounded-xl px-4 py-3 hover:border-zinc-700/50 hover:bg-zinc-900/60 transition-all duration-200 cursor-pointer">
                          <PriorityBadge priority={t.priority} />
                          <span className="text-sm text-zinc-200 truncate flex-1 group-hover:text-white transition-colors">{cleanTitle}</span>
                          {t.assignedName && <span className="text-[10px] text-zinc-500 shrink-0 hidden sm:inline">{t.assignedName}</span>}
                          <button onClick={(e) => { e.stopPropagation(); completeMutation.mutate({ taskId: t.id }); }} disabled={actingIds.has(t.id)} className="p-1.5 rounded-xl hover:bg-emerald-950/50 text-zinc-600 hover:text-emerald-400 transition-all opacity-0 group-hover:opacity-100 shrink-0" title="Complete">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </Section>
              )}

              <div className="space-y-5">
                {hasStarredEmails && (
                  <Section icon={<Star className="h-4 w-4 text-yellow-500" />} title="Starred Emails" count={data.starredEmails.length} accentColor="bg-yellow-950/40" linkTo="/communications">
                    <div className="space-y-2">
                      {data.starredEmails.map((s) => {
                        const starLabels: Record<number, string> = { 1: "Reply Today", 2: "Delegate", 3: "Critical" };
                        const starColors: Record<number, string> = { 1: "text-yellow-500", 2: "text-orange-400", 3: "text-red-400" };
                        return (
                          <Link key={s.threadId} href="/communications">
                            <div className="flex items-center gap-3 bg-zinc-900/40 border border-zinc-800/40 rounded-xl px-4 py-3 hover:border-zinc-700/50 transition-all cursor-pointer">
                              <Mail className="h-3.5 w-3.5 text-zinc-500" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-zinc-200 truncate">{s.subject || s.fromName || s.threadId.slice(0, 16) + "..."}</p>
                                {s.fromName && <p className="text-[10px] text-zinc-500 truncate">{s.fromName}{s.fromEmail ? ` <${s.fromEmail}>` : ""}</p>}
                              </div>
                              <span className={`text-xs shrink-0 ${starColors[s.starLevel] || "text-zinc-400"}`}>
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
                  <Section icon={<UserPlus className="h-4 w-4 text-blue-400" />} title="Pending Approvals" count={data.pendingContacts.length + data.pendingCompanies.length} accentColor="bg-blue-950/40" linkTo="/relationships">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {data.pendingContacts.map((c) => (
                        <div key={`c-${c.id}`} onClick={() => setSelectedApproval({ item: c, type: "contact" })} className="flex items-center gap-3 bg-zinc-900/40 border border-zinc-800/40 rounded-xl px-4 py-3 hover:border-zinc-700/50 transition-all cursor-pointer">
                          <UserPlus className="h-3.5 w-3.5 text-blue-400/60" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-zinc-200 truncate">{c.name}</p>
                            {c.organization && <p className="text-[10px] text-zinc-500 truncate">{c.organization}</p>}
                          </div>
                          <ChevronRight className="h-3 w-3 text-zinc-700" />
                        </div>
                      ))}
                      {data.pendingCompanies.map((c) => (
                        <div key={`co-${c.id}`} onClick={() => setSelectedApproval({ item: c, type: "company" })} className="flex items-center gap-3 bg-zinc-900/40 border border-zinc-800/40 rounded-xl px-4 py-3 hover:border-zinc-700/50 transition-all cursor-pointer">
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

          {/* Data Review Suggestions */}
          {hasPendingSuggestions && (
            <Section icon={<Brain className="h-4 w-4 text-violet-400" />} title="Data Review" count={data.pendingSuggestions?.length} accentColor="bg-violet-950/40">
              <div className="space-y-2">
                {data.pendingSuggestions?.map((s: any) => {
                  const typeLabels: Record<string, string> = { company_link: "Company Association", enrichment: "Contact Enrichment", company_enrichment: "Company Enrichment" };
                  const typeIcons: Record<string, React.ReactNode> = {
                    company_link: <Building2 className="h-3.5 w-3.5 text-purple-400/60" />,
                    enrichment: <Sparkles className="h-3.5 w-3.5 text-amber-400/60" />,
                    company_enrichment: <Building2 className="h-3.5 w-3.5 text-blue-400/60" />,
                  };

                  return (
                    <div key={s.id} className="group bg-zinc-900/40 border border-zinc-800/40 rounded-xl px-4 py-3 hover:border-zinc-700/50 transition-all">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">{typeIcons[s.type] || <Zap className="h-3.5 w-3.5 text-zinc-500" />}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-semibold text-violet-400/80 uppercase tracking-wider">{typeLabels[s.type] || s.type}</span>
                            {s.confidence && (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                                s.confidence >= 80 ? 'bg-emerald-950/50 text-emerald-400' :
                                s.confidence >= 50 ? 'bg-amber-950/50 text-amber-400' :
                                'bg-zinc-800/50 text-zinc-400'
                              }`}>{s.confidence}% match</span>
                            )}
                          </div>
                          {s.type === 'company_link' && (
                            <p className="text-sm text-zinc-200">Link <span className="text-white font-medium">{s.contactName}</span> to <span className="text-purple-300 font-medium">{s.suggestedCompanyName}</span></p>
                          )}
                          {s.type === 'enrichment' && s.suggestedData && (
                            <div>
                              <p className="text-sm text-zinc-200 mb-1">Update <span className="text-white font-medium">{s.contactName}</span></p>
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(s.suggestedData).map(([key, val]) => (
                                  <span key={key} className="text-[10px] bg-zinc-800/60 border border-zinc-700/30 rounded-full px-2 py-0.5 text-zinc-300">
                                    {key}: <span className="text-amber-300">{String(val)}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {s.type === 'company_enrichment' && s.suggestedData && (
                            <div>
                              <p className="text-sm text-zinc-200 mb-1">Update <span className="text-white font-medium">{s.companyName}</span></p>
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(s.suggestedData).map(([key, val]) => (
                                  <span key={key} className="text-[10px] bg-zinc-800/60 border border-zinc-700/30 rounded-full px-2 py-0.5 text-zinc-300">
                                    {key}: <span className="text-blue-300">{String(val)}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {s.reason && <p className="text-[10px] text-zinc-500 mt-1">{s.reason}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => approveSuggestionMutation.mutate({ id: s.id })} disabled={approveSuggestionMutation.isPending} className="p-1.5 rounded-xl hover:bg-emerald-950/50 text-zinc-500 hover:text-emerald-400 transition-all" title="Approve"><Check className="h-3.5 w-3.5" /></button>
                          <button onClick={() => rejectSuggestionMutation.mutate({ id: s.id })} disabled={rejectSuggestionMutation.isPending} className="p-1.5 rounded-xl hover:bg-red-950/50 text-zinc-500 hover:text-red-400 transition-all" title="Dismiss"><X className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Unread Emails */}
          <UnreadEmailsSection />

          {/* Completed today */}
          {hasCompletedToday && (
            <Section icon={<Trophy className="h-4 w-4 text-emerald-400" />} title="Completed Today" count={data.completedTodayTasks?.length} accentColor="bg-emerald-950/40" collapsible defaultOpen={false}>
              <div className="space-y-2">
                {data.completedTodayTasks?.map((t) => <CompletedRow key={t.id} task={t} />)}
              </div>
            </Section>
          )}

          {/* Tomorrow + This week */}
          {(hasTomorrowTasks || hasWeekTasks) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {hasTomorrowTasks && (
                <Section icon={<Sunrise className="h-4 w-4 text-amber-400" />} title="Tomorrow" count={data.tomorrowTasks?.length} accentColor="bg-amber-950/40" linkTo="/operations" collapsible>
                  <div className="space-y-2">
                    {data.tomorrowTasks?.map((t) => <CompactTaskRow key={t.id} task={t} onClick={() => setSelectedTask({ ...t, notes: "" })} />)}
                  </div>
                </Section>
              )}

              {hasWeekTasks && (
                <Section icon={<CalendarDays className="h-4 w-4 text-blue-400" />} title="This Week" count={data.weekTasks?.length} accentColor="bg-blue-950/40" linkTo="/operations" collapsible>
                  <div className="space-y-2">
                    {data.weekTasks?.map((t) => <CompactTaskRow key={t.id} task={t} showDate onClick={() => setSelectedTask({ ...t, notes: "" })} />)}
                  </div>
                </Section>
              )}
            </div>
          )}

          {/* Recent meetings */}
          {hasRecentMeetings && (
            <Section icon={<Calendar className="h-4 w-4 text-emerald-400" />} title="Recent Intelligence" count={data.recentMeetings.length} accentColor="bg-emerald-950/40" linkTo="/intelligence" linkLabel="All meetings">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {data.recentMeetings.map((m) => <MeetingCard key={m.id} meeting={m} />)}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
