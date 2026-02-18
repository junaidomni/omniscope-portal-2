import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  Briefcase, Search, Plus, Filter, Globe, Users, Building2, Loader2,
  TrendingUp, Star, MapPin, Shield, AlertCircle, Check, X, Trash2,
  ChevronDown, ChevronUp, Brain, Clock, Zap, Eye, Edit2, Save,
  Calendar, Sparkles, MessageSquare, FileText, CheckSquare, Mail,
  Phone, Landmark, UserCheck, RefreshCw, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Streamdown } from "streamdown";
import { ContactAutocomplete } from "@/components/ContactAutocomplete";

/* ─── helpers ─── */
const statusColors: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  inactive: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  prospect: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  partner: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};
const RISK_COLORS: Record<string, string> = {
  low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
};
const ENTITY_LABELS: Record<string, string> = {
  sovereign: "Sovereign", private: "Private", institutional: "Institutional",
  family_office: "Family Office", other: "Other",
};
const interactionIcons: Record<string, any> = {
  meeting: Calendar, note: MessageSquare, doc_shared: FileText,
  task_update: CheckSquare, email: Mail, call: Phone, intro: Users,
};

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}
function getColor(name: string) {
  const colors = [
    "from-yellow-600 to-amber-700", "from-emerald-600 to-green-700",
    "from-blue-600 to-indigo-700", "from-purple-600 to-violet-700",
    "from-rose-600 to-pink-700", "from-cyan-600 to-teal-700",
  ];
  return colors[name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length];
}
function timeAgo(date: string | Date | null) {
  if (!date) return "Never";
  const diffDays = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}
function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ═══════════════════════════════════════════════════════════════════
   COMPANIES PAGE — Left List + Right Dossier Panel
   ═══════════════════════════════════════════════════════════════════ */
