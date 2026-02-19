import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Plus, Search, CheckSquare, Clock, Trash2, Calendar,
  Columns3, ListFilter, ChevronRight, Edit3, MessageSquare,
  User, Flag, FolderOpen, ArrowUp, ArrowRight, ArrowDown,
  GripVertical, AlertTriangle, Eye, EyeOff, Keyboard,
  MoreHorizontal, CheckCircle2, Circle, Timer, Zap,
  ChevronDown, X, Sparkles, Link2
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { ContactAutocomplete } from "@/components/ContactAutocomplete";
import { motion, AnimatePresence } from "framer-motion";

// ============================================================================
// CONSTANTS
// ============================================================================

const TEAM_MEMBERS = ["Junaid", "Kyle", "Jake", "Sania"];

const DEFAULT_CATEGORIES = [
  "Little Miracles", "Gold", "BTC", "Private Placement",
  "Real Estate", "Stablecoins", "Commodities", "Payment Rails", "General"
];

const PRIORITY_CONFIG = {
  high: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", icon: ArrowUp, label: "High", dotColor: "bg-red-500" },
  medium: { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: ArrowRight, label: "Med", dotColor: "bg-amber-500" },
  low: { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", icon: ArrowDown, label: "Low", dotColor: "bg-blue-500" },
};

const STATUS_CONFIG = {
  open: { label: "To Do", icon: Circle, color: "text-zinc-400", bg: "bg-zinc-500/10", dotColor: "bg-zinc-400" },
  in_progress: { label: "In Progress", icon: Timer, color: "text-amber-400", bg: "bg-amber-500/10", dotColor: "bg-amber-500" },
  completed: { label: "Done", icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10", dotColor: "bg-emerald-500" },
};

const KANBAN_COLUMNS = [
  { id: "open", label: "To Do", color: "text-zinc-400", dotColor: "bg-zinc-400", headerBg: "bg-zinc-800/30" },
  { id: "in_progress", label: "In Progress", color: "text-amber-400", dotColor: "bg-amber-500", headerBg: "bg-amber-900/10" },
  { id: "completed", label: "Done", color: "text-emerald-400", dotColor: "bg-emerald-500", headerBg: "bg-emerald-900/10" },
];

// ============================================================================
// COMMAND BAR — single compact row replacing the old stats + progress
// ============================================================================

function CommandBar({
  stats,
  focusView,
  setFocusView,
  viewMode,
  setViewMode,
  showCompleted,
  setShowCompleted,
  selectMode,
  setSelectMode,
  selectedCount,
  onSelectAll,
  onBulkDelete,
  bulkDeleting,
  filteredCount,
  onNewTask,
}: {
  stats: { total: number; open: number; inProgress: number; completed: number; highPriority: number; overdue: number };
  focusView: string;
  setFocusView: (v: string) => void;
  viewMode: string;
  setViewMode: (v: string) => void;
  showCompleted: boolean;
  setShowCompleted: (v: boolean) => void;
  selectMode: boolean;
  setSelectMode: (v: boolean) => void;
  selectedCount: number;
  onSelectAll: () => void;
  onBulkDelete: () => void;
  bulkDeleting: boolean;
  filteredCount: number;
  onNewTask: () => void;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {/* Left: Focus toggles */}
      <div className="flex items-center bg-zinc-900/80 border border-zinc-800 rounded-lg p-0.5">
        {[
          { id: "today", label: "Today" },
          { id: "week", label: "This Week" },
          { id: "all", label: "All" },
        ].map(v => (
          <button
            key={v.id}
            onClick={() => setFocusView(v.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              focusView === v.id
                ? "bg-yellow-600/20 text-yellow-500 shadow-sm"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Micro-stats */}
      <div className="flex items-center gap-3 ml-2 text-xs tabular-nums">
        <span className="text-zinc-500">
          <span className="text-white font-semibold">{stats.open + stats.inProgress}</span> open
        </span>
        {stats.overdue > 0 && (
          <span className="text-red-400 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            <span className="font-semibold">{stats.overdue}</span> overdue
          </span>
        )}
        {stats.highPriority > 0 && (
          <span className="text-red-400/70">
            <span className="font-semibold">{stats.highPriority}</span> high
          </span>
        )}
        <span className="text-emerald-500/70">
          <span className="font-semibold">{stats.completed}</span>/{stats.total}
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bulk actions */}
      <AnimatePresence>
        {selectMode && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex items-center gap-1.5"
          >
            <span className="text-xs text-zinc-400">{selectedCount} selected</span>
            <Button size="sm" variant="ghost" onClick={onSelectAll} className="text-zinc-400 text-xs h-7 px-2">
              All ({filteredCount})
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onBulkDelete}
              disabled={selectedCount === 0 || bulkDeleting}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs h-7 px-2"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectMode(false)} className="text-zinc-500 text-xs h-7 px-2">
              <X className="h-3 w-3" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle completed visibility */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className={`p-1.5 rounded-md transition-colors ${showCompleted ? "text-zinc-400 hover:text-white" : "text-zinc-600 hover:text-zinc-400"}`}
            >
              {showCompleted ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="bg-zinc-800 border-zinc-700 text-xs">
            {showCompleted ? "Hide completed" : "Show completed"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Select mode toggle */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setSelectMode(!selectMode)}
              className={`p-1.5 rounded-md transition-colors ${selectMode ? "text-yellow-500 bg-yellow-600/10" : "text-zinc-600 hover:text-zinc-400"}`}
            >
              <CheckSquare className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="bg-zinc-800 border-zinc-700 text-xs">
            Select mode (S)
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* View toggle */}
      <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <button
          onClick={() => setViewMode("list")}
          className={`p-1.5 transition-colors ${viewMode === "list" ? "bg-yellow-600/15 text-yellow-500" : "text-zinc-600 hover:text-white"}`}
        >
          <ListFilter className="h-4 w-4" />
        </button>
        <button
          onClick={() => setViewMode("kanban")}
          className={`p-1.5 transition-colors ${viewMode === "kanban" ? "bg-yellow-600/15 text-yellow-500" : "text-zinc-600 hover:text-white"}`}
        >
          <Columns3 className="h-4 w-4" />
        </button>
      </div>

      {/* New Task */}
      <Button onClick={onNewTask} size="sm" className="bg-yellow-600 hover:bg-yellow-500 text-black font-medium h-8 px-3 text-xs">
        <Plus className="h-3.5 w-3.5 mr-1" />
        Task
      </Button>
    </div>
  );
}

// ============================================================================
// SMART FILTER BAR — single compact row for all filters
// ============================================================================

function FilterBar({
  filterPerson,
  setFilterPerson,
  filterCategory,
  setFilterCategory,
  filterDue,
  setFilterDue,
  filterPriority,
  setFilterPriority,
  searchTerm,
  setSearchTerm,
  allCategories,
  allTasks,
  overdue,
}: {
  filterPerson: string;
  setFilterPerson: (v: string) => void;
  filterCategory: string;
  setFilterCategory: (v: string) => void;
  filterDue: string;
  setFilterDue: (v: string) => void;
  filterPriority: string;
  setFilterPriority: (v: string) => void;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  allCategories: string[];
  allTasks: any[];
  overdue: number;
}) {
  const hasFilters = filterPerson !== "all" || filterCategory !== "all" || filterDue !== "all" || filterPriority !== "all";

  return (
    <div className="flex items-center gap-2 mb-3">
      {/* Search */}
      <div className="relative w-52">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600" />
        <Input
          placeholder="Search... (/)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-8 h-8 bg-zinc-900/80 border-zinc-800 text-white placeholder:text-zinc-600 text-xs"
        />
      </div>

      {/* Team filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all ${
            filterPerson !== "all"
              ? "bg-yellow-600/10 text-yellow-500 border-yellow-600/30"
              : "bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:border-zinc-700"
          }`}>
            <User className="h-3 w-3" />
            {filterPerson === "all" ? "Team" : filterPerson}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-zinc-900 border-zinc-800" align="start">
          <DropdownMenuItem onClick={() => setFilterPerson("all")} className="text-xs text-zinc-300">
            All Team
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-zinc-800" />
          {TEAM_MEMBERS.map(name => {
            const count = allTasks.filter(t => t.assignedName?.toLowerCase().startsWith(name.toLowerCase()) && t.status !== "completed").length;
            return (
              <DropdownMenuItem key={name} onClick={() => setFilterPerson(name)} className="text-xs text-zinc-300 flex justify-between">
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-yellow-600">{name[0]}</span>
                  {name}
                </span>
                {count > 0 && <span className="text-zinc-600">{count}</span>}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Due date filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all ${
            filterDue !== "all"
              ? filterDue === "overdue" ? "bg-red-500/10 text-red-400 border-red-500/30" : "bg-yellow-600/10 text-yellow-500 border-yellow-600/30"
              : "bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:border-zinc-700"
          }`}>
            <Calendar className="h-3 w-3" />
            {filterDue === "all" ? "Due" : filterDue === "overdue" ? `Overdue (${overdue})` : filterDue === "today" ? "Today" : filterDue === "tomorrow" ? "Tomorrow" : filterDue === "week" ? "This Week" : filterDue === "no_date" ? "No Date" : "Due"}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-zinc-900 border-zinc-800" align="start">
          <DropdownMenuItem onClick={() => setFilterDue("all")} className="text-xs text-zinc-300">All Dates</DropdownMenuItem>
          <DropdownMenuSeparator className="bg-zinc-800" />
          {overdue > 0 && <DropdownMenuItem onClick={() => setFilterDue("overdue")} className="text-xs text-red-400">Overdue ({overdue})</DropdownMenuItem>}
          <DropdownMenuItem onClick={() => setFilterDue("today")} className="text-xs text-zinc-300">Due Today</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setFilterDue("tomorrow")} className="text-xs text-zinc-300">Tomorrow</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setFilterDue("week")} className="text-xs text-zinc-300">This Week</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setFilterDue("no_date")} className="text-xs text-zinc-300">No Date</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Priority filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all ${
            filterPriority !== "all"
              ? "bg-yellow-600/10 text-yellow-500 border-yellow-600/30"
              : "bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:border-zinc-700"
          }`}>
            <Flag className="h-3 w-3" />
            {filterPriority === "all" ? "Priority" : filterPriority.charAt(0).toUpperCase() + filterPriority.slice(1)}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-zinc-900 border-zinc-800" align="start">
          <DropdownMenuItem onClick={() => setFilterPriority("all")} className="text-xs text-zinc-300">All Priorities</DropdownMenuItem>
          <DropdownMenuSeparator className="bg-zinc-800" />
          <DropdownMenuItem onClick={() => setFilterPriority("high")} className="text-xs text-red-400 flex items-center gap-2"><ArrowUp className="h-3 w-3" /> High</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setFilterPriority("medium")} className="text-xs text-amber-400 flex items-center gap-2"><ArrowRight className="h-3 w-3" /> Medium</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setFilterPriority("low")} className="text-xs text-blue-400 flex items-center gap-2"><ArrowDown className="h-3 w-3" /> Low</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Category filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all ${
            filterCategory !== "all"
              ? "bg-yellow-600/10 text-yellow-500 border-yellow-600/30"
              : "bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:border-zinc-700"
          }`}>
            <FolderOpen className="h-3 w-3" />
            {filterCategory === "all" ? "Category" : filterCategory}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-zinc-900 border-zinc-800 max-h-64 overflow-y-auto" align="start">
          <DropdownMenuItem onClick={() => setFilterCategory("all")} className="text-xs text-zinc-300">All Categories</DropdownMenuItem>
          <DropdownMenuSeparator className="bg-zinc-800" />
          {allCategories.map(cat => (
            <DropdownMenuItem key={cat} onClick={() => setFilterCategory(cat)} className="text-xs text-zinc-300">{cat}</DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Clear filters */}
      {hasFilters && (
        <button
          onClick={() => { setFilterPerson("all"); setFilterCategory("all"); setFilterDue("all"); setFilterPriority("all"); }}
          className="text-xs text-zinc-600 hover:text-zinc-400 flex items-center gap-1 transition-colors"
        >
          <X className="h-3 w-3" />
          Clear
        </button>
      )}
    </div>
  );
}

// ============================================================================
// INLINE QUICK-ADD — appears at top of list when activated
// ============================================================================

function InlineQuickAdd({
  onClose,
  categories,
}: {
  onClose: () => void;
  categories: string[];
}) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [assignedName, setAssignedName] = useState("");
  const [category, setCategory] = useState("");
  const [dueDate, setDueDate] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const createTask = trpc.tasks.create.useMutation({
    onSuccess: () => {
      toast.success("Task created");
      utils.tasks.list.invalidate();
      setTitle("");
      setPriority("medium");
      setAssignedName("");
      setCategory("");
      setDueDate("");
      inputRef.current?.focus();
    },
    onError: () => toast.error("Failed to create task"),
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (!title.trim()) return;
    createTask.mutate({
      title: title.trim(),
      priority,
      assignedName: assignedName || undefined,
      category: category || undefined,
      dueDate: dueDate || undefined,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="flex items-center gap-2 p-2 bg-zinc-900/80 border border-yellow-600/30 rounded-lg mb-1">
        <div className="h-5 w-5 rounded-full border-2 border-yellow-600/40 flex-shrink-0" />
        <Input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && title.trim()) handleSubmit();
            if (e.key === "Escape") onClose();
          }}
          placeholder="What needs to be done?"
          className="h-7 bg-transparent border-none text-white text-sm placeholder:text-zinc-600 focus-visible:ring-0 p-0"
        />

        {/* Inline mini-selectors */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Priority cycle */}
          <button
            onClick={() => setPriority(p => p === "low" ? "medium" : p === "medium" ? "high" : "low")}
            className={`p-1 rounded ${PRIORITY_CONFIG[priority].bg} ${PRIORITY_CONFIG[priority].color}`}
            title={`Priority: ${priority}`}
          >
            {priority === "high" ? <ArrowUp className="h-3 w-3" /> : priority === "medium" ? <ArrowRight className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          </button>

          {/* Assignee */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={`p-1 rounded ${assignedName ? "bg-yellow-600/10 text-yellow-500" : "text-zinc-600 hover:text-zinc-400"}`}>
                <User className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-zinc-900 border-zinc-800" align="end">
              <DropdownMenuItem onClick={() => setAssignedName("")} className="text-xs text-zinc-400">Unassigned</DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-800" />
              {TEAM_MEMBERS.map(n => (
                <DropdownMenuItem key={n} onClick={() => setAssignedName(n)} className="text-xs text-zinc-300">{n}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Category */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={`p-1 rounded ${category ? "bg-zinc-700 text-white" : "text-zinc-600 hover:text-zinc-400"}`}>
                <FolderOpen className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-zinc-900 border-zinc-800 max-h-48 overflow-y-auto" align="end">
              <DropdownMenuItem onClick={() => setCategory("")} className="text-xs text-zinc-400">No Category</DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-800" />
              {categories.map(c => (
                <DropdownMenuItem key={c} onClick={() => setCategory(c)} className="text-xs text-zinc-300">{c}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Due date */}
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="h-6 w-6 bg-transparent text-zinc-600 text-xs opacity-0 hover:opacity-100 focus:opacity-100 cursor-pointer"
            style={{ colorScheme: "dark" }}
          />

          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!title.trim() || createTask.isPending}
            className="bg-yellow-600 hover:bg-yellow-500 text-black text-xs h-6 px-2 font-medium"
          >
            {createTask.isPending ? "..." : "Add"}
          </Button>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400 p-1">
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// COMPACT TASK ROW — single-line, everything visible at a glance
// ============================================================================

function CompactTaskRow({
  task,
  onToggle,
  onClick,
  selectMode,
  selected,
  onSelect,
}: {
  task: any;
  onToggle: () => void;
  onClick: () => void;
  selectMode: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const isCompleted = task.status === "completed";
  const isInProgress = task.status === "in_progress";
  const priorityConf = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isCompleted;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4, height: 0 }}
      transition={{ duration: 0.15 }}
      onClick={() => selectMode ? onSelect() : onClick()}
      className={`group flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all cursor-pointer ${
        selected ? "bg-yellow-600/10 border border-yellow-600/30" :
        isCompleted ? "opacity-50 hover:opacity-70" :
        "hover:bg-zinc-800/50"
      }`}
    >
      {/* Checkbox / Select */}
      {selectMode ? (
        <Checkbox
          checked={selected}
          onCheckedChange={onSelect}
          onClick={(e) => e.stopPropagation()}
          className="border-zinc-600 data-[state=checked]:bg-yellow-600 data-[state=checked]:border-yellow-600 flex-shrink-0"
        />
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className={`flex-shrink-0 h-[18px] w-[18px] rounded-full border-2 flex items-center justify-center transition-all ${
            isCompleted
              ? "bg-emerald-500 border-emerald-500"
              : isInProgress
                ? "border-amber-500/50 hover:border-amber-500"
                : "border-zinc-600 hover:border-yellow-600"
          }`}
        >
          {isCompleted && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 30 }}>
              <CheckCircle2 className="h-3 w-3 text-white" />
            </motion.div>
          )}
          {isInProgress && <div className="h-2 w-2 rounded-full bg-amber-500" />}
        </button>
      )}

      {/* Priority dot */}
      <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${priorityConf.dotColor}`} />

      {/* Title */}
      <span className={`flex-1 text-sm truncate ${
        isCompleted ? "text-zinc-500 line-through" : "text-white"
      }`}>
        {task.title}
      </span>

      {/* Source indicators */}
      {task.sourceThreadId && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Link2 className="h-3 w-3 text-zinc-600 flex-shrink-0" />
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-zinc-800 border-zinc-700 text-xs">From email</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {task.meetingId && (
        <Link href={`/meeting/${task.meetingId}`} onClick={(e: any) => e.stopPropagation()}>
          <Calendar className="h-3 w-3 text-zinc-600 hover:text-yellow-500 flex-shrink-0" />
        </Link>
      )}

      {/* Category pill */}
      {task.category && (
        <span className="text-[10px] text-zinc-600 bg-zinc-800/80 px-1.5 py-0.5 rounded hidden sm:block flex-shrink-0">
          {task.category}
        </span>
      )}

      {/* Assignee avatar */}
      {task.assignedName && (
        <div className="h-5 w-5 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0" title={task.assignedName}>
          <span className="text-[9px] font-bold text-yellow-600">{task.assignedName.charAt(0)}</span>
        </div>
      )}

      {/* Due date */}
      {task.dueDate && (
        <span className={`text-[11px] flex-shrink-0 tabular-nums hidden md:block ${
          isOverdue ? "text-red-400 font-medium" : isCompleted ? "text-zinc-600" : "text-zinc-500"
        }`}>
          {isOverdue && "⚠ "}
          {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      )}

      {/* Expand arrow */}
      <ChevronRight className="h-3.5 w-3.5 text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </motion.div>
  );
}

// ============================================================================
// COMPACT KANBAN CARD
// ============================================================================

function CompactKanbanCard({
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
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isCompleted;
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => { setIsDragging(true); onDragStart(e); }}
      onDragEnd={() => setIsDragging(false)}
      onClick={() => !isDragging && onClick()}
      className={`group px-3 py-2 rounded-lg border transition-all cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-30 scale-95" :
        isCompleted ? "bg-zinc-900/20 border-zinc-800/30 opacity-60" :
        "bg-zinc-800/40 border-zinc-800/60 hover:border-yellow-600/20 hover:bg-zinc-800/60"
      }`}
    >
      <div className="flex items-start gap-2">
        <div className={`h-1.5 w-1.5 rounded-full mt-1.5 flex-shrink-0 ${priorityConf.dotColor}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium leading-snug ${isCompleted ? "text-zinc-600 line-through" : "text-white"}`}>
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {task.category && (
              <span className="text-[9px] text-zinc-600 bg-zinc-800 px-1 py-0.5 rounded">{task.category}</span>
            )}
            {task.dueDate && (
              <span className={`text-[9px] ${isOverdue ? "text-red-400" : "text-zinc-600"}`}>
                {isOverdue && "⚠ "}
                {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
            <div className="flex-1" />
            {task.assignedName && (
              <div className="h-4 w-4 rounded-full bg-zinc-700 flex items-center justify-center">
                <span className="text-[8px] font-bold text-yellow-600">{task.assignedName.charAt(0)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// COMPACT KANBAN COLUMN
// ============================================================================

function CompactKanbanColumn({
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

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; onDragOver(e); }}
      onDragLeave={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) onDragLeave();
      }}
      onDrop={(e) => { e.preventDefault(); onDrop(e); }}
      className={`flex flex-col rounded-xl border transition-all ${
        isDragOver ? "border-yellow-500/50 bg-yellow-500/5" : "border-zinc-800/40 bg-zinc-900/20"
      }`}
    >
      {/* Header */}
      <div className={`px-3 py-2 rounded-t-xl ${column.headerBg} border-b border-zinc-800/30`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${column.dotColor}`} />
            <span className={`text-xs font-semibold ${column.color}`}>{column.label}</span>
          </div>
          <span className={`text-[10px] font-medium ${column.color} opacity-60`}>{tasks.length}</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-2 space-y-1.5 min-h-[120px] max-h-[calc(100vh-280px)] overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center py-6">
            <p className="text-[10px] text-zinc-700">{isDragOver ? "Drop here" : "Empty"}</p>
          </div>
        ) : (
          tasks.map(task => (
            <CompactKanbanCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task)}
              onDragStart={(e) => onDragStart(e, task)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// TASK DETAIL SHEET — slide-out panel with all properties
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
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editNotes, setEditNotes] = useState("");

  useEffect(() => {
    if (task) {
      setEditTitle(task.title || "");
      setEditDescription(task.description || "");
      setEditNotes(task.notes || "");
      setEditingField(null);
    }
  }, [task?.id]);

  if (!task) return null;

  const isCompleted = task.status === "completed";
  const priorityConf = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;

  const saveField = (field: string, value: any) => {
    onUpdate(task.id, { [field]: value });
    setEditingField(null);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-zinc-950 border-zinc-800 w-[420px] sm:max-w-[420px] overflow-y-auto p-0">
        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => onUpdate(task.id, { status: isCompleted ? "open" : "completed" })}
              className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                isCompleted ? "bg-emerald-500 border-emerald-500" : "border-zinc-600 hover:border-yellow-600"
              }`}
            >
              {isCompleted && <CheckCircle2 className="h-3 w-3 text-white" />}
            </button>
            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${priorityConf.bg} ${priorityConf.color}`}>
              {priorityConf.label}
            </div>
            {task.category && (
              <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">{task.category}</span>
            )}
          </div>

          {/* Title */}
          {editingField === "title" ? (
            <div className="space-y-2">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="bg-zinc-900 border-zinc-700 text-white text-lg font-semibold"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") saveField("title", editTitle); if (e.key === "Escape") setEditingField(null); }}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveField("title", editTitle)} className="bg-yellow-600 hover:bg-yellow-500 text-black text-xs h-7">Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingField(null)} className="text-zinc-400 text-xs h-7">Cancel</Button>
              </div>
            </div>
          ) : (
            <h2
              onClick={() => { setEditTitle(task.title); setEditingField("title"); }}
              className={`text-lg font-semibold cursor-pointer hover:text-yellow-500 transition-colors ${isCompleted ? "text-zinc-500 line-through" : "text-white"}`}
            >
              {task.title}
            </h2>
          )}
        </div>

        <Separator className="bg-zinc-800/50" />

        {/* Properties */}
        <div className="px-5 py-4 space-y-3">
          <PropRow label="Status" icon={<Clock className="h-3.5 w-3.5" />}>
            <Select value={task.status} onValueChange={(v) => onUpdate(task.id, { status: v })}>
              <SelectTrigger className="h-7 bg-zinc-900 border-zinc-800 text-zinc-300 text-xs w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem value="open">To Do</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </PropRow>

          <PropRow label="Priority" icon={<Flag className="h-3.5 w-3.5" />}>
            <Select value={task.priority} onValueChange={(v) => onUpdate(task.id, { priority: v })}>
              <SelectTrigger className="h-7 bg-zinc-900 border-zinc-800 text-zinc-300 text-xs w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem value="high"><span className="flex items-center gap-2"><ArrowUp className="h-3 w-3 text-red-400" /> High</span></SelectItem>
                <SelectItem value="medium"><span className="flex items-center gap-2"><ArrowRight className="h-3 w-3 text-amber-400" /> Medium</span></SelectItem>
                <SelectItem value="low"><span className="flex items-center gap-2"><ArrowDown className="h-3 w-3 text-blue-400" /> Low</span></SelectItem>
              </SelectContent>
            </Select>
          </PropRow>

          <PropRow label="Assignee" icon={<User className="h-3.5 w-3.5" />}>
            <div className="w-40">
              <ContactAutocomplete
                value={task.assignedName || ""}
                onChange={(v) => onUpdate(task.id, { assignedName: v || null })}
                onSelect={(c) => onUpdate(task.id, { assignedName: c.name })}
                placeholder="Assign..."
                allowFreeText
                className="h-7 text-xs"
              />
            </div>
          </PropRow>

          <PropRow label="Category" icon={<FolderOpen className="h-3.5 w-3.5" />}>
            <Select value={task.category || "none"} onValueChange={(v) => onUpdate(task.id, { category: v === "none" ? null : v })}>
              <SelectTrigger className="h-7 bg-zinc-900 border-zinc-800 text-zinc-300 text-xs w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem value="none">No Category</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PropRow>

          <PropRow label="Due Date" icon={<Calendar className="h-3.5 w-3.5" />}>
            <Input
              type="date"
              value={task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ""}
              onChange={(e) => onUpdate(task.id, { dueDate: e.target.value || null })}
              className="h-7 bg-zinc-900 border-zinc-800 text-zinc-300 text-xs w-36"
              style={{ colorScheme: "dark" }}
            />
          </PropRow>

          <PropRow label="Created" icon={<Clock className="h-3.5 w-3.5" />}>
            <span className="text-xs text-zinc-500">
              {new Date(task.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </PropRow>
        </div>

        <Separator className="bg-zinc-800/50" />

        {/* Description */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <Edit3 className="h-3 w-3 text-zinc-600" />
            <span className="text-xs font-medium text-zinc-500">Description</span>
          </div>
          {editingField === "description" ? (
            <div className="space-y-2">
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="bg-zinc-900 border-zinc-800 text-white text-sm min-h-20"
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveField("description", editDescription || null)} className="bg-yellow-600 hover:bg-yellow-500 text-black text-xs h-6">Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingField(null)} className="text-zinc-400 text-xs h-6">Cancel</Button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => { setEditDescription(task.description || ""); setEditingField("description"); }}
              className="p-2.5 rounded-lg bg-zinc-900/50 border border-zinc-800/50 cursor-pointer hover:border-zinc-700 transition-colors min-h-12"
            >
              {task.description ? (
                <p className="text-xs text-zinc-300 whitespace-pre-wrap">{task.description}</p>
              ) : (
                <p className="text-xs text-zinc-700 italic">Add description...</p>
              )}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="px-5 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="h-3 w-3 text-zinc-600" />
            <span className="text-xs font-medium text-zinc-500">Notes</span>
          </div>
          {editingField === "notes" ? (
            <div className="space-y-2">
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="bg-zinc-900 border-zinc-800 text-white text-sm min-h-24"
                placeholder="Add notes..."
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveField("notes", editNotes || null)} className="bg-yellow-600 hover:bg-yellow-500 text-black text-xs h-6">Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingField(null)} className="text-zinc-400 text-xs h-6">Cancel</Button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => { setEditNotes(task.notes || ""); setEditingField("notes"); }}
              className="p-2.5 rounded-lg bg-zinc-900/50 border border-zinc-800/50 cursor-pointer hover:border-zinc-700 transition-colors min-h-12"
            >
              {task.notes ? (
                <p className="text-xs text-zinc-300 whitespace-pre-wrap">{task.notes}</p>
              ) : (
                <p className="text-xs text-zinc-700 italic">Add notes...</p>
              )}
            </div>
          )}
        </div>

        <Separator className="bg-zinc-800/50" />

        {/* Delete */}
        <div className="px-5 py-4">
          <Button
            variant="ghost"
            className="text-red-400/60 hover:text-red-400 hover:bg-red-500/10 w-full text-xs h-8"
            onClick={() => {
              if (confirm("Delete this task?")) {
                onDelete(task.id);
                onOpenChange(false);
              }
            }}
          >
            <Trash2 className="h-3 w-3 mr-1.5" />
            Delete Task
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PropRow({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-zinc-600">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      {children}
    </div>
  );
}

// ============================================================================
// NEW TASK DIALOG (full form for complex task creation)
// ============================================================================

function NewTaskDialog({ categories, open, onOpenChange }: { categories: string[]; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [assignedName, setAssignedName] = useState("");
  const [category, setCategory] = useState("");
  const [dueDate, setDueDate] = useState("");
  const utils = trpc.useUtils();

  const createTask = trpc.tasks.create.useMutation({
    onSuccess: () => {
      toast.success("Task created");
      utils.tasks.list.invalidate();
      onOpenChange(false);
      setTitle(""); setDescription(""); setPriority("medium"); setAssignedName(""); setCategory(""); setDueDate("");
    },
    onError: () => toast.error("Failed to create task"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-zinc-800 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white text-base">New Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => {
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
        }} className="space-y-3">
          <Input
            placeholder="Task title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-zinc-900 border-zinc-800 text-white text-sm"
            autoFocus
          />
          <Textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="bg-zinc-900 border-zinc-800 text-white text-sm min-h-16"
          />
          <div className="grid grid-cols-2 gap-2">
            <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
              <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-300 text-xs h-8">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
            <ContactAutocomplete
              value={assignedName}
              onChange={setAssignedName}
              onSelect={(c) => setAssignedName(c.name)}
              placeholder="Assign to..."
              allowFreeText
              className="h-8 text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={category || "none"} onValueChange={(v) => setCategory(v === "none" ? "" : v)}>
              <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-300 text-xs h-8">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem value="none">No Category</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-zinc-900 border-zinc-800 text-zinc-300 text-xs h-8"
              style={{ colorScheme: "dark" }}
            />
          </div>
          <div className="flex justify-end pt-1">
            <Button type="submit" disabled={!title.trim() || createTask.isPending} className="bg-yellow-600 hover:bg-yellow-500 text-black font-medium text-xs h-8">
              {createTask.isPending ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
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
  const [filterDue, setFilterDue] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [focusView, setFocusView] = useState<string>("today");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [showCompleted, setShowCompleted] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const draggedTaskRef = useRef<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  // Mutations
  const updateTask = trpc.tasks.update.useMutation({
    onSuccess: () => utils.tasks.list.invalidate(),
    onError: () => toast.error("Failed to update task"),
  });
  const deleteTask = trpc.tasks.delete.useMutation({
    onSuccess: () => { toast.success("Task deleted"); utils.tasks.list.invalidate(); },
    onError: () => toast.error("Failed to delete task"),
  });
  const bulkDeleteTask = trpc.tasks.bulkDelete.useMutation({
    onSuccess: (data) => {
      toast.success(`Deleted ${data.deleted} tasks`);
      setSelectedIds(new Set());
      setSelectMode(false);
      utils.tasks.list.invalidate();
    },
    onError: () => toast.error("Failed to delete tasks"),
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      if (e.key === "n" || e.key === "N") { e.preventDefault(); setShowQuickAdd(true); }
      if (e.key === "/") { e.preventDefault(); document.querySelector<HTMLInputElement>('[placeholder*="Search"]')?.focus(); }
      if (e.key === "s" || e.key === "S") { e.preventDefault(); setSelectMode(p => !p); }
      if (e.key === "Escape") { setShowQuickAdd(false); setSelectMode(false); setSelectedIds(new Set()); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // All categories
  const allCategories = useMemo(() => {
    const set = new Set(DEFAULT_CATEGORIES);
    categories?.forEach(c => { if (c.category) set.add(c.category); });
    allTasks?.forEach(t => { if (t.category) set.add(t.category); });
    return Array.from(set).sort();
  }, [categories, allTasks]);

  // Stats
  const stats = useMemo(() => {
    const tasks = filterPerson === "all" ? (allTasks || []) : (allTasks || []).filter(t => t.assignedName?.toLowerCase().startsWith(filterPerson.toLowerCase()));
    const now = new Date();
    return {
      total: tasks.length,
      open: tasks.filter(t => t.status === "open").length,
      inProgress: tasks.filter(t => t.status === "in_progress").length,
      completed: tasks.filter(t => t.status === "completed").length,
      highPriority: tasks.filter(t => t.priority === "high" && t.status !== "completed").length,
      overdue: tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== "completed").length,
    };
  }, [allTasks, filterPerson]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    if (!allTasks) return [];
    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const tomorrowEnd = new Date(todayEnd.getTime() + 86400000);
    const weekEnd = new Date(todayEnd.getTime() + 7 * 86400000);

    return allTasks.filter(t => {
      // Hide completed unless toggled
      if (!showCompleted && t.status === "completed") return false;

      // Search
      if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        if (!t.title.toLowerCase().includes(lower) && !t.description?.toLowerCase().includes(lower)) return false;
      }

      // Person filter
      if (filterPerson !== "all" && !(t.assignedName?.toLowerCase().startsWith(filterPerson.toLowerCase()))) return false;

      // Priority filter
      if (filterPriority !== "all" && t.priority !== filterPriority) return false;

      // Category filter
      if (filterCategory !== "all" && t.category !== filterCategory) return false;

      // Due date filter
      if (filterDue !== "all") {
        const dueDate = t.dueDate ? new Date(t.dueDate) : null;
        if (filterDue === "overdue") { if (!dueDate || dueDate >= now) return false; }
        else if (filterDue === "today") { if (!dueDate || dueDate > todayEnd || dueDate < now) return false; }
        else if (filterDue === "tomorrow") { if (!dueDate || dueDate > tomorrowEnd || dueDate <= todayEnd) return false; }
        else if (filterDue === "week") { if (!dueDate || dueDate > weekEnd) return false; }
        else if (filterDue === "no_date") { if (dueDate) return false; }
      }

      // Focus view
      if (focusView === "today") {
        // Show: overdue + due today + high priority
        const dueDate = t.dueDate ? new Date(t.dueDate) : null;
        const isOverdue = dueDate && dueDate < now;
        const isDueToday = dueDate && dueDate >= now && dueDate <= todayEnd;
        const isHighPriority = t.priority === "high";
        if (!isOverdue && !isDueToday && !isHighPriority) return false;
      } else if (focusView === "week") {
        const dueDate = t.dueDate ? new Date(t.dueDate) : null;
        const isWithinWeek = dueDate && dueDate <= weekEnd;
        const isHighPriority = t.priority === "high";
        if (!isWithinWeek && !isHighPriority) return false;
      }

      return true;
    }).sort((a, b) => {
      // Sort: high priority first, then overdue, then by due date
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const pa = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 1;
      const pb = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 1;
      if (pa !== pb) return pa - pb;
      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });
  }, [allTasks, searchTerm, filterPerson, filterCategory, filterDue, filterPriority, focusView, showCompleted]);

  // Kanban groups
  const tasksByStatus = useMemo(() => {
    const groups: Record<string, any[]> = { open: [], in_progress: [], completed: [] };
    for (const t of filteredTasks) {
      const status = t.status || "open";
      if (groups[status]) groups[status].push(t);
      else groups.open.push(t);
    }
    return groups;
  }, [filteredTasks]);

  const toggleComplete = (task: any) => {
    updateTask.mutate({ id: task.id, status: task.status === "completed" ? "open" : "completed" });
  };

  const handleTaskClick = (task: any) => {
    setSelectedTask(task);
    setDetailOpen(true);
  };

  const handleTaskUpdate = (id: number, updates: any) => {
    updateTask.mutate({ id, ...updates });
    if (selectedTask?.id === id) setSelectedTask((prev: any) => prev ? { ...prev, ...updates } : prev);
  };

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, task: any) => {
    draggedTaskRef.current = task;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id.toString());
  }, []);

  const handleDrop = useCallback((_e: React.DragEvent, targetStatus: string) => {
    setDragOverColumn(null);
    const task = draggedTaskRef.current;
    if (task && task.status !== targetStatus) {
      updateTask.mutate({ id: task.id, status: targetStatus as any });
      toast.success(`Moved to ${KANBAN_COLUMNS.find(c => c.id === targetStatus)?.label}`);
    }
    draggedTaskRef.current = null;
  }, [updateTask]);

  // Loading
  if (isLoading) {
    return (
      <div className="p-5 max-w-6xl mx-auto space-y-3">
        <Skeleton className="h-8 w-80 bg-zinc-800/50" />
        <Skeleton className="h-8 w-full bg-zinc-800/50" />
        <div className="space-y-1">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <Skeleton key={i} className="h-10 bg-zinc-800/30 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 max-w-6xl mx-auto">
      {/* Minimal header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-white">Tasks</h1>
          <span className="text-xs text-zinc-600">
            {filterPerson !== "all" ? `${filterPerson}'s tasks` : ""}
          </span>
        </div>
        {/* Keyboard hint */}
        <div className="hidden md:flex items-center gap-2 text-[10px] text-zinc-700">
          <kbd className="px-1 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-zinc-600">N</kbd>
          <span>new</span>
          <kbd className="px-1 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-zinc-600">/</kbd>
          <span>search</span>
          <kbd className="px-1 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-zinc-600">S</kbd>
          <span>select</span>
        </div>
      </div>

      {/* Command Bar */}
      <CommandBar
        stats={stats}
        focusView={focusView}
        setFocusView={setFocusView}
        viewMode={viewMode}
        setViewMode={(v) => setViewMode(v as any)}
        showCompleted={showCompleted}
        setShowCompleted={setShowCompleted}
        selectMode={selectMode}
        setSelectMode={(v) => { setSelectMode(v); if (!v) setSelectedIds(new Set()); }}
        selectedCount={selectedIds.size}
        onSelectAll={() => setSelectedIds(new Set(filteredTasks.map(t => t.id)))}
        onBulkDelete={() => {
          if (selectedIds.size > 0 && confirm(`Delete ${selectedIds.size} task(s)?`)) {
            bulkDeleteTask.mutate({ ids: Array.from(selectedIds) });
          }
        }}
        bulkDeleting={bulkDeleteTask.isPending}
        filteredCount={filteredTasks.length}
        onNewTask={() => setShowNewTask(true)}
      />

      {/* Filter Bar */}
      <FilterBar
        filterPerson={filterPerson}
        setFilterPerson={setFilterPerson}
        filterCategory={filterCategory}
        setFilterCategory={setFilterCategory}
        filterDue={filterDue}
        setFilterDue={setFilterDue}
        filterPriority={filterPriority}
        setFilterPriority={setFilterPriority}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        allCategories={allCategories}
        allTasks={allTasks || []}
        overdue={stats.overdue}
      />

      {/* Task count */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-zinc-600">{filteredTasks.length} task{filteredTasks.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Inline Quick Add */}
      <AnimatePresence>
        {showQuickAdd && (
          <InlineQuickAdd
            onClose={() => setShowQuickAdd(false)}
            categories={allCategories}
          />
        )}
      </AnimatePresence>

      {/* Content */}
      {viewMode === "list" ? (
        <div className="space-y-0.5">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-16">
              <CheckSquare className="h-10 w-10 mx-auto mb-3 text-zinc-800" />
              <p className="text-sm text-zinc-600 mb-1">
                {focusView === "today" ? "Nothing urgent for today" : focusView === "week" ? "Clear for the week" : "No tasks found"}
              </p>
              <p className="text-xs text-zinc-700 mb-4">
                {focusView !== "all" && "Switch to \"All\" to see everything"}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowQuickAdd(true)}
                className="text-yellow-600 hover:text-yellow-500 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Task
              </Button>
            </div>
          ) : (
            <AnimatePresence>
              {filteredTasks.map(task => (
                <CompactTaskRow
                  key={task.id}
                  task={task}
                  onToggle={() => toggleComplete(task)}
                  onClick={() => handleTaskClick(task)}
                  selectMode={selectMode}
                  selected={selectedIds.has(task.id)}
                  onSelect={() => {
                    setSelectedIds(prev => {
                      const next = new Set(prev);
                      if (next.has(task.id)) next.delete(task.id); else next.add(task.id);
                      return next;
                    });
                  }}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      ) : (
        /* Kanban View */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {KANBAN_COLUMNS.map(column => (
            <CompactKanbanColumn
              key={column.id}
              column={column}
              tasks={tasksByStatus[column.id] || []}
              onDrop={(e) => handleDrop(e, column.id)}
              onTaskClick={handleTaskClick}
              onDragStart={handleDragStart}
              dragOverColumn={dragOverColumn}
              onDragOver={(e) => setDragOverColumn(column.id)}
              onDragLeave={() => setDragOverColumn(null)}
            />
          ))}
        </div>
      )}

      {/* Task Detail Sheet */}
      <TaskDetailSheet
        task={selectedTask}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        categories={allCategories}
        onUpdate={handleTaskUpdate}
        onDelete={(id) => { deleteTask.mutate({ id }); setDetailOpen(false); }}
      />

      {/* New Task Dialog */}
      <NewTaskDialog
        categories={allCategories}
        open={showNewTask}
        onOpenChange={setShowNewTask}
      />
    </div>
  );
}
