import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Plus, Search, CheckSquare, Clock, Tag, Trash2, Calendar,
  ListFilter, Columns3, Target, TrendingUp, Zap, Award,
  ChevronRight, Edit3, MessageSquare, User, Flag, FolderOpen,
  ArrowUp, ArrowRight, ArrowDown, GripVertical, MoreHorizontal
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
  high: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", icon: ArrowUp, label: "High", dotColor: "bg-red-500" },
  medium: { color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", icon: ArrowRight, label: "Medium", dotColor: "bg-yellow-500" },
  low: { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", icon: ArrowDown, label: "Low", dotColor: "bg-blue-500" },
};

// Status config for Kanban columns
const KANBAN_COLUMNS = [
  { id: "open", label: "To Do", color: "text-zinc-400", bg: "bg-zinc-500/10", borderColor: "border-zinc-700", headerBg: "bg-zinc-800/50", dotColor: "bg-zinc-400" },
  { id: "in_progress", label: "In Progress", color: "text-yellow-400", bg: "bg-yellow-500/10", borderColor: "border-yellow-600/30", headerBg: "bg-yellow-900/20", dotColor: "bg-yellow-500" },
  { id: "completed", label: "Completed", color: "text-emerald-400", bg: "bg-emerald-500/10", borderColor: "border-emerald-600/30", headerBg: "bg-emerald-900/20", dotColor: "bg-emerald-500" },
];

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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon={<CheckSquare className="h-4 w-4" />} label="Completed" value={stats.completed} sublabel={`${stats.completedToday} today`} color="emerald" />
        <StatCard icon={<Clock className="h-4 w-4" />} label="In Progress" value={stats.inProgress} sublabel={`${Math.round(activeRate)}% active`} color="yellow" />
        <StatCard icon={<Zap className="h-4 w-4" />} label="To Do" value={stats.open} sublabel="queued" color="blue" />
        <StatCard icon={<Flag className="h-4 w-4" />} label="High Priority" value={stats.highPriority} sublabel={stats.overdue > 0 ? `${stats.overdue} overdue` : "on track"} color={stats.highPriority > 0 ? "red" : "zinc"} />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Total" value={stats.total} sublabel="all tasks" color="zinc" />
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sublabel, color }: { icon: React.ReactNode; label: string; value: number; sublabel: string; color: string }) {
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
// KANBAN CARD (Draggable)
// ============================================================================

function KanbanCard({
  task,
  onClick,
  onDragStart,
}: {
  task: any;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  const isCompleted = task.status === "completed";
  const priorityConf = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;
  const PriorityIcon = priorityConf.icon;
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isCompleted;
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div
      draggable={true}
      onDragStart={(e) => {
        setIsDragging(true);
        onDragStart(e);
      }}
      onDragEnd={() => setIsDragging(false)}
      onClick={(e) => {
        if (!isDragging) onClick();
      }}
      className={`group p-3 rounded-lg border transition-all cursor-grab active:cursor-grabbing select-none ${
        isDragging ? "opacity-40 scale-95 ring-2 ring-yellow-600" :
        isCompleted
          ? "bg-zinc-800/20 border-zinc-800/40 opacity-70"
          : "bg-zinc-800/50 border-zinc-800 hover:border-yellow-600/30 hover:bg-zinc-800/80"
      }`}
    >
      {/* Priority + Title */}
      <div className="flex items-start gap-2 mb-2">
        <GripVertical className="h-4 w-4 text-zinc-700 group-hover:text-zinc-500 mt-0.5 flex-shrink-0 cursor-grab active:cursor-grabbing" />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium leading-snug ${isCompleted ? "text-zinc-500 line-through" : "text-white"}`}>
            {task.title}
          </p>
          {task.description && (
            <p className="text-xs text-zinc-600 line-clamp-2 mt-1">{task.description}</p>
          )}
        </div>
      </div>

      {/* Meta Row */}
      <div className="flex items-center gap-2 flex-wrap mt-2">
        {/* Priority Badge */}
        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${priorityConf.bg} ${priorityConf.color}`}>
          <PriorityIcon className="h-2.5 w-2.5" />
          {priorityConf.label}
        </div>

        {/* Category */}
        {task.category && (
          <Badge variant="outline" className="border-zinc-700 text-zinc-500 text-[10px] py-0 px-1.5">
            {task.category}
          </Badge>
        )}

        {/* Due Date */}
        {task.dueDate && (
          <span className={`text-[10px] ${isOverdue ? "text-red-400 font-medium" : "text-zinc-600"}`}>
            {isOverdue ? "⚠ " : ""}
            {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Assignee */}
        {task.assignedName && (
          <div className="flex items-center gap-1">
            <div className="h-5 w-5 rounded-full bg-zinc-700 flex items-center justify-center">
              <span className="text-[9px] font-bold text-yellow-600">
                {task.assignedName.charAt(0)}
              </span>
            </div>
          </div>
        )}

        {/* Meeting link */}
        {task.meetingId && (
          <Calendar className="h-3 w-3 text-zinc-600" />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// KANBAN COLUMN (Drop Target)
// ============================================================================

function KanbanColumn({
  column,
  tasks,
  onDrop,
  onTaskClick,
  onDragStart,
  dragOverColumn,
  onDragOver,
  onDragLeave,
}: {
  column: typeof KANBAN_COLUMNS[0];
  tasks: any[];
  onDrop: (e: React.DragEvent) => void;
  onTaskClick: (task: any) => void;
  onDragStart: (e: React.DragEvent, task: any) => void;
  dragOverColumn: string | null;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
}) {
  const isDragOver = dragOverColumn === column.id;

  // Group tasks by priority
  const highTasks = tasks.filter(t => t.priority === "high");
  const mediumTasks = tasks.filter(t => t.priority === "medium");
  const lowTasks = tasks.filter(t => t.priority === "low");

  const priorityGroups = [
    { key: "high", label: "High Priority", tasks: highTasks, config: PRIORITY_CONFIG.high },
    { key: "medium", label: "Medium Priority", tasks: mediumTasks, config: PRIORITY_CONFIG.medium },
    { key: "low", label: "Low Priority", tasks: lowTasks, config: PRIORITY_CONFIG.low },
  ].filter(g => g.tasks.length > 0);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        onDragOver(e);
      }}
      onDragLeave={(e) => {
        // Only trigger leave if we're actually leaving the column, not entering a child
        const rect = e.currentTarget.getBoundingClientRect();
        const { clientX, clientY } = e;
        if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
          onDragLeave();
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDrop(e);
      }}
      className={`flex flex-col rounded-xl border-2 transition-all duration-200 ${
        isDragOver
          ? "border-yellow-500 bg-yellow-500/5 shadow-lg shadow-yellow-500/10 scale-[1.01]"
          : "border-zinc-800/60 bg-zinc-900/40"
      }`}
    >
      {/* Column Header */}
      <div className={`px-4 py-3 rounded-t-xl ${column.headerBg} border-b border-zinc-800/50 pointer-events-none`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-2.5 w-2.5 rounded-full ${column.dotColor}`} />
            <h3 className={`text-sm font-semibold ${column.color}`}>{column.label}</h3>
          </div>
          <Badge variant="outline" className={`${column.borderColor} ${column.color} text-xs`}>
            {tasks.length}
          </Badge>
        </div>
        {isDragOver && (
          <p className="text-[10px] text-yellow-500 mt-1 animate-pulse">Drop task here</p>
        )}
      </div>

      {/* Column Body - entire area is a drop zone */}
      <div className="flex-1 p-3 space-y-4 min-h-[200px] max-h-[calc(100vh-380px)] overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className={`h-10 w-10 rounded-full ${column.bg} flex items-center justify-center mb-2`}>
              <CheckSquare className={`h-5 w-5 ${column.color} opacity-50`} />
            </div>
            <p className="text-xs text-zinc-600">
              {isDragOver ? "Drop here" : "No tasks"}
            </p>
          </div>
        ) : (
          priorityGroups.map(group => (
            <div key={group.key}>
              {/* Priority Group Header */}
              {priorityGroups.length > 1 && (
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className={`h-1.5 w-1.5 rounded-full ${group.config.dotColor}`} />
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${group.config.color}`}>
                    {group.label}
                  </span>
                  <span className="text-[10px] text-zinc-600">({group.tasks.length})</span>
                </div>
              )}
              <div className="space-y-2">
                {group.tasks.map(task => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    onClick={() => onTaskClick(task)}
                    onDragStart={(e) => onDragStart(e, task)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
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
            <PropertyRow label="Status" icon={<Clock className="h-3.5 w-3.5" />}>
              <Select value={task.status} onValueChange={(v) => onUpdate(task.id, { status: v })}>
                <SelectTrigger className="h-8 bg-zinc-800 border-zinc-700 text-zinc-300 text-sm w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="open">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </PropertyRow>

            <PropertyRow label="Priority" icon={<Flag className="h-3.5 w-3.5" />}>
              <Select value={task.priority} onValueChange={(v) => onUpdate(task.id, { priority: v })}>
                <SelectTrigger className="h-8 bg-zinc-800 border-zinc-700 text-zinc-300 text-sm w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="high"><span className="flex items-center gap-2"><ArrowUp className="h-3 w-3 text-red-400" /> High</span></SelectItem>
                  <SelectItem value="medium"><span className="flex items-center gap-2"><ArrowRight className="h-3 w-3 text-yellow-400" /> Medium</span></SelectItem>
                  <SelectItem value="low"><span className="flex items-center gap-2"><ArrowDown className="h-3 w-3 text-blue-400" /> Low</span></SelectItem>
                </SelectContent>
              </Select>
            </PropertyRow>

            <PropertyRow label="Assignee" icon={<User className="h-3.5 w-3.5" />}>
              <Select value={task.assignedName || "unassigned"} onValueChange={(v) => onUpdate(task.id, { assignedName: v === "unassigned" ? null : v })}>
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

            <PropertyRow label="Category" icon={<FolderOpen className="h-3.5 w-3.5" />}>
              <Select value={task.category || "none"} onValueChange={(v) => onUpdate(task.id, { category: v === "none" ? null : v })}>
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

            <PropertyRow label="Due Date" icon={<Calendar className="h-3.5 w-3.5" />}>
              <Input
                type="date"
                value={task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ""}
                onChange={(e) => onUpdate(task.id, { dueDate: e.target.value || null })}
                className="h-8 bg-zinc-800 border-zinc-700 text-zinc-300 text-sm w-40"
              />
            </PropertyRow>

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
// TASK ROW - Individual task in list view (clickable)
// ============================================================================

function TaskRow({
  task,
  onToggle,
  onClick,
}: {
  task: any;
  onToggle: () => void;
  onClick: () => void;
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
      <Checkbox
        checked={isCompleted}
        onCheckedChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        className="border-zinc-600 data-[state=checked]:bg-yellow-600 data-[state=checked]:border-yellow-600"
      />
      <PriorityIcon className={`h-3.5 w-3.5 flex-shrink-0 ${priorityConf.color}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isCompleted ? "text-zinc-500 line-through" : "text-white"}`}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-zinc-600 line-clamp-1 mt-0.5">{task.description}</p>
        )}
      </div>
      {task.category && (
        <Badge variant="outline" className="border-zinc-700 text-zinc-500 text-xs hidden sm:flex">
          {task.category}
        </Badge>
      )}
      {task.assignedName && (
        <div className="flex items-center gap-1.5 flex-shrink-0 hidden sm:flex">
          <div className="h-5 w-5 rounded-full bg-zinc-800 flex items-center justify-center">
            <span className="text-[10px] font-semibold text-yellow-600">{task.assignedName.charAt(0)}</span>
          </div>
          <span className="text-xs text-zinc-500">{task.assignedName}</span>
        </div>
      )}
      {task.dueDate && (
        <span className={`text-xs flex-shrink-0 hidden md:block ${
          new Date(task.dueDate) < new Date() && task.status !== "completed" ? "text-red-400" : "text-zinc-600"
        }`}>
          {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      )}
      {task.meetingId && (
        <Link href={`/meeting/${task.meetingId}`} onClick={(e: any) => e.stopPropagation()}>
          <Badge variant="outline" className="border-zinc-800 text-zinc-600 text-xs cursor-pointer hover:text-yellow-500 hover:border-yellow-600/30">
            <Calendar className="h-3 w-3 mr-1" />
            Meeting
          </Badge>
        </Link>
      )}
      <ChevronRight className="h-4 w-4 text-zinc-700 group-hover:text-zinc-400 transition-colors flex-shrink-0" />
    </div>
  );
}

// ============================================================================
// NEW TASK FORM
// ============================================================================

function NewTaskForm({ categories, onSuccess }: { categories: string[]; onSuccess: () => void }) {
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
      <Input
        placeholder="Task title..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
        autoFocus
      />
      <Textarea
        placeholder="Description (optional)..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 min-h-20"
      />
      <div className="grid grid-cols-2 gap-3">
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
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [showNewTask, setShowNewTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const draggedTaskRef = useRef<any>(null);

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
      return true;
    });
  }, [allTasks, searchTerm, filterPerson, filterCategory]);

  // Group by status for Kanban
  const tasksByStatus = useMemo(() => {
    const groups: Record<string, any[]> = { open: [], in_progress: [], completed: [] };
    for (const t of filteredTasks) {
      const status = t.status || "open";
      if (groups[status]) groups[status].push(t);
      else groups.open.push(t);
    }
    return groups;
  }, [filteredTasks]);

  // All known categories
  const allCategories = useMemo(() => {
    const set = new Set(DEFAULT_CATEGORIES);
    categories?.forEach(c => { if (c.category) set.add(c.category); });
    allTasks?.forEach(t => { if (t.category) set.add(t.category); });
    return Array.from(set).sort();
  }, [categories, allTasks]);

  // Compute stats
  const stats = useMemo(() => {
    const tasks = filterPerson === "all" ? (allTasks || []) : (allTasks || []).filter(t => t.assignedName === filterPerson);
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    return {
      total: tasks.length,
      open: tasks.filter(t => t.status === "open").length,
      inProgress: tasks.filter(t => t.status === "in_progress").length,
      completed: tasks.filter(t => t.status === "completed").length,
      completedToday: tasks.filter(t => t.status === "completed" && t.completedAt && new Date(t.completedAt).toLocaleDateString('en-CA') === todayStr).length,
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
    if (selectedTask?.id === id) {
      setSelectedTask((prev: any) => prev ? { ...prev, ...updates } : prev);
    }
  };

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, task: any) => {
    draggedTaskRef.current = task;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id.toString());
  }, []);

  const handleDragOver = useCallback((_e: React.DragEvent, columnId: string) => {
    setDragOverColumn(columnId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback((_e: React.DragEvent, targetStatus: string) => {
    setDragOverColumn(null);
    const task = draggedTaskRef.current;
    if (task && task.status !== targetStatus) {
      updateTask.mutate({ id: task.id, status: targetStatus as "open" | "in_progress" | "completed" });
      toast.success(`Moved to ${KANBAN_COLUMNS.find(c => c.id === targetStatus)?.label || targetStatus}`);
    }
    draggedTaskRef.current = null;
  }, [updateTask]);

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <Skeleton className="h-10 w-64 bg-zinc-800/50" />
        <Skeleton className="h-32 bg-zinc-800/50 rounded-lg" />
        <div className="grid grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-24 bg-zinc-800/50 rounded-lg" />)}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 bg-zinc-800/50 rounded-lg" />)}
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
              onClick={() => setViewMode("kanban")}
              className={`p-2 transition-colors ${viewMode === "kanban" ? "bg-yellow-600/20 text-yellow-500" : "text-zinc-500 hover:text-white"}`}
              title="Kanban Board"
            >
              <Columns3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 transition-colors ${viewMode === "list" ? "bg-yellow-600/20 text-yellow-500" : "text-zinc-500 hover:text-white"}`}
              title="List View"
            >
              <ListFilter className="h-4 w-4" />
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

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Team Member Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
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

        <div className="h-5 w-px bg-zinc-800 hidden md:block" />

        {/* Category Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
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
      </div>

      {/* Search */}
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
        <p className="text-xs text-zinc-500 whitespace-nowrap">{filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Kanban Board View */}
      {viewMode === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {KANBAN_COLUMNS.map(column => (
            <KanbanColumn
              key={column.id}
              column={column}
              tasks={tasksByStatus[column.id] || []}
              onDrop={(e) => handleDrop(e, column.id)}
              onTaskClick={handleTaskClick}
              onDragStart={handleDragStart}
              dragOverColumn={dragOverColumn}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
            />
          ))}
        </div>
      ) : (
        /* List View */
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
              />
            ))
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
