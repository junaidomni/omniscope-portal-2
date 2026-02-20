import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  Briefcase, Search, Plus, Globe, Users, Building2, Loader2,
  Star, MapPin, Shield, Check, X, Trash2,
  Brain, Clock, Eye, Edit2, Save,
  Calendar, Sparkles, MessageSquare, FileText, CheckSquare, Mail,
  Phone, Landmark, UserCheck, RefreshCw, ChevronRight,
  LayoutGrid, List, ArrowUpDown, TrendingUp, MoreHorizontal,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Streamdown } from "streamdown";
import { ContactAutocomplete } from "@/components/ContactAutocomplete";

/* ─── helpers ─── */
const STATUS_STYLES: Record<string, { dot: string; badge: string; label: string }> = {
  active:   { dot: "bg-emerald-400", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", label: "Active" },
  inactive: { dot: "bg-zinc-500",    badge: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",         label: "Inactive" },
  prospect: { dot: "bg-blue-400",    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",         label: "Prospect" },
  partner:  { dot: "bg-purple-400",  badge: "bg-purple-500/10 text-purple-400 border-purple-500/20",   label: "Partner" },
};
const RISK_STYLES: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
};
const ENTITY_LABELS: Record<string, string> = {
  sovereign: "Sovereign", private: "Private", institutional: "Institutional",
  family_office: "Family Office", other: "Other",
};
const interactionIcons: Record<string, any> = {
  meeting: Calendar, note: MessageSquare, doc_shared: FileText,
  task_update: CheckSquare, email: Mail, call: Phone, intro: Users,
};

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}
function avatarGradient(name: string) {
  const gradients = [
    "from-yellow-600 to-amber-700", "from-emerald-600 to-green-700",
    "from-blue-600 to-indigo-700", "from-purple-600 to-violet-700",
    "from-rose-600 to-pink-700", "from-cyan-600 to-teal-700",
  ];
  return gradients[name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % gradients.length];
}
function timeAgo(date: string | Date | null) {
  if (!date) return "Never";
  const ms = Date.now() - new Date(date).getTime();
  const d = Math.floor(ms / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}
function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ═══════════════════════════════════════════════════════════════════
   COMPANIES PAGE — Premium 3-Panel Layout
   ═══════════════════════════════════════════════════════════════════ */
export default function Companies() {
  const { isAuthenticated } = useAuth();
  const { data: companies, isLoading } = trpc.companies.list.useQuery(undefined, { enabled: isAuthenticated });
  const utils = trpc.useUtils();

  /* ── state ── */
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [sortBy, setSortBy] = useState<"name" | "updated" | "status">("name");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [newCompany, setNewCompany] = useState({
    name: "", domain: "", industry: "", status: "active" as string,
    location: "", entityType: "" as string,
  });

  /* ── mutations ── */
  const createMutation = trpc.companies.create.useMutation({
    onSuccess: () => {
      toast.success("Company created");
      utils.companies.list.invalidate();
      setShowCreate(false);
      setNewCompany({ name: "", domain: "", industry: "", status: "active", location: "", entityType: "" });
    },
  });
  const approveMutation = trpc.companies.approve.useMutation({
    onSuccess: () => { toast.success("Company approved"); utils.companies.list.invalidate(); },
  });
  const rejectMutation = trpc.companies.reject.useMutation({
    onSuccess: () => { toast.success("Company rejected"); utils.companies.list.invalidate(); },
  });

  /* ── computed ── */
  const pendingCompanies = useMemo(() => {
    if (!companies) return [];
    return companies.filter((c: any) => c.approvalStatus === "pending");
  }, [companies]);

  const approvedCompanies = useMemo(() => {
    if (!companies) return [];
    return companies.filter((c: any) => c.approvalStatus !== "pending" && c.approvalStatus !== "rejected");
  }, [companies]);

  const filtered = useMemo(() => {
    let result = [...approvedCompanies];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c: any) =>
        c.name?.toLowerCase().includes(q) ||
        c.domain?.toLowerCase().includes(q) ||
        c.industry?.toLowerCase().includes(q) ||
        c.location?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      result = result.filter((c: any) => c.status === statusFilter);
    }
    result.sort((a: any, b: any) => {
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "updated") return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      return (a.status || "").localeCompare(b.status || "");
    });
    return result;
  }, [approvedCompanies, search, statusFilter, sortBy]);

  const stats = useMemo(() => {
    if (!companies) return { total: 0, active: 0, prospects: 0, partners: 0, pending: 0 };
    return {
      total: approvedCompanies.length,
      active: approvedCompanies.filter((c: any) => c.status === "active").length,
      prospects: approvedCompanies.filter((c: any) => c.status === "prospect").length,
      partners: approvedCompanies.filter((c: any) => c.status === "partner").length,
      pending: pendingCompanies.length,
    };
  }, [companies, approvedCompanies, pendingCompanies]);

  /* ── loading ── */
  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)]">
        <div className="w-[260px] border-r border-zinc-800/60 p-4 space-y-3">
          <Skeleton className="h-8 bg-zinc-800/40 rounded-lg" />
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-12 bg-zinc-800/40 rounded-lg" />)}
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-10 bg-zinc-800/40 rounded-lg mb-4" />
          <div className="grid grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-24 bg-zinc-800/40 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* ═══════════ LEFT SIDEBAR — Filters ═══════════ */}
      <div className="w-[260px] min-w-[260px] border-r border-zinc-800/60 flex flex-col bg-zinc-950/30">
        {/* Search */}
        <div className="p-3 border-b border-zinc-800/40">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <Input
              placeholder="Search companies..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 bg-zinc-900/50 border-zinc-800/60 text-sm text-white placeholder:text-zinc-600 focus:border-yellow-600/40 focus:ring-yellow-600/20"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-4">
            {/* Overview Stats */}
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 px-1">Overview</span>
              <div className="grid grid-cols-2 gap-1.5 mt-2">
                <button
                  onClick={() => setStatusFilter("all")}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all ${
                    statusFilter === "all" ? "bg-yellow-600/10 border border-yellow-600/20" : "bg-zinc-900/40 border border-zinc-800/40 hover:border-zinc-700/60"
                  }`}
                >
                  <span className={`text-lg font-bold ${statusFilter === "all" ? "text-yellow-400" : "text-white"}`}>{stats.total}</span>
                  <span className="text-[10px] text-zinc-500">Total</span>
                </button>
                <button
                  onClick={() => setStatusFilter("active")}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all ${
                    statusFilter === "active" ? "bg-emerald-600/10 border border-emerald-600/20" : "bg-zinc-900/40 border border-zinc-800/40 hover:border-zinc-700/60"
                  }`}
                >
                  <span className={`text-lg font-bold ${statusFilter === "active" ? "text-emerald-400" : "text-white"}`}>{stats.active}</span>
                  <span className="text-[10px] text-zinc-500">Active</span>
                </button>
              </div>
            </div>

            {/* Status Filters */}
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 px-1">Status</span>
              <div className="mt-2 space-y-0.5">
                {[
                  { key: "all", label: "All", count: stats.total },
                  { key: "active", label: "Active", count: stats.active },
                  { key: "prospect", label: "Prospect", count: stats.prospects },
                  { key: "partner", label: "Partner", count: stats.partners },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setStatusFilter(f.key)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-all ${
                      statusFilter === f.key
                        ? "bg-yellow-600/10 text-yellow-400"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-800/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {f.key !== "all" && <div className={`h-1.5 w-1.5 rounded-full ${STATUS_STYLES[f.key]?.dot || "bg-zinc-500"}`} />}
                      <span>{f.label}</span>
                    </div>
                    <span className="text-[10px] text-zinc-600">{f.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Pending Queue */}
            {pendingCompanies.length > 0 && (
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 px-1 flex items-center gap-1.5">
                  Pending Review
                  <span className="bg-yellow-600/20 text-yellow-400 text-[9px] px-1.5 py-0.5 rounded-full font-bold">{pendingCompanies.length}</span>
                </span>
                <div className="mt-2 space-y-1">
                  {pendingCompanies.map((c: any) => (
                    <div key={c.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-zinc-900/40 border border-zinc-800/40">
                      <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${avatarGradient(c.name)} flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0`}>
                        {initials(c.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-white truncate">{c.name}</p>
                        <p className="text-[9px] text-zinc-600 truncate">{c.industry || c.domain || "Unknown"}</p>
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => approveMutation.mutate({ id: c.id })}
                                className="h-5 w-5 rounded flex items-center justify-center text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                              >
                                <Check className="h-3 w-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-zinc-800 border-zinc-700 text-xs">Approve</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => rejectMutation.mutate({ id: c.id })}
                                className="h-5 w-5 rounded flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-zinc-800 border-zinc-700 text-xs">Reject</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Add Company Button */}
        <div className="p-3 border-t border-zinc-800/40">
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full h-8 border-zinc-800 text-zinc-400 hover:text-yellow-400 hover:border-yellow-600/30 text-xs">
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Company
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4 text-yellow-600" /> New Company
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div>
                  <Label className="text-zinc-400 text-xs">Company Name *</Label>
                  <Input value={newCompany.name} onChange={e => setNewCompany(p => ({ ...p, name: e.target.value }))}
                    className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="Company name" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-zinc-400 text-xs">Domain</Label>
                    <Input value={newCompany.domain} onChange={e => setNewCompany(p => ({ ...p, domain: e.target.value }))}
                      className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="example.com" />
                  </div>
                  <div>
                    <Label className="text-zinc-400 text-xs">Industry</Label>
                    <Input value={newCompany.industry} onChange={e => setNewCompany(p => ({ ...p, industry: e.target.value }))}
                      className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="Financial Services" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-zinc-400 text-xs">Location</Label>
                    <Input value={newCompany.location} onChange={e => setNewCompany(p => ({ ...p, location: e.target.value }))}
                      className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="Dubai, UAE" />
                  </div>
                  <div>
                    <Label className="text-zinc-400 text-xs">Entity Type</Label>
                    <Select value={newCompany.entityType || "none"} onValueChange={v => setNewCompany(p => ({ ...p, entityType: v === "none" ? "" : v }))}>
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-700">
                        <SelectItem value="none">Not Set</SelectItem>
                        <SelectItem value="sovereign">Sovereign</SelectItem>
                        <SelectItem value="private">Private</SelectItem>
                        <SelectItem value="institutional">Institutional</SelectItem>
                        <SelectItem value="family_office">Family Office</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreate(false)} className="border-zinc-700 text-zinc-400">Cancel</Button>
                <Button onClick={() => createMutation.mutate(newCompany)} disabled={!newCompany.name || createMutation.isPending}
                  className="bg-yellow-600 hover:bg-yellow-700 text-black font-semibold">
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ═══════════ CENTER — Company Grid/Table ═══════════ */}
      <div className={`flex-1 flex flex-col overflow-hidden ${selectedId ? "max-w-[50%]" : ""}`}>
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/40 bg-zinc-950/30">
          <span className="text-xs text-zinc-500">{filtered.length} companies</span>
          <div className="flex items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-zinc-400 hover:text-white gap-1">
                  <ArrowUpDown className="h-3 w-3" /> {sortBy === "name" ? "Name" : sortBy === "updated" ? "Updated" : "Status"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-zinc-900 border-zinc-800">
                <DropdownMenuItem onClick={() => setSortBy("name")} className="text-zinc-300 text-xs">Name</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("updated")} className="text-zinc-300 text-xs">Last Updated</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("status")} className="text-zinc-300 text-xs">Status</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Separator orientation="vertical" className="h-4 bg-zinc-800" />
            <div className="flex items-center bg-zinc-900/50 rounded-md border border-zinc-800/40 p-0.5">
              <button onClick={() => setViewMode("grid")}
                className={`p-1 rounded transition-colors ${viewMode === "grid" ? "bg-zinc-800 text-yellow-400" : "text-zinc-500 hover:text-white"}`}>
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setViewMode("table")}
                className={`p-1 rounded transition-colors ${viewMode === "table" ? "bg-zinc-800 text-yellow-400" : "text-zinc-500 hover:text-white"}`}>
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-zinc-600">
              <div className="text-center">
                <Building2 className="h-10 w-10 mx-auto mb-3 text-zinc-700" />
                <p className="text-sm">{search ? "No companies match your search" : "No companies yet"}</p>
              </div>
            </div>
          ) : viewMode === "grid" ? (
            /* ── Grid View ── */
            <div className={`p-4 grid gap-3 ${selectedId ? "grid-cols-1" : "grid-cols-2 xl:grid-cols-3"}`}>
              {filtered.map((company: any) => {
                const st = STATUS_STYLES[company.status] || STATUS_STYLES.active;
                const isSelected = selectedId === company.id;
                return (
                  <button
                    key={company.id}
                    onClick={() => setSelectedId(company.id)}
                    className={`text-left p-4 rounded-xl border transition-all group ${
                      isSelected
                        ? "bg-yellow-600/5 border-yellow-600/30 ring-1 ring-yellow-600/20"
                        : "bg-zinc-900/30 border-zinc-800/40 hover:border-zinc-700/60 hover:bg-zinc-900/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {company.logoUrl ? (
                        <img src={company.logoUrl} alt={company.name} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                      ) : (
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${avatarGradient(company.name)} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                          {initials(company.name)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold truncate ${isSelected ? "text-yellow-400" : "text-white"}`}>
                            {company.name}
                          </span>
                          <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${st.dot}`} />
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {company.industry && <span className="text-[10px] text-zinc-500 truncate">{company.industry}</span>}
                          {company.location && <span className="text-[10px] text-zinc-600 truncate">· {company.location}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <Badge variant="outline" className={`text-[9px] px-1.5 ${st.badge}`}>{st.label}</Badge>
                      {company.entityType && (
                        <Badge variant="outline" className="text-[9px] px-1.5 bg-zinc-800/50 text-zinc-400 border-zinc-700/50">
                          {ENTITY_LABELS[company.entityType] || company.entityType}
                        </Badge>
                      )}
                      <span className="text-[10px] text-zinc-600 ml-auto">{timeAgo(company.updatedAt)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            /* ── Table View ── */
            <div className="px-4 py-2">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800/40">
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500 py-2 px-3">Name</th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500 py-2 px-3">Industry</th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500 py-2 px-3">Status</th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500 py-2 px-3">Location</th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500 py-2 px-3">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((company: any) => {
                    const st = STATUS_STYLES[company.status] || STATUS_STYLES.active;
                    const isSelected = selectedId === company.id;
                    return (
                      <tr
                        key={company.id}
                        onClick={() => setSelectedId(company.id)}
                        className={`cursor-pointer border-b border-zinc-800/20 transition-colors ${
                          isSelected ? "bg-yellow-600/5" : "hover:bg-zinc-900/40"
                        }`}
                      >
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2.5">
                            {company.logoUrl ? (
                              <img src={company.logoUrl} alt={company.name} className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
                            ) : (
                              <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${avatarGradient(company.name)} flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0`}>
                                {initials(company.name)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className={`text-xs font-medium ${isSelected ? "text-yellow-400" : "text-white"}`}>{company.name}</span>
                              {company.domain && <p className="text-[10px] text-zinc-600 truncate">{company.domain}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-zinc-400">{company.industry || "—"}</td>
                        <td className="py-2.5 px-3">
                          <Badge variant="outline" className={`text-[9px] px-1.5 ${st.badge}`}>{st.label}</Badge>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-zinc-500">{company.location || "—"}</td>
                        <td className="py-2.5 px-3 text-[10px] text-zinc-600">{timeAgo(company.updatedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ═══════════ RIGHT PANEL — Company Dossier ═══════════ */}
      {selectedId ? (
        <div className="w-[380px] min-w-[380px] border-l border-zinc-800/60 flex flex-col bg-zinc-950/30 overflow-hidden">
          <CompanyDossier
            companyId={selectedId}
            onClose={() => setSelectedId(null)}
            onDelete={() => {
              setSelectedId(null);
              utils.companies.list.invalidate();
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   COMPANY DOSSIER — Slide-in detail panel
   ═══════════════════════════════════════════════════════════════════ */
function CompanyDossier({ companyId, onClose, onDelete }: { companyId: number; onClose: () => void; onDelete: () => void }) {
  const { data: profile, isLoading, refetch } = trpc.companies.getProfile.useQuery(
    { id: companyId }, { enabled: !!companyId }
  );
  const utils = trpc.useUtils();
  const updateMutation = trpc.companies.update.useMutation({
    onSuccess: () => { toast.success("Company updated"); setEditing(false); refetch(); },
    onError: () => toast.error("Failed to update"),
  });
  const deleteMutation = trpc.companies.delete.useMutation({
    onSuccess: () => { toast.success("Company deleted"); onDelete(); },
    onError: () => toast.error("Failed to delete"),
  });
  const refreshAiMutation = trpc.companies.refreshAiMemory.useMutation({
    onSuccess: () => { toast.success("AI Memory refreshed"); refetch(); },
    onError: () => toast.error("Failed to refresh AI Memory"),
  });
  const updateContactMutation = trpc.contacts.update.useMutation({
    onSuccess: () => { toast.success("Contact linked"); setLinkSearch(""); utils.companies.getProfile.invalidate({ id: companyId }); },
    onError: () => toast.error("Failed to link contact"),
  });

  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [linkSearch, setLinkSearch] = useState("");

  if (isLoading || !profile) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-20 bg-zinc-800/40 rounded-xl" />
        <Skeleton className="h-8 bg-zinc-800/40 rounded-lg" />
        <Skeleton className="h-32 bg-zinc-800/40 rounded-xl" />
      </div>
    );
  }

  const p = profile as any;
  const lastActivity = p.interactions?.[0]?.timestamp || p.updatedAt;

  const startEdit = () => {
    setEditing(true);
    setEditData({
      name: profile.name || "", domain: profile.domain || "", industry: profile.industry || "",
      status: profile.status || "active", owner: profile.owner || "", notes: profile.notes || "",
      location: p.location || "", entityType: p.entityType || "", jurisdictionRisk: p.jurisdictionRisk || "",
      internalRating: p.internalRating || "", bankingPartner: p.bankingPartner || "",
      custodian: p.custodian || "", regulatoryExposure: p.regulatoryExposure || "",
    });
  };
  const handleSave = () => {
    const payload: any = { id: companyId };
    Object.entries(editData).forEach(([k, v]) => { if (v !== "") payload[k] = v; else payload[k] = null; });
    if (editData.internalRating) payload.internalRating = parseInt(editData.internalRating);
    updateMutation.mutate(payload);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800/40">
        <div className="flex items-start gap-3">
          {profile.logoUrl ? (
            <img src={profile.logoUrl} alt={profile.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
          ) : (
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${avatarGradient(profile.name)} flex items-center justify-center text-white text-lg font-bold flex-shrink-0`}>
              {initials(profile.name)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-white truncate">{profile.name}</h2>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <Badge variant="outline" className={`text-[9px] ${STATUS_STYLES[profile.status]?.badge || ""}`}>
                {STATUS_STYLES[profile.status]?.label || profile.status}
              </Badge>
              {p.entityType && (
                <Badge variant="outline" className="text-[9px] bg-zinc-800/50 text-zinc-400 border-zinc-700/50">
                  <Landmark className="h-2.5 w-2.5 mr-0.5" />{ENTITY_LABELS[p.entityType] || p.entityType}
                </Badge>
              )}
              {p.jurisdictionRisk && (
                <Badge variant="outline" className={`text-[9px] ${RISK_STYLES[p.jurisdictionRisk] || ""}`}>
                  <Shield className="h-2.5 w-2.5 mr-0.5" />{p.jurisdictionRisk}
                </Badge>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          {[
            { label: "People", value: profile.people?.length || 0 },
            { label: "Activity", value: profile.interactions?.length || 0 },
            { label: "Tasks", value: profile.tasks?.length || 0 },
            { label: "Last", value: timeAgo(lastActivity) },
          ].map(s => (
            <div key={s.label} className="text-center py-1.5 rounded-lg bg-zinc-900/40 border border-zinc-800/30">
              <div className="text-sm font-bold text-white">{s.value}</div>
              <div className="text-[9px] text-zinc-500">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-1 mt-3">
          <TooltipProvider>
            <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-yellow-400" onClick={startEdit}>
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger><TooltipContent className="bg-zinc-800 border-zinc-700 text-xs">Edit</TooltipContent></Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-yellow-400"
                onClick={() => refreshAiMutation.mutate({ id: companyId })} disabled={refreshAiMutation.isPending}>
                {refreshAiMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
              </Button>
            </TooltipTrigger><TooltipContent className="bg-zinc-800 border-zinc-700 text-xs">AI Brief</TooltipContent></Tooltip>
          </TooltipProvider>
          <div className="flex-1" />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-600 hover:text-red-400">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-zinc-900 border-zinc-800">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">Delete {profile.name}?</AlertDialogTitle>
                <AlertDialogDescription className="text-zinc-400">
                  This will permanently remove this company and unlink all associated contacts.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-zinc-300">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteMutation.mutate({ id: companyId })} className="bg-red-600 hover:bg-red-700 text-white">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="flex-1">
        {editing ? (
          /* ── Edit Mode ── */
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-yellow-600 uppercase tracking-wider">Edit Company</span>
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)} className="text-zinc-400 h-7 text-xs">Cancel</Button>
                <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}
                  className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium h-7 text-xs">
                  {updateMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
            <div className="space-y-2.5">
              <div><Label className="text-zinc-500 text-[10px]">Name</Label>
                <Input value={editData.name} onChange={e => setEditData((p: any) => ({ ...p, name: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white mt-0.5 h-8 text-xs" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-zinc-500 text-[10px]">Domain</Label>
                  <Input value={editData.domain} onChange={e => setEditData((p: any) => ({ ...p, domain: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white mt-0.5 h-8 text-xs" placeholder="example.com" /></div>
                <div><Label className="text-zinc-500 text-[10px]">Industry</Label>
                  <Input value={editData.industry} onChange={e => setEditData((p: any) => ({ ...p, industry: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white mt-0.5 h-8 text-xs" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-zinc-500 text-[10px]">Status</Label>
                  <Select value={editData.status} onValueChange={v => setEditData((p: any) => ({ ...p, status: v }))}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white mt-0.5 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                      <SelectItem value="active">Active</SelectItem><SelectItem value="prospect">Prospect</SelectItem>
                      <SelectItem value="partner">Partner</SelectItem><SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select></div>
                <div><Label className="text-zinc-500 text-[10px]">Location</Label>
                  <Input value={editData.location} onChange={e => setEditData((p: any) => ({ ...p, location: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white mt-0.5 h-8 text-xs" /></div>
              </div>
              <div><Label className="text-zinc-500 text-[10px]">Owner</Label>
                <Input value={editData.owner} onChange={e => setEditData((p: any) => ({ ...p, owner: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white mt-0.5 h-8 text-xs" /></div>
              <Separator className="bg-zinc-800/60" />
              <span className="text-[10px] font-semibold text-yellow-600 uppercase tracking-wider">Strategic Intelligence</span>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-zinc-500 text-[10px]">Entity Type</Label>
                  <Select value={editData.entityType || "none"} onValueChange={v => setEditData((p: any) => ({ ...p, entityType: v === "none" ? "" : v }))}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white mt-0.5 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                      <SelectItem value="none">Not Set</SelectItem><SelectItem value="sovereign">Sovereign</SelectItem>
                      <SelectItem value="private">Private</SelectItem><SelectItem value="institutional">Institutional</SelectItem>
                      <SelectItem value="family_office">Family Office</SelectItem><SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select></div>
                <div><Label className="text-zinc-500 text-[10px]">Risk Level</Label>
                  <Select value={editData.jurisdictionRisk || "none"} onValueChange={v => setEditData((p: any) => ({ ...p, jurisdictionRisk: v === "none" ? "" : v }))}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white mt-0.5 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                      <SelectItem value="none">Not Set</SelectItem><SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-zinc-500 text-[10px]">Banking Partner</Label>
                  <Input value={editData.bankingPartner} onChange={e => setEditData((p: any) => ({ ...p, bankingPartner: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white mt-0.5 h-8 text-xs" /></div>
                <div><Label className="text-zinc-500 text-[10px]">Custodian</Label>
                  <Input value={editData.custodian} onChange={e => setEditData((p: any) => ({ ...p, custodian: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white mt-0.5 h-8 text-xs" /></div>
              </div>
              <div><Label className="text-zinc-500 text-[10px]">Rating (1-5)</Label>
                <Input type="number" min={1} max={5} value={editData.internalRating}
                  onChange={e => setEditData((p: any) => ({ ...p, internalRating: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700 text-white mt-0.5 h-8 text-xs" /></div>
              <div><Label className="text-zinc-500 text-[10px]">Regulatory Exposure</Label>
                <Textarea value={editData.regulatoryExposure} onChange={e => setEditData((p: any) => ({ ...p, regulatoryExposure: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700 text-white mt-0.5 min-h-[60px] text-xs" placeholder="OFAC, sanctions, PEP exposure..." /></div>
              <div><Label className="text-zinc-500 text-[10px]">Notes</Label>
                <Textarea value={editData.notes} onChange={e => setEditData((p: any) => ({ ...p, notes: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700 text-white mt-0.5 min-h-[60px] text-xs" /></div>
            </div>
          </div>
        ) : (
          /* ── View Mode ── */
          <Tabs defaultValue="overview" className="flex flex-col h-full">
            <TabsList className="w-full justify-start rounded-none border-b border-zinc-800/40 bg-transparent px-4 h-9">
              <TabsTrigger value="overview" className="text-[11px] data-[state=active]:text-yellow-400 data-[state=active]:border-b-2 data-[state=active]:border-yellow-600 rounded-none px-3 py-1.5">Overview</TabsTrigger>
              <TabsTrigger value="people" className="text-[11px] data-[state=active]:text-yellow-400 data-[state=active]:border-b-2 data-[state=active]:border-yellow-600 rounded-none px-3 py-1.5">
                People {profile.people?.length ? <span className="ml-1 text-[9px] text-zinc-500">{profile.people.length}</span> : null}
              </TabsTrigger>
              <TabsTrigger value="timeline" className="text-[11px] data-[state=active]:text-yellow-400 data-[state=active]:border-b-2 data-[state=active]:border-yellow-600 rounded-none px-3 py-1.5">Timeline</TabsTrigger>
              <TabsTrigger value="tasks" className="text-[11px] data-[state=active]:text-yellow-400 data-[state=active]:border-b-2 data-[state=active]:border-yellow-600 rounded-none px-3 py-1.5">Tasks</TabsTrigger>
              <TabsTrigger value="ai" className="text-[11px] data-[state=active]:text-yellow-400 data-[state=active]:border-b-2 data-[state=active]:border-yellow-600 rounded-none px-3 py-1.5">AI</TabsTrigger>
            </TabsList>

            {/* ── Overview Tab ── */}
            <TabsContent value="overview" className="flex-1 overflow-y-auto p-4 space-y-4 mt-0">
              {/* Details */}
              <div className="space-y-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Details</span>
                <div className="space-y-1.5">
                  {profile.industry && (
                    <div className="flex items-center gap-2.5 py-1.5">
                      <Briefcase className="h-3.5 w-3.5 text-zinc-600 flex-shrink-0" />
                      <span className="text-xs text-zinc-300">{profile.industry}</span>
                    </div>
                  )}
                  {profile.domain && (
                    <div className="flex items-center gap-2.5 py-1.5">
                      <Globe className="h-3.5 w-3.5 text-zinc-600 flex-shrink-0" />
                      <a href={`https://${profile.domain}`} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-300 hover:text-yellow-400 transition-colors flex items-center gap-1">
                        {profile.domain} <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </div>
                  )}
                  {p.location && (
                    <div className="flex items-center gap-2.5 py-1.5">
                      <MapPin className="h-3.5 w-3.5 text-zinc-600 flex-shrink-0" />
                      <span className="text-xs text-zinc-300">{p.location}</span>
                    </div>
                  )}
                  {profile.owner && (
                    <div className="flex items-center gap-2.5 py-1.5">
                      <UserCheck className="h-3.5 w-3.5 text-zinc-600 flex-shrink-0" />
                      <span className="text-xs text-zinc-300">Owner: {profile.owner}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Strategic Intelligence */}
              {(p.internalRating || p.bankingPartner || p.custodian || p.regulatoryExposure) && (
                <div className="space-y-2.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-yellow-600">Strategic Intel</span>
                  <div className="space-y-1.5">
                    {p.internalRating && (
                      <div className="flex items-center gap-2.5 py-1.5">
                        <Star className="h-3.5 w-3.5 text-zinc-600 flex-shrink-0" />
                        <div className="flex items-center gap-0.5">
                          {[1,2,3,4,5].map(i => (
                            <Star key={i} className={`h-3 w-3 ${i <= p.internalRating ? "text-yellow-500 fill-yellow-500" : "text-zinc-700"}`} />
                          ))}
                        </div>
                      </div>
                    )}
                    {p.bankingPartner && (
                      <div className="flex items-center gap-2.5 py-1.5">
                        <Landmark className="h-3.5 w-3.5 text-zinc-600 flex-shrink-0" />
                        <span className="text-xs text-zinc-300">{p.bankingPartner}</span>
                      </div>
                    )}
                    {p.custodian && (
                      <div className="flex items-center gap-2.5 py-1.5">
                        <Shield className="h-3.5 w-3.5 text-zinc-600 flex-shrink-0" />
                        <span className="text-xs text-zinc-300">{p.custodian}</span>
                      </div>
                    )}
                    {p.regulatoryExposure && (
                      <div className="py-1.5">
                        <span className="text-[10px] text-zinc-500">Regulatory Exposure</span>
                        <p className="text-xs text-zinc-300 mt-0.5">{p.regulatoryExposure}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              {profile.notes && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Notes</span>
                  <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">{profile.notes}</p>
                </div>
              )}

              {/* AI Memory Preview */}
              {p.aiMemory && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-yellow-600" /> AI Brief
                    </span>
                  </div>
                  <div className="prose prose-invert prose-xs max-w-none text-xs">
                    <Streamdown>{p.aiMemory}</Streamdown>
                  </div>
                </div>
              )}

              {/* Key People Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Key People</span>
                  <span className="text-[10px] text-zinc-600">{profile.people?.length || 0}</span>
                </div>
                {(!profile.people || profile.people.length === 0) ? (
                  <p className="text-[11px] text-zinc-600 py-3 text-center">No people linked yet</p>
                ) : (
                  <div className="space-y-1">
                    {profile.people.slice(0, 4).map((person: any) => (
                      <div key={person.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-zinc-900/40 border border-zinc-800/30 hover:border-zinc-700/50 transition-colors">
                        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${avatarGradient(person.name)} flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0`}>
                          {initials(person.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium text-white truncate">{person.name}</p>
                          <p className="text-[9px] text-zinc-500 truncate">{person.title || person.email || "No title"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Activity Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Recent Activity</span>
                </div>
                {(!profile.interactions || profile.interactions.length === 0) ? (
                  <p className="text-[11px] text-zinc-600 py-3 text-center">No interactions recorded</p>
                ) : (
                  <div className="space-y-1">
                    {profile.interactions.slice(0, 3).map((interaction: any, idx: number) => {
                      const Icon = interactionIcons[interaction.type] || MessageSquare;
                      return (
                        <div key={interaction.id || idx} className="flex items-start gap-2.5 p-2 rounded-lg bg-zinc-900/40 border border-zinc-800/30">
                          <div className="h-6 w-6 rounded-md bg-yellow-600/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Icon className="h-3 w-3 text-yellow-500" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className="text-[8px] border-zinc-700/50 text-zinc-400 px-1">{interaction.type}</Badge>
                              <span className="text-[9px] text-zinc-600">{timeAgo(interaction.timestamp)}</span>
                            </div>
                            <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">{interaction.summary || "No summary"}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── People Tab ── */}
            <TabsContent value="people" className="flex-1 overflow-y-auto p-4 space-y-3 mt-0">
              <div className="bg-zinc-900/40 border border-zinc-800/30 rounded-lg p-3">
                <span className="text-[10px] text-zinc-500 mb-1.5 block">Link a contact</span>
                <ContactAutocomplete
                  value={linkSearch}
                  onChange={setLinkSearch}
                  onSelect={(contact) => {
                    updateContactMutation.mutate({ id: contact.id, companyId });
                  }}
                  placeholder="Search contacts to link..."
                />
              </div>
              {(!profile.people || profile.people.length === 0) ? (
                <p className="text-[11px] text-zinc-600 py-6 text-center">No people linked to this company yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {profile.people.map((person: any) => (
                    <div key={person.id} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/30 hover:border-zinc-700/50 transition-colors">
                      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${avatarGradient(person.name)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                        {initials(person.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white">{person.name}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">{person.title || "No title"}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {person.email && <span className="text-[9px] text-zinc-500 flex items-center gap-0.5"><Mail className="h-2.5 w-2.5" />{person.email}</span>}
                          {person.category && person.category !== "other" && (
                            <Badge variant="outline" className="text-[8px] border-zinc-700/50 text-zinc-400">{person.category}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── Timeline Tab ── */}
            <TabsContent value="timeline" className="flex-1 overflow-y-auto p-4 mt-0">
              {(!profile.interactions || profile.interactions.length === 0) ? (
                <p className="text-[11px] text-zinc-600 py-6 text-center">No interactions recorded yet.</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-zinc-800/60" />
                  {profile.interactions.map((interaction: any, idx: number) => {
                    const Icon = interactionIcons[interaction.type] || MessageSquare;
                    return (
                      <div key={interaction.id || idx} className="relative pl-10 pb-3">
                        <div className="absolute left-2.5 top-1 w-4 h-4 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center">
                          <Icon className="h-2 w-2 text-yellow-600" />
                        </div>
                        <div className="bg-zinc-900/40 border border-zinc-800/30 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant="outline" className="text-[8px] border-zinc-700/50 text-zinc-400 px-1">{interaction.type}</Badge>
                            <span className="text-[9px] text-zinc-600">{interaction.timestamp ? fmtDate(interaction.timestamp) : "—"}</span>
                          </div>
                          <p className="text-[11px] text-zinc-300">{interaction.summary || "No summary"}</p>
                          {interaction.details && <p className="text-[10px] text-zinc-500 mt-1">{interaction.details}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ── Tasks Tab ── */}
            <TabsContent value="tasks" className="flex-1 overflow-y-auto p-4 space-y-1.5 mt-0">
              {(!profile.tasks || profile.tasks.length === 0) ? (
                <p className="text-[11px] text-zinc-600 py-6 text-center">No tasks linked to this company.</p>
              ) : (
                profile.tasks.map((task: any) => {
                  const done = task.status === "done" || task.status === "completed";
                  const overdue = task.dueDate && new Date(task.dueDate) < new Date() && !done;
                  return (
                    <div key={task.id} className={`p-3 rounded-lg border transition-all ${done ? "bg-zinc-800/20 border-zinc-800/30 opacity-60" : "bg-zinc-900/40 border-zinc-800/30"}`}>
                      <div className="flex items-start gap-2.5">
                        <CheckSquare className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${done ? "text-emerald-500" : "text-zinc-600"}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-medium ${done ? "text-zinc-500 line-through" : "text-white"}`}>{task.title}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {task.assignedName && <span className="text-[9px] text-zinc-500">{task.assignedName}</span>}
                            <Badge variant="outline" className={`text-[8px] ${
                              task.priority === "high" ? "border-red-500/20 text-red-400" :
                              task.priority === "medium" ? "border-yellow-500/20 text-yellow-400" :
                              "border-zinc-700/50 text-zinc-400"
                            }`}>{task.priority}</Badge>
                            {task.dueDate && (
                              <span className={`text-[9px] ${overdue ? "text-red-400 font-medium" : "text-zinc-500"}`}>
                                {overdue ? "Overdue · " : ""}{fmtDate(task.dueDate)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </TabsContent>

            {/* ── AI Tab ── */}
            <TabsContent value="ai" className="flex-1 overflow-y-auto p-4 mt-0">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-yellow-600" /> AI Company Memory
                </span>
                <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-yellow-400 h-6 text-[10px]"
                  onClick={() => refreshAiMutation.mutate({ id: companyId })}
                  disabled={refreshAiMutation.isPending}>
                  {refreshAiMutation.isPending ? <><Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />Generating...</> : <><RefreshCw className="h-2.5 w-2.5 mr-1" />Generate</>}
                </Button>
              </div>
              {p.aiMemory ? (
                <div className="prose prose-invert prose-xs max-w-none">
                  <Streamdown>{p.aiMemory}</Streamdown>
                </div>
              ) : (
                <div className="text-center py-10 text-zinc-600">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 text-zinc-700" />
                  <p className="text-[11px]">No AI Memory generated yet.</p>
                  <p className="text-[9px] text-zinc-700 mt-1">Click "Generate" to create an executive company intelligence summary.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </ScrollArea>
    </div>
  );
}