export default function Companies() {
  const { isAuthenticated } = useAuth();
  const { data: companies, isLoading } = trpc.companies.list.useQuery(undefined, { enabled: isAuthenticated });
  const utils = trpc.useUtils();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [showPending, setShowPending] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [newCompany, setNewCompany] = useState({
    name: "", domain: "", industry: "", status: "active" as string,
    location: "", entityType: "" as string,
  });

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
  const deleteMutation = trpc.companies.delete.useMutation({
    onSuccess: () => {
      toast.success("Company deleted");
      utils.companies.list.invalidate();
      if (selectedId) setSelectedId(null);
    },
  });

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
    return result;
  }, [approvedCompanies, search, statusFilter]);

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

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)]">
        <div className="w-80 border-r border-zinc-800 p-4 space-y-3">
          <Skeleton className="h-8 bg-zinc-800/50 rounded-lg" />
          <Skeleton className="h-10 bg-zinc-800/50 rounded-lg" />
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 bg-zinc-800/50 rounded-lg" />)}
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-48 bg-zinc-800/50 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* ═══════════ LEFT PANEL — Company List ═══════════ */}
      <div className="w-80 min-w-[320px] border-r border-zinc-800 flex flex-col bg-zinc-950/50">
        {/* Header */}
        <div className="p-3 border-b border-zinc-800/50">
          <div className="flex items-center justify-between mb-2.5">
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              <Building2 className="h-5 w-5 text-yellow-600" />
              Companies
            </h1>
            <div className="flex items-center gap-1">
              <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-yellow-500">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-yellow-600" /> New Company
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
                        <Select value={newCompany.entityType} onValueChange={v => setNewCompany(p => ({ ...p, entityType: v }))}>
                          <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white mt-1"><SelectValue placeholder="Select type" /></SelectTrigger>
                          <SelectContent className="bg-zinc-900 border-zinc-700">
                            <SelectItem value="sovereign">Sovereign</SelectItem>
                            <SelectItem value="private">Private</SelectItem>
                            <SelectItem value="institutional">Institutional</SelectItem>
                            <SelectItem value="family_office">Family Office</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-zinc-400 text-xs">Status</Label>
                      <Select value={newCompany.status} onValueChange={v => setNewCompany(p => ({ ...p, status: v }))}>
                        <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-700">
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="prospect">Prospect</SelectItem>
                          <SelectItem value="partner">Partner</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild><Button variant="ghost" className="text-zinc-400">Cancel</Button></DialogClose>
                    <Button onClick={() => createMutation.mutate({
                      ...newCompany,
                      domain: newCompany.domain || undefined,
                      industry: newCompany.industry || undefined,
                      status: newCompany.status as any,
                    })} disabled={!newCompany.name.trim() || createMutation.isPending}
                      className="bg-yellow-600 hover:bg-yellow-700 text-black font-semibold">
                      {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600" />
            <Input placeholder="Search companies..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm bg-zinc-900/80 border-zinc-800 text-white placeholder:text-zinc-600" />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-1">
            {["all", "active", "prospect", "partner", "inactive"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                  statusFilter === s
                    ? "bg-yellow-600/20 text-yellow-400 border border-yellow-600/30"
                    : "text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-700"
                }`}>
                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* Stats mini */}
          <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-500">
            <span>{stats.total} companies</span>
            <span className="text-emerald-500">● {stats.active}</span>
            <span className="text-blue-400">● {stats.prospects}</span>
            <span className="text-purple-400">● {stats.partners}</span>
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto">
          {/* Pending Section */}
          {pendingCompanies.length > 0 && (
            <div className="border-b border-zinc-800/50">
              <button onClick={() => setShowPending(!showPending)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-amber-400 hover:bg-amber-500/5">
                <span className="flex items-center gap-1.5">
                  <AlertCircle className="h-3 w-3" />
                  Pending ({pendingCompanies.length})
                </span>
                {showPending ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {showPending && (
                <div className="px-2 pb-2 space-y-0.5">
                  {pendingCompanies.map((company: any) => (
                    <div key={company.id}
                      className="flex items-center gap-2 px-2 py-2 rounded-lg bg-amber-500/5 border border-amber-600/10 hover:border-amber-600/30 transition-colors">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getColor(company.name)} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 ring-1 ring-amber-500/30`}>
                        {getInitials(company.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-white truncate">{company.name}</div>
                        <div className="text-[10px] text-zinc-500 truncate">{company.industry || company.domain || "Unknown"}</div>
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-emerald-400 hover:bg-emerald-500/20"
                          onClick={() => approveMutation.mutate({ id: company.id })} disabled={approveMutation.isPending}>
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:bg-red-500/20"
                          onClick={() => rejectMutation.mutate({ id: company.id })} disabled={rejectMutation.isPending}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Company List */}
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-zinc-600 text-sm">
              {search ? "No companies match" : "No companies yet"}
            </div>
          ) : (
            <div className="py-1">
              {filtered.map((company: any) => (
                <button key={company.id}
                  onClick={() => setSelectedId(company.id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-colors border-l-2 ${
                    selectedId === company.id
                      ? "bg-yellow-600/5 border-l-yellow-600"
                      : "border-l-transparent hover:bg-zinc-900/50"
                  }`}>
                  {company.logoUrl ? (
                    <img src={company.logoUrl} alt={company.name} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${getColor(company.name)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                      {getInitials(company.name)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-medium truncate ${selectedId === company.id ? "text-yellow-400" : "text-white"}`}>
                        {company.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-zinc-500 truncate">{company.industry || "—"}</span>
                      {company.location && (
                        <span className="text-[10px] text-zinc-600 truncate">· {company.location}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${statusColors[company.status] || statusColors.active}`}>
                      {company.status}
                    </Badge>
                    <span className="text-[10px] text-zinc-600">{timeAgo(company.updatedAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════ RIGHT PANEL — Company Dossier ═══════════ */}
      <div className="flex-1 overflow-y-auto bg-zinc-950">
        {selectedId ? (
          <CompanyDossier
            companyId={selectedId}
            onDelete={() => {
              setSelectedId(null);
              utils.companies.list.invalidate();
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-600">
            <div className="text-center">
              <Building2 className="h-16 w-16 mx-auto mb-4 text-zinc-800" />
              <p className="text-lg font-medium text-zinc-500">Select a company</p>
              <p className="text-sm text-zinc-700 mt-1">Click a company from the list to view its full dossier</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   COMPANY DOSSIER — Full inline detail panel
   ═══════════════════════════════════════════════════════════════════ */
function CompanyDossier({ companyId, onDelete }: { companyId: number; onDelete: () => void }) {
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
  const [activeTab, setActiveTab] = useState<"overview" | "people" | "timeline" | "tasks" | "ai">("overview");
  const [linkSearch, setLinkSearch] = useState("");
  const [showAi, setShowAi] = useState(true);

  if (isLoading || !profile) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-40 bg-zinc-800/50 rounded-xl" />
        <div className="grid grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 bg-zinc-800/50 rounded-lg" />)}
        </div>
      </div>
    );
  }

  const p = profile as any;
  const lastActivity = profile.interactions?.length > 0 ? profile.interactions[0]?.timestamp : null;

  const startEdit = () => {
    setEditData({
      name: profile.name, domain: profile.domain || "", industry: profile.industry || "",
      status: profile.status, notes: profile.notes || "", owner: profile.owner || "",
      location: p.location || "", internalRating: p.internalRating ?? "",
      jurisdictionRisk: p.jurisdictionRisk || "", bankingPartner: p.bankingPartner || "",
      custodian: p.custodian || "", regulatoryExposure: p.regulatoryExposure || "",
      entityType: p.entityType || "",
    });
    setEditing(true);
  };

  const handleSave = () => {
    const updates: any = { id: companyId };
    for (const [key, value] of Object.entries(editData)) {
      if (key === "status" || key === "jurisdictionRisk" || key === "entityType") {
        updates[key] = value || undefined;
      } else if (key === "internalRating") {
        updates[key] = value !== "" ? Number(value) : null;
      } else {
        updates[key] = (value as string)?.trim() || undefined;
      }
    }
    updateMutation.mutate(updates);
  };

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "people", label: `People (${profile.people?.length || 0})` },
    { key: "timeline", label: `Timeline (${profile.interactions?.length || 0})` },
    { key: "tasks", label: `Tasks (${profile.tasks?.length || 0})` },
    { key: "ai", label: "AI Memory" },
  ];

  return (
    <div className="p-6">
      {/* ===== HEADER CARD ===== */}
      <Card className="bg-zinc-900/80 border-zinc-800 mb-5 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-yellow-600 via-yellow-500 to-yellow-600" />
        <CardContent className="p-5">
          {editing ? (
            /* ===== EDIT MODE ===== */
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-yellow-600 uppercase tracking-wider">Edit Company</h3>
                <div className="flex items-center gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(false)} className="text-zinc-400 h-7 text-xs">
                    <X className="h-3 w-3 mr-1" />Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}
                    className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium h-7 text-xs">
                    <Save className="h-3 w-3 mr-1" />{updateMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><Label className="text-zinc-500 text-xs">Company Name</Label>
                  <Input value={editData.name} onChange={e => setEditData((prev: any) => ({ ...prev, name: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white mt-1" /></div>
                <div><Label className="text-zinc-500 text-xs">Domain</Label>
                  <Input value={editData.domain} onChange={e => setEditData((prev: any) => ({ ...prev, domain: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="example.com" /></div>
                <div><Label className="text-zinc-500 text-xs">Industry</Label>
                  <Input value={editData.industry} onChange={e => setEditData((prev: any) => ({ ...prev, industry: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white mt-1" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><Label className="text-zinc-500 text-xs">Status</Label>
                  <Select value={editData.status} onValueChange={v => setEditData((prev: any) => ({ ...prev, status: v }))}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                      <SelectItem value="active">Active</SelectItem><SelectItem value="prospect">Prospect</SelectItem>
                      <SelectItem value="partner">Partner</SelectItem><SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select></div>
                <div><Label className="text-zinc-500 text-xs">Owner</Label>
                  <Input value={editData.owner} onChange={e => setEditData((prev: any) => ({ ...prev, owner: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white mt-1" /></div>
                <div><Label className="text-zinc-500 text-xs">Location</Label>
                  <Input value={editData.location} onChange={e => setEditData((prev: any) => ({ ...prev, location: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="Dubai, UAE" /></div>
              </div>
              {/* Strategic Intelligence */}
              <div className="border-t border-zinc-800 pt-4 mt-2">
                <h4 className="text-xs font-semibold text-yellow-600 uppercase tracking-wider mb-3">Strategic Intelligence</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div><Label className="text-zinc-500 text-xs">Entity Type</Label>
                    <Select value={editData.entityType || "none"} onValueChange={v => setEditData((prev: any) => ({ ...prev, entityType: v === "none" ? "" : v }))}>
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-700">
                        <SelectItem value="none">Not Set</SelectItem><SelectItem value="sovereign">Sovereign</SelectItem>
                        <SelectItem value="private">Private</SelectItem><SelectItem value="institutional">Institutional</SelectItem>
                        <SelectItem value="family_office">Family Office</SelectItem><SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select></div>
                  <div><Label className="text-zinc-500 text-xs">Jurisdiction Risk</Label>
                    <Select value={editData.jurisdictionRisk || "none"} onValueChange={v => setEditData((prev: any) => ({ ...prev, jurisdictionRisk: v === "none" ? "" : v }))}>
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-700">
                        <SelectItem value="none">Not Set</SelectItem><SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select></div>
                  <div><Label className="text-zinc-500 text-xs">Internal Rating (1-5)</Label>
                    <Input type="number" min={1} max={5} value={editData.internalRating}
                      onChange={e => setEditData((prev: any) => ({ ...prev, internalRating: e.target.value }))}
                      className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="1-5" /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div><Label className="text-zinc-500 text-xs">Banking Partner</Label>
                    <Input value={editData.bankingPartner} onChange={e => setEditData((prev: any) => ({ ...prev, bankingPartner: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white mt-1" /></div>
                  <div><Label className="text-zinc-500 text-xs">Custodian</Label>
                    <Input value={editData.custodian} onChange={e => setEditData((prev: any) => ({ ...prev, custodian: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white mt-1" /></div>
                </div>
                <div className="mt-3"><Label className="text-zinc-500 text-xs">Regulatory Exposure</Label>
                  <Textarea value={editData.regulatoryExposure} onChange={e => setEditData((prev: any) => ({ ...prev, regulatoryExposure: e.target.value }))}
                    className="bg-zinc-800 border-zinc-700 text-white mt-1 min-h-[60px]" placeholder="OFAC, sanctions, PEP exposure..." /></div>
              </div>
              <div><Label className="text-zinc-500 text-xs">Notes</Label>
                <Textarea value={editData.notes} onChange={e => setEditData((prev: any) => ({ ...prev, notes: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700 text-white mt-1 min-h-[80px]" /></div>
            </div>
          ) : (
            /* ===== VIEW MODE ===== */
            <div>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  {profile.logoUrl ? (
                    <img src={profile.logoUrl} alt={profile.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className={`h-14 w-14 rounded-xl bg-gradient-to-br ${getColor(profile.name)} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-xl font-bold text-white">{getInitials(profile.name)}</span>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-bold text-white">{profile.name}</h2>
                      <Badge variant="outline" className={statusColors[profile.status] || ""}>{profile.status}</Badge>
                      {p.entityType && <Badge variant="outline" className="bg-zinc-800 text-zinc-300 border-zinc-700 text-[10px]"><Landmark className="h-2.5 w-2.5 mr-1" />{ENTITY_LABELS[p.entityType] || p.entityType}</Badge>}
                      {p.jurisdictionRisk && <Badge variant="outline" className={`text-[10px] ${RISK_COLORS[p.jurisdictionRisk] || ""}`}><Shield className="h-2.5 w-2.5 mr-1" />{p.jurisdictionRisk} risk</Badge>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400 mt-1.5">
                      {profile.industry && <span className="flex items-center gap-1"><Briefcase className="h-3 w-3 text-yellow-600" />{profile.industry}</span>}
                      {profile.domain && (
                        <a href={`https://${profile.domain}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-yellow-500 transition-colors">
                          <Globe className="h-3 w-3 text-yellow-600" />{profile.domain}
                        </a>
                      )}
                      {p.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-yellow-600" />{p.location}</span>}
                      {profile.owner && <span className="flex items-center gap-1"><UserCheck className="h-3 w-3 text-zinc-600" />Owner: {profile.owner}</span>}
                    </div>
                    {(p.internalRating || p.bankingPartner || p.custodian) && (
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {p.internalRating && (
                          <span className="flex items-center gap-0.5 text-xs text-zinc-500">
                            {[1,2,3,4,5].map(i => <Star key={i} className={`h-3 w-3 ${i <= p.internalRating ? "text-yellow-500 fill-yellow-500" : "text-zinc-700"}`} />)}
                          </span>
                        )}
                        {p.bankingPartner && <span className="text-[10px] text-zinc-500 flex items-center gap-1"><Landmark className="h-2.5 w-2.5 text-zinc-600" />{p.bankingPartner}</span>}
                        {p.custodian && <span className="text-[10px] text-zinc-500 flex items-center gap-1"><Shield className="h-2.5 w-2.5 text-zinc-600" />{p.custodian}</span>}
                      </div>
                    )}
                  </div>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={startEdit} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-7 text-xs">
                    <Edit2 className="h-3 w-3 mr-1" />Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-600 hover:text-red-400 hover:bg-red-500/10">
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== STATS GRID ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { icon: <Users className="h-4 w-4" />, label: "People", value: profile.people?.length || 0, color: "yellow" },
          { icon: <Clock className="h-4 w-4" />, label: "Interactions", value: profile.interactions?.length || 0, color: "blue" },
          { icon: <CheckSquare className="h-4 w-4" />, label: "Tasks", value: profile.tasks?.length || 0, color: "purple" },
          { icon: <Calendar className="h-4 w-4" />, label: "Last Activity", value: lastActivity ? timeAgo(lastActivity) : "—", color: "emerald", isText: true },
        ].map(stat => {
          const colorMap: Record<string, string> = {
            emerald: "text-emerald-400 bg-emerald-500/10", yellow: "text-yellow-400 bg-yellow-500/10",
            blue: "text-blue-400 bg-blue-500/10", purple: "text-purple-400 bg-purple-500/10",
          };
          const [iconColor, iconBg] = (colorMap[stat.color] || "text-zinc-400 bg-zinc-500/10").split(" ");
          return (
            <Card key={stat.label} className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-3.5">
                <div className={`h-7 w-7 rounded-md ${iconBg} flex items-center justify-center ${iconColor} mb-1.5`}>{stat.icon}</div>
                <p className={`${stat.isText ? "text-base" : "text-xl"} font-bold text-white tabular-nums`}>{stat.value}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-wider">{stat.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ===== AI INTELLIGENCE (collapsible) ===== */}
      <Card className="bg-zinc-900/50 border-zinc-800 mb-5">
        <CardContent className="p-4">
          <button onClick={() => setShowAi(!showAi)} className="w-full flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold text-white">
              <Sparkles className="h-4 w-4 text-yellow-600" /> AI Company Intelligence
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm"
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-yellow-500 h-7 text-xs"
                onClick={(e) => { e.stopPropagation(); refreshAiMutation.mutate({ id: companyId }); }}
                disabled={refreshAiMutation.isPending}>
                {refreshAiMutation.isPending ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Generating</> : <><Sparkles className="h-3 w-3 mr-1" />Generate</>}
              </Button>
              {showAi ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
            </div>
          </button>
          {showAi && (
            <div className="mt-3 pt-3 border-t border-zinc-800">
              {profile.aiMemory ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  <Streamdown>{profile.aiMemory}</Streamdown>
                </div>
              ) : (
                <p className="text-sm text-zinc-600 italic">No AI summary yet. Click "Generate" to create an executive-level company intelligence summary.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== TABS ===== */}
      <div className="flex gap-1 border-b border-zinc-800 pb-0 mb-5 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? "border-yellow-600 text-yellow-500"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== OVERVIEW TAB ===== */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Company Details */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Building2 className="h-4 w-4 text-yellow-600" />Company Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {[
                { label: "Domain", value: profile.domain },
                { label: "Industry", value: profile.industry },
                { label: "Status", value: profile.status },
                { label: "Owner", value: profile.owner },
                { label: "Location", value: p.location },
                { label: "Entity Type", value: p.entityType ? ENTITY_LABELS[p.entityType] : null },
                { label: "Banking Partner", value: p.bankingPartner },
                { label: "Custodian", value: p.custodian },
              ].filter(f => f.value).map(field => (
                <div key={field.label} className="flex justify-between items-center py-1.5 border-b border-zinc-800/50">
                  <span className="text-xs text-zinc-500">{field.label}</span>
                  <span className="text-sm text-white">{field.value}</span>
                </div>
              ))}
              {p.regulatoryExposure && (
                <div className="pt-2">
                  <span className="text-xs text-zinc-500">Regulatory Exposure</span>
                  <p className="text-sm text-zinc-300 mt-1">{p.regulatoryExposure}</p>
                </div>
              )}
              {profile.notes && (
                <div className="pt-2">
                  <span className="text-xs text-zinc-500">Notes</span>
                  <p className="text-sm text-zinc-300 mt-1 whitespace-pre-wrap">{profile.notes}</p>
                </div>
              )}
              {![profile.domain, profile.industry, profile.owner, p.location, p.entityType, p.bankingPartner, p.custodian, p.regulatoryExposure, profile.notes].some(Boolean) && (
                <p className="text-sm text-zinc-600 py-4 text-center">No details added yet. Click Edit to add company information.</p>
              )}
            </CardContent>
          </Card>

          {/* Key People Preview */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <Users className="h-4 w-4 text-yellow-600" />Key People
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab("people")} className="text-zinc-400 hover:text-yellow-500 text-xs h-7">
                  View All <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {(!profile.people || profile.people.length === 0) ? (
                <p className="text-sm text-zinc-600 py-4 text-center">No people linked yet</p>
              ) : (
                profile.people.slice(0, 5).map((person: any) => (
                  <div key={person.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-zinc-800/40 border border-zinc-800 hover:border-yellow-600/30 transition-colors">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getColor(person.name)} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>
                      {getInitials(person.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{person.name}</p>
                      <p className="text-[10px] text-zinc-500 truncate">{person.title || person.email || "No title"}</p>
                    </div>
                    {person.category && person.category !== "other" && (
                      <Badge variant="outline" className="text-[9px] border-zinc-700 text-zinc-400">{person.category}</Badge>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-600" />Recent Activity
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab("timeline")} className="text-zinc-400 hover:text-yellow-500 text-xs h-7">
                  View All <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {(!profile.interactions || profile.interactions.length === 0) ? (
                <p className="text-sm text-zinc-600 py-4 text-center">No interactions recorded</p>
              ) : (
                profile.interactions.slice(0, 4).map((interaction: any, idx: number) => {
                  const Icon = interactionIcons[interaction.type] || MessageSquare;
                  return (
                    <div key={interaction.id || idx} className="flex items-start gap-3 p-2.5 rounded-lg bg-zinc-800/40 border border-zinc-800">
                      <div className="h-7 w-7 rounded-md bg-yellow-600/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="h-3.5 w-3.5 text-yellow-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px] border-zinc-700 text-zinc-400">{interaction.type}</Badge>
                          <span className="text-[10px] text-zinc-600">{timeAgo(interaction.timestamp)}</span>
                        </div>
                        <p className="text-xs text-zinc-300 mt-1 line-clamp-2">{interaction.summary || "No summary"}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Open Tasks */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-yellow-600" />Open Tasks
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab("tasks")} className="text-zinc-400 hover:text-yellow-500 text-xs h-7">
                  View All <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {(!profile.tasks || profile.tasks.length === 0) ? (
                <p className="text-sm text-zinc-600 py-4 text-center">No tasks linked</p>
              ) : (
                profile.tasks.filter((t: any) => t.status !== "done" && t.status !== "completed").slice(0, 4).map((task: any) => (
                  <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-zinc-800/40 border border-zinc-800">
                    <div className={`h-2 w-2 rounded-full flex-shrink-0 ${task.status === "in_progress" ? "bg-yellow-500" : "bg-zinc-500"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white truncate">{task.title}</p>
                      {task.assignedName && <p className="text-[10px] text-zinc-500">{task.assignedName}</p>}
                    </div>
                    <Badge variant="outline" className={`text-[9px] ${
                      task.priority === "high" ? "border-red-500/30 text-red-400" :
                      task.priority === "medium" ? "border-yellow-500/30 text-yellow-400" :
                      "border-zinc-700 text-zinc-400"
                    }`}>{task.priority}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===== PEOPLE TAB ===== */}
      {activeTab === "people" && (
        <div className="space-y-4">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <div className="text-xs text-zinc-500 mb-2 font-medium">Link a contact to this company</div>
              <ContactAutocomplete
                value={linkSearch}
                onChange={setLinkSearch}
                onSelect={(contact) => {
                  updateContactMutation.mutate({ id: contact.id, companyId });
                }}
                placeholder="Search contacts to link..."
              />
            </CardContent>
          </Card>

          {(!profile.people || profile.people.length === 0) ? (
            <div className="text-center py-12 text-zinc-600 text-sm">No people linked to this company yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {profile.people.map((person: any) => (
                <Card key={person.id} className="bg-zinc-900/50 border-zinc-800 hover:border-yellow-600/30 transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getColor(person.name)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                        {getInitials(person.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white">{person.name}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{person.title || "No title"}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {person.email && <span className="text-[10px] text-zinc-500 flex items-center gap-1"><Mail className="h-2.5 w-2.5" />{person.email}</span>}
                          {person.category && person.category !== "other" && (
                            <Badge variant="outline" className="text-[9px] border-zinc-700 text-zinc-400">{person.category}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== TIMELINE TAB ===== */}
      {activeTab === "timeline" && (
        <div className="space-y-3">
          {(!profile.interactions || profile.interactions.length === 0) ? (
            <div className="text-center py-12 text-zinc-600 text-sm">No interactions recorded yet.</div>
          ) : (
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-px bg-zinc-800" />
              {profile.interactions.map((interaction: any, idx: number) => {
                const Icon = interactionIcons[interaction.type] || MessageSquare;
                return (
                  <div key={interaction.id || idx} className="relative pl-12 pb-4">
                    <div className="absolute left-3 top-1 w-5 h-5 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center">
                      <Icon className="h-2.5 w-2.5 text-yellow-600" />
                    </div>
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3.5">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className="text-[9px] border-zinc-700 text-zinc-400">{interaction.type}</Badge>
                        <span className="text-[10px] text-zinc-600">{interaction.timestamp ? formatDate(interaction.timestamp) : "—"} · {timeAgo(interaction.timestamp)}</span>
                      </div>
                      <p className="text-sm text-zinc-300">{interaction.summary || "No summary"}</p>
                      {interaction.details && <p className="text-xs text-zinc-500 mt-1.5">{interaction.details}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== TASKS TAB ===== */}
      {activeTab === "tasks" && (
        <div className="space-y-3">
          {(!profile.tasks || profile.tasks.length === 0) ? (
            <div className="text-center py-12 text-zinc-600 text-sm">No tasks linked to this company.</div>
          ) : (
            profile.tasks.map((task: any) => {
              const isCompleted = task.status === "done" || task.status === "completed";
              const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isCompleted;
              return (
                <div key={task.id} className={`p-3.5 rounded-lg border transition-all ${isCompleted ? "bg-zinc-800/20 border-zinc-800/40 opacity-70" : "bg-zinc-900/50 border-zinc-800"}`}>
                  <div className="flex items-start gap-3">
                    <CheckSquare className={`h-4 w-4 mt-0.5 flex-shrink-0 ${isCompleted ? "text-emerald-500" : "text-zinc-600"}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${isCompleted ? "text-zinc-500 line-through" : "text-white"}`}>{task.title}</p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {task.assignedName && <span className="text-xs text-zinc-500">{task.assignedName}</span>}
                        <Badge variant="outline" className={`text-[9px] ${
                          task.priority === "high" ? "border-red-500/30 text-red-400" :
                          task.priority === "medium" ? "border-yellow-500/30 text-yellow-400" :
                          "border-zinc-700 text-zinc-400"
                        }`}>{task.priority}</Badge>
                        {task.dueDate && (
                          <span className={`text-xs ${isOverdue ? "text-red-400 font-medium" : "text-zinc-500"}`}>
                            {isOverdue ? "Overdue · " : ""}{formatDate(task.dueDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ===== AI MEMORY TAB ===== */}
      {activeTab === "ai" && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-yellow-600" /> AI Company Memory
            </CardTitle>
            <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-yellow-500 h-7 text-xs"
              onClick={() => refreshAiMutation.mutate({ id: companyId })}
              disabled={refreshAiMutation.isPending}>
              {refreshAiMutation.isPending ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Generating...</> : <><RefreshCw className="h-3 w-3 mr-1" />Generate Brief</>}
            </Button>
          </CardHeader>
          <CardContent>
            {profile.aiMemory ? (
              <div className="prose prose-invert prose-sm max-w-none">
                <Streamdown>{profile.aiMemory}</Streamdown>
              </div>
            ) : (
              <div className="text-center py-12 text-zinc-600">
                <Sparkles className="h-10 w-10 mx-auto mb-3 text-zinc-700" />
                <p className="text-sm">No AI Memory generated yet.</p>
                <p className="text-xs text-zinc-700 mt-1">Click "Generate Brief" to create an executive-level company intelligence summary.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
