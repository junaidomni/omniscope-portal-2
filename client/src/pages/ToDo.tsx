import { useState, useMemo, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Plus, Search, CheckSquare, Clock, Tag, Trash2, Calendar,
  ListFilter, LayoutGrid, Target, TrendingUp, Zap, Award,
  ChevronRight, Edit3, MessageSquare, User, Flag, FolderOpen,
  X, ArrowUp, ArrowRight, ArrowDown
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

// Team members
const TEAM_MEMBERS = ["Junaid", "Kyle", "Jake", "Sania"];

// Default categories
const DEFAULT_CATEGORIES = [
  "Little Miracles", "Gold", "BTC", "Private Placement",
  "Real Estate", "Stablecoins", "Commodities", "Payment Rails", "General"
];

// Priority colors
const PRIORITY_CONFIG = {
  high: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", icon: ArrowUp, label: "High" },
  medium: { color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", icon: ArrowRight, label: "Medium" },
  low: { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", icon: ArrowDown, label: "Low" },
};

// Status config
const STATUS_CONFIG = {
  open: { color: "text-zinc-400", bg: "bg-zinc-500/10", label: "Open" },
  in_progress: { color: "text-yellow-400", bg: "bg-yellow-500/10", label: "In Progress" },
  completed: { color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Completed" },
};

// ============================================================================
// ANIMATED PROGRESS BAR (XP-style)
// ============================================================================

function XPProgressBar({ value, label, sublabel }: { value: number; label: string; sublabel?: string }) {
  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedValue(value), 100);
    return () => clearTimeout(timer);
  }, [value]);

  const getBarColor = () => {
    if (animatedValue >= 80) return "from-emerald-500 to-emerald-400";
    if (animatedValue >= 50) return "from-yellow-600 to-yellow-500";
    if (animatedValue >= 25) return "from-orange-500 to-orange-400";
    return "from-red-500 to-red-400";
  };

  const getGlowColor = () => {
    if (animatedValue >= 80) return "shadow-emerald-500/30";
    if (animatedValue >= 50) return "shadow-yellow-500/30";
    return "shadow-orange-500/30";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white">{label}</span>
        <div className="flex items-center gap-2">
          {sublabel && <span className="text-xs text-zinc-500">{sublabel}</span>}
          <span className={`text-sm font-bold tabular-nums ${
            animatedValue >= 80 ? "text-emerald-400" :
            animatedValue >= 50 ? "text-yellow-500" : "text-orange-400"
          }`}>
            {Math.round(animatedValue)}%
          </span>
        </div>
      </div>
      <div className="relative h-3 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${getBarColor()} transition-all duration-1000 ease-out ${getGlowColor()} shadow-lg`}
          style={{ width: `${animatedValue}%` }}
        />
        {/* Shimmer effect */}
        {animatedValue > 0 && animatedValue < 100 && (
          <div
            className="absolute inset-y-0 left-0 rounded-full overflow-hidden"
            style={{ width: `${animatedValue}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// STATS DASHBOARD
// ============================================================================

function TaskDashboard({
  stats,
  personFilter,
}: {
  stats: {
    total: number;
    open: number;
    inProgress: number;
    completed: number;
    completedToday: number;
    highPriority: number;
    overdue: number;
  };
  personFilter: string;
}) {
  const completionRate = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
  const activeRate = stats.total > 0 ? ((stats.open + stats.inProgress) / stats.total) * 100 : 0;

  const personLabel = personFilter === "all" ? "Team" : personFilter;

  return (
    <div className="space-y-4 mb-6">
      {/* Main XP Progress Bar */}
      <Card className="bg-zinc-900/80 border-zinc-800 overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-lg bg-yellow-600/20 flex items-center justify-center">
              <Target className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">{personLabel} Progress</h3>
              <p className="text-xs text-zinc-500">
                {stats.completed} of {stats.total} tasks completed
              </p>
            </div>
            {completionRate >= 100 && (
              <Badge className="ml-auto bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                <Award className="h-3 w-3 mr-1" />
                All Done!
              </Badge>
            )}
          </div>
          <XPProgressBar
            value={completionRate}
            label="Completion Rate"
            sublabel={`${stats.completed}/${stats.total} tasks`}
          />
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<CheckSquare className="h-4 w-4" />}
          label="Completed"
          value={stats.completed}
          sublabel={`${stats.completedToday} today`}
          color="emerald"
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="In Progress"
          value={stats.inProgress}
          sublabel={`${Math.round(activeRate)}% active`}
          color="yellow"
        />
        <StatCard
          icon={<Zap className="h-4 w-4" />}
          label="Open"
          value={stats.open}
          sublabel="to do"
          color="blue"
        />
        <StatCard
          icon={<Flag className="h-4 w-4" />}
          label="High Priority"
          value={stats.highPriority}
          sublabel={stats.overdue > 0 ? `${stats.overdue} overdue` : "on track"}
          color={stats.highPriority > 0 ? "red" : "zinc"}
        />
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sublabel,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sublabel: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-400 bg-emerald-500/10",
    yellow: "text-yellow-400 bg-yellow-500/10",
    blue: "text-blue-400 bg-blue-500/10",
    red: "text-red-400 bg-red-500/10",
    zinc: "text-zinc-400 bg-zinc-500/10",
  };
  const [iconColor, iconBg] = (colorMap[color] || colorMap.zinc).split(" ");

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={`h-7 w-7 rounded-md ${iconBg} flex items-center justify-center ${iconColor}`}>
            {icon}
          </div>
        </div>
        <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
        <p className="text-[10px] text-zinc-600 mt-0.5">{sublabel}</p>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// TASK DETAIL SHEET (Airtable-style expandable view)
// ============================================================================

function TaskDetailSheet({
  task,
  open,
  onOpenChange,
  categories,
  onUpdate,
  onDelete,
}: {
  task: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: string[];
  onUpdate: (id: number, updates: any) => void;
  onDelete: (id: number) => void;
}) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState(task?.title || "");
  const [editDescription, setEditDescription] = useState(task?.description || "");
  const [editNotes, setEditNotes] = useState(task?.notes || "");

  // Reset when task changes
  useEffect(() => {
    if (task) {
      setEditTitle(task.title || "");
      setEditDescription(task.description || "");
      setEditNotes(task.notes || "");
      setEditingField(null);
    }
  }, [task?.id]);

  if (!task) return null;

  const priorityConf = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;
  const statusConf = STATUS_CONFIG[task.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.open;
  const PriorityIcon = priorityConf.icon;

  const saveField = (field: string, value: any) => {
    onUpdate(task.id, { [field]: value });
    setEditingField(null);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl bg-zinc-950 border-zinc-800 overflow-y-auto">
        <SheetHeader className="pb-0">
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
            <CheckSquare className="h-3 w-3" />
            <span>Task #{task.id}</span>
            {task.isAutoGenerated && (
              <Badge variant="outline" className="border-zinc-800 text-zinc-600 text-[10px]">Auto-generated</Badge>
            )}
            {task.meetingId && (
              <Link href={`/meeting/${task.meetingId}`}>
                <Badge variant="outline" className="border-zinc-800 text-yellow-600 text-[10px] cursor-pointer hover:border-yellow-600/30">
                  From Meeting
                </Badge>
              </Link>
            )}
          </div>
        </SheetHeader>

        <div className="px-4 pb-8 space-y-6">
          {/* Title - Click to edit */}
          <div>
            {editingField === "title" ? (
              <div className="space-y-2">
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white text-lg font-semibold"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveField("title", editTitle);
                    if (e.key === "Escape") setEditingField(null);
                  }}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveField("title", editTitle)} className="bg-yellow-600 hover:bg-yellow-500 text-black text-xs h-7">Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingField(null)} className="text-zinc-400 text-xs h-7">Cancel</Button>
                </div>
              </div>
            ) : (
              <h2
                onClick={() => setEditingField("title")}
                className="text-xl font-bold text-white cursor-pointer hover:text-yellow-500 transition-colors group"
              >
                {task.title}
                <Edit3 className="h-3.5 w-3.5 inline ml-2 opacity-0 group-hover:opacity-100 text-zinc-500" />
              </h2>
            )}
          </div>

          <Separator className="bg-zinc-800" />

          {/* Properties Grid */}
          <div className="space-y-4">
            {/* Status */}
            <PropertyRow label="Status" icon={<Clock className="h-3.5 w-3.5" />}>
              <Select
                value={task.status}
                onValueChange={(v) => onUpdate(task.id, { status: v })}
              >
                <SelectTrigger className="h-8 bg-zinc-800 border-zinc-700 text-zinc-300 text-sm w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </PropertyRow>

            {/* Priority */}
            <PropertyRow label="Priority" icon={<Flag className="h-3.5 w-3.5" />}>
              <Select
                value={task.priority}
                onValueChange={(v) => onUpdate(task.id, { priority: v })}
              >
                <SelectTrigger className="h-8 bg-zinc-800 border-zinc-700 text-zinc-300 text-sm w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="high">
                    <span className="flex items-center gap-2"><ArrowUp className="h-3 w-3 text-red-400" /> High</span>
                  </SelectItem>
                  <SelectItem value="medium">
                    <span className="flex items-center gap-2"><ArrowRight className="h-3 w-3 text-yellow-400" /> Medium</span>
                  </SelectItem>
                  <SelectItem value="low">
                    <span className="flex items-center gap-2"><ArrowDown className="h-3 w-3 text-blue-400" /> Low</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </PropertyRow>

            {/* Assignee */}
            <PropertyRow label="Assignee" icon={<User className="h-3.5 w-3.5" />}>
              <Select
                value={task.assignedName || "unassigned"}
                onValueChange={(v) => onUpdate(task.id, { assignedName: v === "unassigned" ? null : v })}
              >
                <SelectTrigger className="h-8 bg-zinc-800 border-zinc-700 text-zinc-300 text-sm w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {TEAM_MEMBERS.map(name => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PropertyRow>

            {/* Category */}
            <PropertyRow label="Category" icon={<FolderOpen className="h-3.5 w-3.5" />}>
              <Select
                value={task.category || "none"}
                onValueChange={(v) => onUpdate(task.id, { category: v === "none" ? null : v })}
              >
                <SelectTrigger className="h-8 bg-zinc-800 border-zinc-700 text-zinc-300 text-sm w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="none">No Category</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PropertyRow>

            {/* Due Date */}
            <PropertyRow label="Due Date" icon={<Calendar className="h-3.5 w-3.5" />}>
              <Input
                type="date"
                value={task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ""}
                onChange={(e) => onUpdate(task.id, { dueDate: e.target.value || null })}
                className="h-8 bg-zinc-800 border-zinc-700 text-zinc-300 text-sm w-40"
              />
            </PropertyRow>

            {/* Created */}
            <PropertyRow label="Created" icon={<Clock className="h-3.5 w-3.5" />}>
              <span className="text-sm text-zinc-400">
                {new Date(task.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </PropertyRow>
          </div>

          <Separator className="bg-zinc-800" />

          {/* Description */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Edit3 className="h-3.5 w-3.5 text-zinc-500" />
              <span className="text-sm font-medium text-zinc-400">Description</span>
            </div>
            {editingField === "description" ? (
              <div className="space-y-2">
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white min-h-24"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveField("description", editDescription || null)} className="bg-yellow-600 hover:bg-yellow-500 text-black text-xs h-7">Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingField(null)} className="text-zinc-400 text-xs h-7">Cancel</Button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setEditingField("description")}
                className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 cursor-pointer hover:border-zinc-700 transition-colors min-h-16"
              >
                {task.description ? (
                  <p className="text-sm text-zinc-300 whitespace-pre-wrap">{task.description}</p>
                ) : (
                  <p className="text-sm text-zinc-600 italic">Click to add a description...</p>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-3.5 w-3.5 text-zinc-500" />
              <span className="text-sm font-medium text-zinc-400">Notes</span>
            </div>
            {editingField === "notes" ? (
              <div className="space-y-2">
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white min-h-32"
                  placeholder="Add notes, updates, or context..."
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveField("notes", editNotes || null)} className="bg-yellow-600 hover:bg-yellow-500 text-black text-xs h-7">Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingField(null)} className="text-zinc-400 text-xs h-7">Cancel</Button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setEditingField("notes")}
                className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 cursor-pointer hover:border-zinc-700 transition-colors min-h-16"
              >
                {task.notes ? (
                  <p className="text-sm text-zinc-300 whitespace-pre-wrap">{task.notes}</p>
                ) : (
                  <p className="text-sm text-zinc-600 italic">Click to add notes...</p>
                )}
              </div>
            )}
          </div>

          <Separator className="bg-zinc-800" />

          {/* Danger Zone */}
          <div className="pt-2">
            <Button
              variant="outline"
              className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 w-full"
              onClick={() => {
                if (confirm("Are you sure you want to delete this task?")) {
                  onDelete(task.id);
                  onOpenChange(false);
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Task
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PropertyRow({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-zinc-500">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      {children}
    </div>
  );
}

// ============================================================================
// MAIN TODO PAGE
// ============================================================================

export default function ToDo() {
  const { data: allTasks, isLoading } = trpc.tasks.list.useQuery();
  const { data: categories } = trpc.tasks.categories.useQuery();
  const utils = trpc.useUtils();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterPerson, setFilterPerson] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [viewMode, setViewMode] = useState<"list" | "board">("list");
  const [showNewTask, setShowNewTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Mutations
  const updateTask = trpc.tasks.update.useMutation({
    onSuccess: () => utils.tasks.list.invalidate(),
    onError: () => toast.error("Failed to update task"),
  });
  const deleteTask = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      toast.success("Task deleted");
      utils.tasks.list.invalidate();
    },
    onError: () => toast.error("Failed to delete task"),
  });

  // Filter tasks
  const filteredTasks = useMemo(() => {
    if (!allTasks) return [];
    return allTasks.filter(t => {
      if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        if (!t.title.toLowerCase().includes(lower) && !t.description?.toLowerCase().includes(lower)) return false;
      }
      if (filterPerson !== "all" && t.assignedName !== filterPerson) return false;
      if (filterCategory !== "all" && t.category !== filterCategory) return false;
      if (filterStatus === "active" && t.status === "completed") return false;
      if (filterStatus === "completed" && t.status !== "completed") return false;
      return true;
    });
  }, [allTasks, searchTerm, filterPerson, filterCategory, filterStatus]);

  // Group by category for board view
  const groupedByCategory = useMemo(() => {
    const groups: Record<string, typeof filteredTasks> = {};
    for (const t of filteredTasks) {
      const cat = t.category || "Uncategorized";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(t);
    }
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredTasks]);

  // All known categories
  const allCategories = useMemo(() => {
    const set = new Set(DEFAULT_CATEGORIES);
    categories?.forEach(c => { if (c.category) set.add(c.category); });
    allTasks?.forEach(t => { if (t.category) set.add(t.category); });
    return Array.from(set).sort();
  }, [categories, allTasks]);

  // Compute stats based on current filter context
  const stats = useMemo(() => {
    const tasks = filterPerson === "all" ? (allTasks || []) : (allTasks || []).filter(t => t.assignedName === filterPerson);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    return {
      total: tasks.length,
      open: tasks.filter(t => t.status === "open").length,
      inProgress: tasks.filter(t => t.status === "in_progress").length,
      completed: tasks.filter(t => t.status === "completed").length,
      completedToday: tasks.filter(t => t.status === "completed" && t.completedAt && new Date(t.completedAt).toISOString().split('T')[0] === todayStr).length,
      highPriority: tasks.filter(t => t.priority === "high" && t.status !== "completed").length,
      overdue: tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== "completed").length,
    };
  }, [allTasks, filterPerson]);

  const toggleComplete = (task: any) => {
    updateTask.mutate({
      id: task.id,
      status: task.status === "completed" ? "open" : "completed",
    });
  };

  const handleTaskClick = (task: any) => {
    setSelectedTask(task);
    setDetailOpen(true);
  };

  const handleTaskUpdate = (id: number, updates: any) => {
    updateTask.mutate({ id, ...updates });
    // Update local selected task for immediate feedback
    if (selectedTask?.id === id) {
      setSelectedTask((prev: any) => prev ? { ...prev, ...updates } : prev);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <Skeleton className="h-10 w-64 bg-zinc-800/50" />
        <Skeleton className="h-32 bg-zinc-800/50 rounded-lg" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 bg-zinc-800/50 rounded-lg" />)}
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-14 bg-zinc-800/50 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Tasks</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {filterPerson !== "all" ? `${filterPerson}'s tasks` : "Team task management"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 ${viewMode === "list" ? "bg-yellow-600/20 text-yellow-500" : "text-zinc-500 hover:text-white"}`}
            >
              <ListFilter className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("board")}
              className={`p-2 ${viewMode === "board" ? "bg-yellow-600/20 text-yellow-500" : "text-zinc-500 hover:text-white"}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>

          <Dialog open={showNewTask} onOpenChange={setShowNewTask}>
            <DialogTrigger asChild>
              <Button className="bg-yellow-600 hover:bg-yellow-500 text-black font-medium">
                <Plus className="h-4 w-4 mr-2" />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-white">Create Task</DialogTitle>
              </DialogHeader>
              <NewTaskForm
                categories={allCategories}
                onSuccess={() => {
                  setShowNewTask(false);
                  utils.tasks.list.invalidate();
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Dashboard Stats */}
      <TaskDashboard stats={stats} personFilter={filterPerson} />

      {/* Team Member Filters */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
        <User className="h-3.5 w-3.5 text-zinc-600 flex-shrink-0" />
        <button
          onClick={() => setFilterPerson("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap
            ${filterPerson === "all"
              ? "bg-yellow-600/20 text-yellow-500 border border-yellow-600/30"
              : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700"}`}
        >
          All Team
        </button>
        {TEAM_MEMBERS.map(name => {
          const personTasks = allTasks?.filter(t => t.assignedName === name) || [];
          const personCompleted = personTasks.filter(t => t.status === "completed").length;
          const personTotal = personTasks.length;
          return (
            <button
              key={name}
              onClick={() => setFilterPerson(filterPerson === name ? "all" : name)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5
                ${filterPerson === name
                  ? "bg-yellow-600/20 text-yellow-500 border border-yellow-600/30"
                  : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700"}`}
            >
              <span className="h-4 w-4 rounded-full bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-yellow-600">
                {name.charAt(0)}
              </span>
              {name}
              {personTotal > 0 && (
                <span className="text-[10px] text-zinc-600">{personCompleted}/{personTotal}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Category Filters */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
        <Tag className="h-3.5 w-3.5 text-zinc-600 flex-shrink-0" />
        <button
          onClick={() => setFilterCategory("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap
            ${filterCategory === "all"
              ? "bg-zinc-700 text-white"
              : "bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-700"}`}
        >
          All
        </button>
        {allCategories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCategory(filterCategory === cat ? "all" : cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap
              ${filterCategory === cat
                ? "bg-zinc-700 text-white"
                : "bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-700"}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Search + Status Filter */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 bg-zinc-900 border-zinc-800 text-zinc-300">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="all">All Tasks</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Task Count */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-zinc-500">{filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Task List View */}
      {viewMode === "list" ? (
        <div className="space-y-1">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-16">
              <CheckSquare className="h-12 w-12 mx-auto mb-3 text-zinc-700" />
              <p className="text-zinc-500">No tasks found</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNewTask(true)}
                className="text-yellow-600 hover:text-yellow-500 mt-2"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Create Task
              </Button>
            </div>
          ) : (
            filteredTasks.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={() => toggleComplete(task)}
                onClick={() => handleTaskClick(task)}
                onDelete={() => {
                  if (confirm("Delete this task?")) deleteTask.mutate({ id: task.id });
                }}
              />
            ))
          )}
        </div>
      ) : (
        /* Board View - Grouped by Category */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groupedByCategory.length === 0 ? (
            <div className="col-span-full text-center py-16">
              <CheckSquare className="h-12 w-12 mx-auto mb-3 text-zinc-700" />
              <p className="text-zinc-500">No tasks found</p>
            </div>
          ) : (
            groupedByCategory.map(([category, tasks]) => {
              const catCompleted = tasks.filter(t => t.status === "completed").length;
              const catTotal = tasks.length;
              const catPercent = catTotal > 0 ? Math.round((catCompleted / catTotal) * 100) : 0;

              return (
                <Card key={category} className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold text-white">{category}</CardTitle>
                      <Badge variant="outline" className="border-zinc-700 text-zinc-500 text-xs">
                        {catCompleted}/{catTotal}
                      </Badge>
                    </div>
                    {/* Mini progress bar per category */}
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-2">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          catPercent >= 80 ? "bg-emerald-500" : catPercent >= 50 ? "bg-yellow-500" : "bg-orange-500"
                        }`}
                        style={{ width: `${catPercent}%` }}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {tasks.map(task => (
                      <div
                        key={task.id}
                        onClick={() => handleTaskClick(task)}
                        className={`p-3 rounded-lg border transition-all cursor-pointer ${
                          task.status === "completed"
                            ? "bg-zinc-800/30 border-zinc-800/50"
                            : "bg-zinc-800/50 border-zinc-800 hover:border-yellow-600/30"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <Checkbox
                            checked={task.status === "completed"}
                            onCheckedChange={(e) => { e; toggleComplete(task); }}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-0.5 border-zinc-600 data-[state=checked]:bg-yellow-600 data-[state=checked]:border-yellow-600"
                          />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${task.status === "completed" ? "text-zinc-500 line-through" : "text-white"}`}>
                              {task.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5">
                              {task.assignedName && (
                                <span className="text-xs text-zinc-500">{task.assignedName}</span>
                              )}
                              {task.priority === "high" && (
                                <Badge variant="outline" className="border-red-600/30 text-red-400 text-xs py-0">!</Badge>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-zinc-600 flex-shrink-0 mt-1" />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Task Detail Sheet */}
      <TaskDetailSheet
        task={selectedTask}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        categories={allCategories}
        onUpdate={handleTaskUpdate}
        onDelete={(id) => {
          deleteTask.mutate({ id });
          setDetailOpen(false);
        }}
      />
    </div>
  );
}

// ============================================================================
// TASK ROW - Individual task in list view (clickable)
// ============================================================================

function TaskRow({
  task,
  onToggle,
  onClick,
  onDelete,
}: {
  task: any;
  onToggle: () => void;
  onClick: () => void;
  onDelete: () => void;
}) {
  const isCompleted = task.status === "completed";
  const priorityConf = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;
  const PriorityIcon = priorityConf.icon;

  return (
    <div
      onClick={onClick}
      className={`group flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer ${
        isCompleted
          ? "bg-zinc-900/20 border border-zinc-800/40"
          : "bg-zinc-900/50 border border-zinc-800/60 hover:border-yellow-600/30 hover:bg-zinc-900/80"
      }`}
    >
      {/* Checkbox */}
      <Checkbox
        checked={isCompleted}
        onCheckedChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        className="border-zinc-600 data-[state=checked]:bg-yellow-600 data-[state=checked]:border-yellow-600"
      />

      {/* Priority indicator */}
      <PriorityIcon className={`h-3.5 w-3.5 flex-shrink-0 ${priorityConf.color}`} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isCompleted ? "text-zinc-500 line-through" : "text-white"}`}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-zinc-600 line-clamp-1 mt-0.5">{task.description}</p>
        )}
      </div>

      {/* Category badge */}
      {task.category && (
        <Badge variant="outline" className="border-zinc-700 text-zinc-500 text-xs hidden sm:flex">
          {task.category}
        </Badge>
      )}

      {/* Assignee */}
      {task.assignedName && (
        <div className="flex items-center gap-1.5 flex-shrink-0 hidden sm:flex">
          <div className="h-5 w-5 rounded-full bg-zinc-800 flex items-center justify-center">
            <span className="text-[10px] font-semibold text-yellow-600">
              {task.assignedName.charAt(0)}
            </span>
          </div>
          <span className="text-xs text-zinc-500">{task.assignedName}</span>
        </div>
      )}

      {/* Due date */}
      {task.dueDate && (
        <span className={`text-xs flex-shrink-0 hidden md:block ${
          new Date(task.dueDate) < new Date() && task.status !== "completed"
            ? "text-red-400"
            : "text-zinc-600"
        }`}>
          {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      )}

      {/* Meeting link */}
      {task.meetingId && (
        <Link href={`/meeting/${task.meetingId}`} onClick={(e: any) => e.stopPropagation()}>
          <Badge variant="outline" className="border-zinc-800 text-zinc-600 text-xs cursor-pointer hover:text-yellow-500 hover:border-yellow-600/30">
            <Calendar className="h-3 w-3 mr-1" />
            Meeting
          </Badge>
        </Link>
      )}

      {/* Expand arrow */}
      <ChevronRight className="h-4 w-4 text-zinc-700 group-hover:text-zinc-400 transition-colors flex-shrink-0" />
    </div>
  );
}

// ============================================================================
// NEW TASK FORM
// ============================================================================

function NewTaskForm({
  categories,
  onSuccess,
}: {
  categories: string[];
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [assignedName, setAssignedName] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [dueDate, setDueDate] = useState("");

  const createTask = trpc.tasks.create.useMutation({
    onSuccess: () => {
      toast.success("Task created");
      onSuccess();
    },
    onError: () => toast.error("Failed to create task"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createTask.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      assignedName: assignedName || undefined,
      category: category || undefined,
      dueDate: dueDate || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Input
          placeholder="Task title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
          autoFocus
        />
      </div>

      <div>
        <Textarea
          placeholder="Description (optional)..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 min-h-20"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Priority */}
        <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
          <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-300">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="low">Low Priority</SelectItem>
            <SelectItem value="medium">Medium Priority</SelectItem>
            <SelectItem value="high">High Priority</SelectItem>
          </SelectContent>
        </Select>

        {/* Assign to */}
        <Select value={assignedName} onValueChange={setAssignedName}>
          <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-300">
            <SelectValue placeholder="Assign to..." />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {TEAM_MEMBERS.map(name => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Category */}
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-300">
            <SelectValue placeholder="Category..." />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="none">No Category</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Due date */}
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="bg-zinc-800 border-zinc-700 text-zinc-300"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="submit"
          disabled={!title.trim() || createTask.isPending}
          className="bg-yellow-600 hover:bg-yellow-500 text-black font-medium"
        >
          {createTask.isPending ? "Creating..." : "Create Task"}
        </Button>
      </div>
    </form>
  );
}
