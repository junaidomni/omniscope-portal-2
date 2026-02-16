import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Search, CheckSquare, Clock,
  Tag, Trash2, Calendar,
  ListFilter, LayoutGrid
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

  // All known categories (from DB + defaults)
  const allCategories = useMemo(() => {
    const set = new Set(DEFAULT_CATEGORIES);
    categories?.forEach(c => { if (c.category) set.add(c.category); });
    allTasks?.forEach(t => { if (t.category) set.add(t.category); });
    return Array.from(set).sort();
  }, [categories, allTasks]);

  // Stats
  const stats = useMemo(() => {
    if (!allTasks) return { total: 0, open: 0, inProgress: 0, completed: 0 };
    return {
      total: allTasks.length,
      open: allTasks.filter(t => t.status === "open").length,
      inProgress: allTasks.filter(t => t.status === "in_progress").length,
      completed: allTasks.filter(t => t.status === "completed").length,
    };
  }, [allTasks]);

  const toggleComplete = (task: any) => {
    updateTask.mutate({
      id: task.id,
      status: task.status === "completed" ? "open" : "completed",
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <Skeleton className="h-10 w-64 bg-zinc-800/50" />
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
            {stats.open} open · {stats.inProgress} in progress · {stats.completed} completed
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

      {/* Team Member Filters */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
        <button
          onClick={() => setFilterPerson("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap
            ${filterPerson === "all"
              ? "bg-yellow-600/20 text-yellow-500 border border-yellow-600/30"
              : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700"}`}
        >
          All Team
        </button>
        {TEAM_MEMBERS.map(name => (
          <button
            key={name}
            onClick={() => setFilterPerson(filterPerson === name ? "all" : name)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap
              ${filterPerson === name
                ? "bg-yellow-600/20 text-yellow-500 border border-yellow-600/30"
                : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700"}`}
          >
            {name}
          </button>
        ))}
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

      {/* Task List View */}
      {viewMode === "list" ? (
        <div className="space-y-1">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-16">
              <CheckSquare className="h-12 w-12 mx-auto mb-3 text-zinc-700" />
              <p className="text-zinc-500">No tasks found</p>
            </div>
          ) : (
            filteredTasks.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={() => toggleComplete(task)}
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
            groupedByCategory.map(([category, tasks]) => (
              <Card key={category} className="bg-zinc-900/50 border-zinc-800">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-white">{category}</CardTitle>
                    <Badge variant="outline" className="border-zinc-700 text-zinc-500 text-xs">
                      {tasks.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {tasks.map(task => (
                    <div
                      key={task.id}
                      className={`p-3 rounded-lg border transition-all ${
                        task.status === "completed"
                          ? "bg-zinc-800/30 border-zinc-800/50"
                          : "bg-zinc-800/50 border-zinc-800 hover:border-yellow-600/30"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <Checkbox
                          checked={task.status === "completed"}
                          onCheckedChange={() => toggleComplete(task)}
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
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TASK ROW - Individual task in list view
// ============================================================================

function TaskRow({
  task,
  onToggle,
  onDelete,
}: {
  task: any;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const isCompleted = task.status === "completed";

  return (
    <div className={`group flex items-center gap-3 p-3 rounded-lg transition-all ${
      isCompleted ? "bg-zinc-900/20 border border-zinc-800/40" : "bg-zinc-900/50 border border-zinc-800/60 hover:border-zinc-700"
    }`}>
      {/* Checkbox */}
      <Checkbox
        checked={isCompleted}
        onCheckedChange={onToggle}
        className="border-zinc-600 data-[state=checked]:bg-yellow-600 data-[state=checked]:border-yellow-600"
      />

      {/* Priority indicator */}
      <div className={`h-2 w-2 rounded-full flex-shrink-0 ${
        task.priority === "high" ? "bg-red-500" :
        task.priority === "medium" ? "bg-yellow-500" : "bg-blue-500"
      }`} />

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
        <span className="text-xs text-zinc-600 flex-shrink-0 hidden md:block">
          {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      )}

      {/* Meeting link */}
      {task.meetingId && (
        <Link href={`/meeting/${task.meetingId}`}>
          <Badge variant="outline" className="border-zinc-800 text-zinc-600 text-xs cursor-pointer hover:text-yellow-500 hover:border-yellow-600/30">
            <Calendar className="h-3 w-3 mr-1" />
            Meeting
          </Badge>
        </Link>
      )}

      {/* Auto-generated indicator */}
      {task.isAutoGenerated && (
        <Badge variant="outline" className="border-zinc-800 text-zinc-600 text-xs hidden lg:flex">
          Auto
        </Badge>
      )}

      {/* Delete */}
      <Button
        variant="ghost"
        size="sm"
        className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 hover:bg-red-400/10 flex-shrink-0 h-7 w-7 p-0"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
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
