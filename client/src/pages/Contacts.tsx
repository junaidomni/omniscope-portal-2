import { useState, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  Users, Star, Search, Plus, RefreshCw, Building2, Mail, Phone,
  Calendar, Clock, Filter, ChevronRight, Briefcase,
  Globe, Sparkles, UserPlus, Loader2, Check, X, AlertCircle,
  Zap, Shield, Brain, MessageCircle, CheckSquare, FileText,
  ChevronDown, ChevronUp, Trash2, Merge, Eye, Edit3, Save,
  Send, Upload, Download, File, ArrowLeft, Linkedin, MapPin,
  Cake, Target, TrendingUp, Link2, AlertTriangle, User,
  MoreHorizontal, Grid3X3, List, Hash, Activity, ExternalLink,
  UserCheck, ArrowUpDown, LayoutGrid, Table2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS & HELPERS
   ═══════════════════════════════════════════════════════════════ */

const categoryConfig: Record<string, { label: string; color: string; bg: string }> = {
  client: { label: "Client", color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/25" },
  prospect: { label: "Prospect", color: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/25" },
  partner: { label: "Partner", color: "text-purple-400", bg: "bg-purple-500/15 border-purple-500/25" },
  vendor: { label: "Vendor", color: "text-orange-400", bg: "bg-orange-500/15 border-orange-500/25" },
  other: { label: "Other", color: "text-zinc-400", bg: "bg-zinc-500/15 border-zinc-500/25" },
};

const healthConfig: Record<string, { dot: string; label: string; color: string }> = {
  strong: { dot: "bg-emerald-500", label: "Strong", color: "text-emerald-400" },
  warm: { dot: "bg-yellow-500", label: "Warm", color: "text-yellow-400" },
  cold: { dot: "bg-zinc-500", label: "Cold", color: "text-zinc-400" },
  new: { dot: "bg-blue-500", label: "New", color: "text-blue-400" },
};

const riskConfig: Record<string, string> = {
  low: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/25",
  critical: "bg-red-500/15 text-red-400 border-red-500/25",
};

const DOC_CATEGORY_LABELS: Record<string, string> = {
  ncnda: "NCNDA", contract: "Contract", agreement: "Agreement",
  proposal: "Proposal", invoice: "Invoice", kyc: "KYC",
  compliance: "Compliance", correspondence: "Correspondence", other: "Other",
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.charAt(0).toUpperCase();
}

function getAvatarGradient(name: string) {
  const gradients = [
    "from-yellow-600 to-amber-700", "from-emerald-600 to-green-700",
    "from-blue-600 to-indigo-700", "from-purple-600 to-violet-700",
    "from-rose-600 to-pink-700", "from-cyan-600 to-teal-700",
  ];
  return gradients[name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % gradients.length];
}

function getHealth(days: number | null, count: number): keyof typeof healthConfig {
  if (count === 0) return "new";
  if (days === null) return "cold";
  if (days <= 14) return "strong";
  if (days <= 45) return "warm";
  return "cold";
}

function timeAgo(date: string | Date | null) {
  if (!date) return "Never";
  const d = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type ViewMode = "grid" | "table";
type SortField = "name" | "lastMeeting" | "meetings" | "category" | "health";
type SortDir = "asc" | "desc";

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function Contacts() {
  const { user } = useAuth();

  // ─── State ───
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [healthFilter, setHealthFilter] = useState<string>("all");
  const [starredOnly, setStarredOnly] = useState(false);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [detailTab, setDetailTab] = useState("overview");
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", email: "", phone: "", organization: "", title: "", category: "other" });
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState<number | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<number | null>(null);
  const [mergeSearch, setMergeSearch] = useState("");
  const [newNote, setNewNote] = useState("");
  // Document upload
  const [docTitle, setDocTitle] = useState("");
  const [docCategory, setDocCategory] = useState("other");
  const [docNotes, setDocNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Queries ───
  const { data: contacts, isLoading, refetch: refetchContacts } = trpc.contacts.list.useQuery();
  const selectedProfile = trpc.contacts.getProfile.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId }
  );
  const selectedMeetings = trpc.contacts.getMeetings.useQuery(
    { contactId: selectedId! },
    { enabled: !!selectedId }
  );
  const selectedNotes = trpc.contacts.getNotes.useQuery(
    { contactId: selectedId! },
    { enabled: !!selectedId }
  );
  const selectedDocs = trpc.contacts.getDocuments.useQuery(
    { contactId: selectedId! },
    { enabled: !!selectedId }
  );
  const selectedAliases = trpc.contacts.getAliases.useQuery(
    { contactId: selectedId! },
    { enabled: !!selectedId }
  );
  const linkedEmployee = trpc.contacts.getLinkedEmployee.useQuery(
    { contactId: selectedId! },
    { enabled: !!selectedId }
  );

  // ─── Mutations ───
  const createContact = trpc.contacts.create.useMutation({
    onSuccess: () => { toast.success("Contact created"); refetchContacts(); setCreateOpen(false); setNewContact({ name: "", email: "", phone: "", organization: "", title: "", category: "other" }); },
    onError: (e) => toast.error(e.message),
  });
  const updateContact = trpc.contacts.update.useMutation({
    onSuccess: () => { toast.success("Contact updated"); refetchContacts(); selectedProfile.refetch(); setIsEditing(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteContact = trpc.contacts.delete.useMutation({
    onSuccess: () => { toast.success("Contact deleted"); refetchContacts(); setSelectedId(null); },
    onError: (e) => toast.error(e.message),
  });
  const toggleStar = trpc.contacts.update.useMutation({
    onSuccess: () => { refetchContacts(); selectedProfile.refetch(); },
  });
  const generateSummary = trpc.contacts.generateAiSummary.useMutation({
    onSuccess: () => { toast.success("Summary generated"); selectedProfile.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const enrichWithAI = trpc.contacts.enrichWithAI.useMutation({
    onSuccess: (data) => { toast.success(`Enriched: ${data.updated.join(", ")}`); refetchContacts(); selectedProfile.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const addNoteMutation = trpc.contacts.addNote.useMutation({
    onSuccess: () => { toast.success("Note added"); selectedNotes.refetch(); setNewNote(""); },
    onError: (e) => toast.error(e.message),
  });
  const deleteNoteMutation = trpc.contacts.deleteNote.useMutation({
    onSuccess: () => { toast.success("Note deleted"); selectedNotes.refetch(); },
  });
  const deleteDocMutation = trpc.contacts.deleteDocument.useMutation({
    onSuccess: () => { toast.success("Document deleted"); selectedDocs.refetch(); },
  });
  const mergeMutation = trpc.contacts.mergeContacts.useMutation({
    onSuccess: () => {
      toast.success("Contacts merged");
      refetchContacts();
      setMergeDialogOpen(false);
      setMergeSourceId(null);
      setMergeTargetId(null);
      setMergeSearch("");
      if (selectedId === mergeSourceId) setSelectedId(mergeTargetId);
    },
    onError: (e) => toast.error(e.message),
  });
  const addAlias = trpc.contacts.addAlias.useMutation({
    onSuccess: () => { toast.success("Alias added"); selectedAliases.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const removeAlias = trpc.contacts.removeAlias.useMutation({
    onSuccess: () => { toast.success("Alias removed"); selectedAliases.refetch(); },
  });

  // ─── File upload handler ───
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("File too large (max 10MB)"); return; }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        await trpc.contacts.uploadDocument.mutate({
          contactId: selectedId,
          title: docTitle || file.name,
          category: docCategory as any,
          fileData: base64,
          fileName: file.name,
          mimeType: file.type,
          notes: docNotes || undefined,
        });
        toast.success("Document uploaded");
        selectedDocs.refetch();
        setDocTitle("");
        setDocCategory("other");
        setDocNotes("");
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("Upload failed");
      setUploading(false);
    }
  };

  // ─── Computed ───
  const filteredContacts = useMemo(() => {
    if (!contacts) return [];
    let list = contacts.filter((c: any) => c.approvalStatus !== "rejected" && c.approvalStatus !== "pending");
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c: any) =>
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.organization?.toLowerCase().includes(q) ||
        c.title?.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== "all") list = list.filter((c: any) => c.category === categoryFilter);
    if (healthFilter !== "all") list = list.filter((c: any) => getHealth(c.daysSinceLastMeeting, c.meetingCount) === healthFilter);
    if (starredOnly) list = list.filter((c: any) => c.starred);
    // Sort
    list = [...list].sort((a: any, b: any) => {
      let cmp = 0;
      switch (sortField) {
        case "name": cmp = (a.name || "").localeCompare(b.name || ""); break;
        case "lastMeeting": cmp = (new Date(b.lastMeetingDate || 0).getTime()) - (new Date(a.lastMeetingDate || 0).getTime()); break;
        case "meetings": cmp = (b.meetingCount || 0) - (a.meetingCount || 0); break;
        case "category": cmp = (a.category || "").localeCompare(b.category || ""); break;
        case "health": {
          const order = { strong: 0, warm: 1, new: 2, cold: 3 };
          cmp = (order[getHealth(a.daysSinceLastMeeting, a.meetingCount)] || 4) - (order[getHealth(b.daysSinceLastMeeting, b.meetingCount)] || 4);
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [contacts, searchQuery, categoryFilter, healthFilter, starredOnly, sortField, sortDir]);

  const stats = useMemo(() => {
    if (!contacts) return { total: 0, starred: 0, strong: 0, warm: 0, cold: 0, newContacts: 0 };
    const approved = contacts.filter((c: any) => c.approvalStatus !== "rejected" && c.approvalStatus !== "pending");
    return {
      total: approved.length,
      starred: approved.filter((c: any) => c.starred).length,
      strong: approved.filter((c: any) => getHealth(c.daysSinceLastMeeting, c.meetingCount) === "strong").length,
      warm: approved.filter((c: any) => getHealth(c.daysSinceLastMeeting, c.meetingCount) === "warm").length,
      cold: approved.filter((c: any) => getHealth(c.daysSinceLastMeeting, c.meetingCount) === "cold").length,
      newContacts: approved.filter((c: any) => getHealth(c.daysSinceLastMeeting, c.meetingCount) === "new").length,
    };
  }, [contacts]);

  const profile = selectedProfile.data;
  const meetings = selectedMeetings.data || [];
  const notes = selectedNotes.data || [];
  const documents = selectedDocs.data || [];
  const aliases = selectedAliases.data || [];

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const startEdit = () => {
    if (!profile) return;
    setEditData({
      name: profile.name || "", email: profile.email || "", phone: profile.phone || "",
      organization: profile.organization || "", title: profile.title || "",
      category: profile.category || "other", notes: profile.notes || "",
      website: profile.website || "", linkedin: profile.linkedin || "",
      address: profile.address || "", dateOfBirth: profile.dateOfBirth || "",
      riskTier: profile.riskTier || "", complianceStage: profile.complianceStage || "",
      influenceWeight: profile.influenceWeight || "",
    });
    setIsEditing(true);
  };

  const saveEdit = () => {
    if (!selectedId) return;
    const updates: any = {};
    Object.entries(editData).forEach(([k, v]) => {
      if (v !== undefined && v !== "") updates[k] = v;
      else if (v === "") updates[k] = null;
    });
    updateContact.mutate({ id: selectedId, ...updates });
  };

  // ─── Render ───
  return (
    <div className="h-full flex bg-black">
      {/* ═══ LEFT: FILTER SIDEBAR ═══ */}
      <div className="w-[240px] shrink-0 border-r border-zinc-800/60 flex flex-col bg-zinc-950/50">
        <div className="p-4 pb-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <Input
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs bg-zinc-900/80 border-zinc-800 text-white placeholder:text-zinc-600"
            />
          </div>
        </div>

        <ScrollArea className="flex-1 px-3">
          {/* Quick Stats */}
          <div className="mb-4">
            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest px-1 mb-2">Overview</p>
            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={() => { setCategoryFilter("all"); setHealthFilter("all"); setStarredOnly(false); }}
                className="text-left p-2 rounded-md bg-zinc-900/50 border border-zinc-800/60 hover:border-zinc-700 transition-colors">
                <p className="text-lg font-bold text-white tabular-nums">{stats.total}</p>
                <p className="text-[10px] text-zinc-500">Total</p>
              </button>
              <button onClick={() => setStarredOnly(!starredOnly)}
                className={`text-left p-2 rounded-md border transition-colors ${starredOnly ? "bg-yellow-500/10 border-yellow-500/30" : "bg-zinc-900/50 border-zinc-800/60 hover:border-zinc-700"}`}>
                <p className="text-lg font-bold text-white tabular-nums">{stats.starred}</p>
                <p className="text-[10px] text-zinc-500 flex items-center gap-1"><Star className="h-2.5 w-2.5 text-yellow-500" />Starred</p>
              </button>
            </div>
          </div>

          {/* Health Filter */}
          <div className="mb-4">
            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest px-1 mb-2">Health</p>
            <div className="space-y-0.5">
              {(["all", "strong", "warm", "cold", "new"] as const).map(h => {
                const count = h === "all" ? stats.total : stats[h === "new" ? "newContacts" : h];
                const active = healthFilter === h;
                return (
                  <button key={h} onClick={() => setHealthFilter(h)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors ${active ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-300 hover:bg-zinc-900/50"}`}>
                    <span className="flex items-center gap-2">
                      {h !== "all" && <span className={`h-1.5 w-1.5 rounded-full ${healthConfig[h]?.dot}`} />}
                      {h === "all" ? "All" : healthConfig[h]?.label}
                    </span>
                    <span className="text-[10px] text-zinc-600 tabular-nums">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category Filter */}
          <div className="mb-4">
            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest px-1 mb-2">Category</p>
            <div className="space-y-0.5">
              <button onClick={() => setCategoryFilter("all")}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors ${categoryFilter === "all" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-300 hover:bg-zinc-900/50"}`}>
                <span>All</span>
                <span className="text-[10px] text-zinc-600 tabular-nums">{stats.total}</span>
              </button>
              {Object.entries(categoryConfig).map(([key, cfg]) => {
                const count = (contacts || []).filter((c: any) => c.category === key && c.approvalStatus !== "rejected" && c.approvalStatus !== "pending").length;
                return (
                  <button key={key} onClick={() => setCategoryFilter(key)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors ${categoryFilter === key ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-300 hover:bg-zinc-900/50"}`}>
                    <span className={categoryFilter === key ? "" : cfg.color}>{cfg.label}</span>
                    <span className="text-[10px] text-zinc-600 tabular-nums">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </ScrollArea>

        {/* Add Contact Button */}
        <div className="p-3 border-t border-zinc-800/60">
          <Button onClick={() => setCreateOpen(true)} className="w-full h-8 text-xs bg-yellow-600 hover:bg-yellow-700 text-black font-semibold">
            <Plus className="h-3.5 w-3.5 mr-1.5" />Add Contact
          </Button>
        </div>
      </div>

      {/* ═══ CENTER: MAIN LIST ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-zinc-800/60 bg-zinc-950/30">
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-400">
              <span className="text-white font-semibold">{filteredContacts.length}</span> contacts
            </span>
            {(categoryFilter !== "all" || healthFilter !== "all" || starredOnly || searchQuery) && (
              <button onClick={() => { setCategoryFilter("all"); setHealthFilter("all"); setStarredOnly(false); setSearchQuery(""); }}
                className="text-[10px] text-zinc-500 hover:text-yellow-500 transition-colors flex items-center gap-1">
                <X className="h-3 w-3" />Clear filters
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-zinc-400 hover:text-white gap-1.5">
                  <ArrowUpDown className="h-3 w-3" />
                  {sortField === "name" ? "Name" : sortField === "lastMeeting" ? "Last Meeting" : sortField === "meetings" ? "Meetings" : sortField === "category" ? "Category" : "Health"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                <DropdownMenuItem onClick={() => toggleSort("name")} className="text-xs">Name {sortField === "name" && (sortDir === "asc" ? "↑" : "↓")}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => toggleSort("lastMeeting")} className="text-xs">Last Meeting {sortField === "lastMeeting" && (sortDir === "asc" ? "↑" : "↓")}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => toggleSort("meetings")} className="text-xs">Meetings {sortField === "meetings" && (sortDir === "asc" ? "↑" : "↓")}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => toggleSort("health")} className="text-xs">Health {sortField === "health" && (sortDir === "asc" ? "↑" : "↓")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex items-center border border-zinc-800 rounded-md overflow-hidden">
              <button onClick={() => setViewMode("grid")}
                className={`p-1.5 transition-colors ${viewMode === "grid" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setViewMode("table")}
                className={`p-1.5 transition-colors ${viewMode === "table" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
                <Table2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="p-5 space-y-3">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 bg-zinc-800/50 rounded-lg" />)}
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="h-16 w-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-zinc-600" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1">No contacts found</h3>
              <p className="text-sm text-zinc-500 mb-4 max-w-xs">
                {searchQuery ? "Try adjusting your search or filters." : "Add your first contact to get started."}
              </p>
              {!searchQuery && (
                <Button onClick={() => setCreateOpen(true)} size="sm" className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium">
                  <Plus className="h-4 w-4 mr-1.5" />Add Contact
                </Button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            /* ─── Grid View ─── */
            <div className="p-5 grid grid-cols-1 xl:grid-cols-2 gap-2">
              {filteredContacts.map((c: any, idx: number) => {
                const health = getHealth(c.daysSinceLastMeeting, c.meetingCount);
                const hCfg = healthConfig[health];
                const catCfg = categoryConfig[c.category] || categoryConfig.other;
                const isSelected = selectedId === c.id;
                return (
                  <button key={c.id} onClick={() => { setSelectedId(c.id); setDetailTab("overview"); setIsEditing(false); }}
                    style={{ animationDelay: `${idx * 30}ms` }}
                    className={`animate-stagger-in w-full text-left group flex items-center gap-3.5 px-4 py-3 rounded-lg border transition-all duration-150 ${
                      isSelected
                        ? "bg-zinc-800/80 border-yellow-600/40 shadow-sm shadow-yellow-600/5"
                        : "bg-zinc-900/30 border-zinc-800/60 hover:bg-zinc-900/60 hover:border-zinc-700"
                    }`}>
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${getAvatarGradient(c.name)} flex items-center justify-center text-white text-sm font-bold shadow-sm`}>
                        {getInitials(c.name)}
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-zinc-900 ${hCfg.dot}`} />
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">{c.name}</span>
                        {c.starred ? <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 shrink-0" /> : null}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {c.organization && <span className="text-[11px] text-zinc-500 truncate">{c.organization}</span>}
                        {c.title && c.organization && <span className="text-zinc-700">·</span>}
                        {c.title && <span className="text-[11px] text-zinc-600 truncate">{c.title}</span>}
                      </div>
                    </div>
                    {/* Meta */}
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${catCfg.bg}`}>{catCfg.label}</Badge>
                      <span className="text-[10px] text-zinc-600 tabular-nums">
                        {c.meetingCount > 0 ? `${c.meetingCount} mtg · ${timeAgo(c.lastMeetingDate)}` : "No meetings"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            /* ─── Table View ─── */
            <div className="p-5">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-500 text-xs font-medium cursor-pointer hover:text-zinc-300" onClick={() => toggleSort("name")}>
                      Name {sortField === "name" && <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>}
                    </TableHead>
                    <TableHead className="text-zinc-500 text-xs font-medium">Organization</TableHead>
                    <TableHead className="text-zinc-500 text-xs font-medium cursor-pointer hover:text-zinc-300" onClick={() => toggleSort("category")}>
                      Category {sortField === "category" && <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>}
                    </TableHead>
                    <TableHead className="text-zinc-500 text-xs font-medium cursor-pointer hover:text-zinc-300" onClick={() => toggleSort("health")}>
                      Health {sortField === "health" && <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>}
                    </TableHead>
                    <TableHead className="text-zinc-500 text-xs font-medium cursor-pointer hover:text-zinc-300" onClick={() => toggleSort("lastMeeting")}>
                      Last Contact {sortField === "lastMeeting" && <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>}
                    </TableHead>
                    <TableHead className="text-zinc-500 text-xs font-medium text-right cursor-pointer hover:text-zinc-300" onClick={() => toggleSort("meetings")}>
                      Meetings {sortField === "meetings" && <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.map((c: any) => {
                    const health = getHealth(c.daysSinceLastMeeting, c.meetingCount);
                    const hCfg = healthConfig[health];
                    const catCfg = categoryConfig[c.category] || categoryConfig.other;
                    const isSelected = selectedId === c.id;
                    return (
                      <TableRow key={c.id} onClick={() => { setSelectedId(c.id); setDetailTab("overview"); setIsEditing(false); }}
                        className={`cursor-pointer border-zinc-800/40 transition-colors ${isSelected ? "bg-zinc-800/50" : "hover:bg-zinc-900/50"}`}>
                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className={`h-7 w-7 rounded-full bg-gradient-to-br ${getAvatarGradient(c.name)} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                              {getInitials(c.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium text-white truncate">{c.name}</span>
                                {c.starred && <Star className="h-2.5 w-2.5 text-yellow-500 fill-yellow-500 shrink-0" />}
                              </div>
                              {c.email && <p className="text-[10px] text-zinc-600 truncate">{c.email}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-zinc-400 py-2.5">{c.organization || "—"}</TableCell>
                        <TableCell className="py-2.5">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${catCfg.bg}`}>{catCfg.label}</Badge>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <span className="flex items-center gap-1.5 text-xs">
                            <span className={`h-1.5 w-1.5 rounded-full ${hCfg.dot}`} />
                            <span className={hCfg.color}>{hCfg.label}</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-zinc-500 py-2.5">{timeAgo(c.lastMeetingDate)}</TableCell>
                        <TableCell className="text-xs text-zinc-400 text-right py-2.5 tabular-nums">{c.meetingCount}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ═══ RIGHT: DETAIL PANEL ═══ */}
      {selectedId && (
        <div className="w-[420px] shrink-0 border-l border-zinc-800/60 flex flex-col bg-zinc-950/30 animate-fade-in-up">
          {selectedProfile.isLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-16 bg-zinc-800/50 rounded-lg" />
              <Skeleton className="h-8 bg-zinc-800/50 rounded-lg" />
              <Skeleton className="h-32 bg-zinc-800/50 rounded-lg" />
            </div>
          ) : profile ? (
            <>
              {/* Header */}
              <div className="shrink-0 p-5 pb-4 border-b border-zinc-800/60">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className={`h-12 w-12 rounded-full bg-gradient-to-br ${getAvatarGradient(profile.name)} flex items-center justify-center text-white text-base font-bold shadow-md`}>
                        {getInitials(profile.name)}
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-zinc-950 ${healthConfig[getHealth(profile.daysSinceLastMeeting, profile.meetingCount)]?.dot}`} />
                    </div>
                    <div>
                      {isEditing ? (
                        <Input value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })}
                          className="h-7 text-sm font-semibold bg-zinc-800 border-zinc-700 text-white" />
                      ) : (
                        <h2 className="text-base font-semibold text-white leading-tight">{profile.name}</h2>
                      )}
                      {!isEditing && (profile.title || profile.organization) && (
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {profile.title}{profile.title && profile.organization ? " · " : ""}{profile.organization}
                        </p>
                      )}
                      {/* Aliases */}
                      {!isEditing && aliases.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {aliases.map((a: any) => (
                            <span key={a.id} className="text-[10px] text-zinc-600 bg-zinc-800/60 px-1.5 py-0.5 rounded">
                              aka {a.aliasName}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button onClick={() => toggleStar.mutate({ id: profile.id, starred: !profile.starred })}
                          className="p-1.5 rounded-md text-zinc-500 hover:text-yellow-500 transition-colors">
                          <Star className={`h-4 w-4 ${profile.starred ? "text-yellow-500 fill-yellow-500" : ""}`} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">{profile.starred ? "Unstar" : "Star"}</TooltipContent>
                    </Tooltip>
                    <button onClick={() => setSelectedId(null)} className="p-1.5 rounded-md text-zinc-500 hover:text-white transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Quick Stats Row */}
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[
                    { label: "Meetings", value: profile.meetingCount, icon: Calendar },
                    { label: "Tasks", value: profile.taskCount, icon: CheckSquare },
                    { label: "Docs", value: documents.length, icon: FileText },
                    { label: "Last", value: timeAgo(profile.lastMeetingDate), icon: Clock },
                  ].map(s => (
                    <div key={s.label} className="text-center p-1.5 rounded-md bg-zinc-900/50 border border-zinc-800/40">
                      <p className="text-sm font-semibold text-white tabular-nums">{s.value}</p>
                      <p className="text-[9px] text-zinc-600">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Action Bar */}
                <div className="flex items-center gap-1">
                  {isEditing ? (
                    <>
                      <Button size="sm" onClick={saveEdit} disabled={updateContact.isPending} className="h-7 text-xs bg-yellow-600 hover:bg-yellow-700 text-black font-medium flex-1">
                        {updateContact.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setIsEditing(false)} className="h-7 text-xs border-zinc-700 text-zinc-400">Cancel</Button>
                    </>
                  ) : (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm" variant="ghost" onClick={startEdit} className="h-7 w-7 p-0 text-zinc-400 hover:text-white">
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">Edit</TooltipContent>
                      </Tooltip>
                      {profile.email && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a href={`mailto:${profile.email}`}>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-zinc-400 hover:text-white"><Mail className="h-3.5 w-3.5" /></Button>
                            </a>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">Email</TooltipContent>
                        </Tooltip>
                      )}
                      {profile.phone && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a href={`tel:${profile.phone}`}>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-zinc-400 hover:text-white"><Phone className="h-3.5 w-3.5" /></Button>
                            </a>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">Call</TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm" variant="ghost" onClick={() => generateSummary.mutate({ id: profile.id })}
                            disabled={generateSummary.isPending} className="h-7 w-7 p-0 text-zinc-400 hover:text-yellow-500">
                            {generateSummary.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">AI Summary</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm" variant="ghost" onClick={() => enrichWithAI.mutate({ id: profile.id })}
                            disabled={enrichWithAI.isPending} className="h-7 w-7 p-0 text-zinc-400 hover:text-purple-400">
                            {enrichWithAI.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">AI Enrich</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm" variant="ghost" onClick={() => { setMergeSourceId(profile.id); setMergeDialogOpen(true); }}
                            className="h-7 w-7 p-0 text-zinc-400 hover:text-purple-400">
                            <Merge className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">Merge</TooltipContent>
                      </Tooltip>
                      <Link href={`/contact/${profile.id}`}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-zinc-400 hover:text-white">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">Full Profile</TooltipContent>
                        </Tooltip>
                      </Link>
                      <div className="flex-1" />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-zinc-600 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-white">Delete Contact</AlertDialogTitle>
                            <AlertDialogDescription className="text-zinc-400">Delete {profile.name}? This cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-zinc-300">Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteContact.mutate({ id: profile.id })} className="bg-red-600 hover:bg-red-700 text-white">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </div>

              {/* Tabbed Content */}
              <ScrollArea className="flex-1">
                <Tabs value={detailTab} onValueChange={setDetailTab} className="flex-1">
                  <TabsList className="w-full justify-start bg-transparent border-b border-zinc-800/60 rounded-none h-auto p-0 px-5">
                    {[
                      { id: "overview", label: "Overview" },
                      { id: "meetings", label: "Meetings", count: profile.meetingCount },
                      { id: "documents", label: "Docs", count: documents.length },
                      { id: "notes", label: "Notes", count: notes.length },
                      { id: "email", label: "Email" },
                    ].map(tab => (
                      <TabsTrigger key={tab.id} value={tab.id}
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-yellow-500 data-[state=active]:text-white data-[state=active]:bg-transparent text-zinc-500 text-xs px-3 py-2.5 hover:text-zinc-300">
                        {tab.label}
                        {tab.count !== undefined && tab.count > 0 && (
                          <span className="ml-1.5 text-[10px] text-zinc-600 tabular-nums">{tab.count}</span>
                        )}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {/* ─── OVERVIEW TAB ─── */}
                  <TabsContent value="overview" className="p-5 space-y-5 mt-0">
                    {/* AI Summary */}
                    {profile.aiSummary && (
                      <div className="p-3 rounded-lg bg-gradient-to-br from-yellow-600/5 to-amber-600/5 border border-yellow-600/15">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Brain className="h-3 w-3 text-yellow-500" />
                          <span className="text-[10px] font-medium text-yellow-500 uppercase tracking-wider">Intelligence Summary</span>
                        </div>
                        <p className="text-xs text-zinc-300 leading-relaxed">{profile.aiSummary}</p>
                      </div>
                    )}

                    {/* Contact Details */}
                    <div>
                      <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest mb-2">Details</p>
                      <div className="space-y-2">
                        {isEditing ? (
                          <div className="grid grid-cols-2 gap-2">
                            <div><Label className="text-[10px] text-zinc-500">Email</Label><Input value={editData.email} onChange={e => setEditData({...editData, email: e.target.value})} className="h-7 text-xs bg-zinc-800 border-zinc-700 text-white mt-0.5" /></div>
                            <div><Label className="text-[10px] text-zinc-500">Phone</Label><Input value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} className="h-7 text-xs bg-zinc-800 border-zinc-700 text-white mt-0.5" /></div>
                            <div><Label className="text-[10px] text-zinc-500">Organization</Label><Input value={editData.organization} onChange={e => setEditData({...editData, organization: e.target.value})} className="h-7 text-xs bg-zinc-800 border-zinc-700 text-white mt-0.5" /></div>
                            <div><Label className="text-[10px] text-zinc-500">Title</Label><Input value={editData.title} onChange={e => setEditData({...editData, title: e.target.value})} className="h-7 text-xs bg-zinc-800 border-zinc-700 text-white mt-0.5" /></div>
                            <div><Label className="text-[10px] text-zinc-500">Website</Label><Input value={editData.website} onChange={e => setEditData({...editData, website: e.target.value})} className="h-7 text-xs bg-zinc-800 border-zinc-700 text-white mt-0.5" /></div>
                            <div><Label className="text-[10px] text-zinc-500">LinkedIn</Label><Input value={editData.linkedin} onChange={e => setEditData({...editData, linkedin: e.target.value})} className="h-7 text-xs bg-zinc-800 border-zinc-700 text-white mt-0.5" /></div>
                            <div className="col-span-2"><Label className="text-[10px] text-zinc-500">Category</Label>
                              <Select value={editData.category} onValueChange={v => setEditData({...editData, category: v})}>
                                <SelectTrigger className="h-7 text-xs bg-zinc-800 border-zinc-700 text-white mt-0.5"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-zinc-700">
                                  {Object.entries(categoryConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-2"><Label className="text-[10px] text-zinc-500">Notes</Label>
                              <Textarea value={editData.notes} onChange={e => setEditData({...editData, notes: e.target.value})} className="text-xs bg-zinc-800 border-zinc-700 text-white mt-0.5 min-h-[60px]" />
                            </div>
                            <div><Label className="text-[10px] text-zinc-500">Risk Tier</Label>
                              <Select value={editData.riskTier || "none"} onValueChange={v => setEditData({...editData, riskTier: v === "none" ? null : v})}>
                                <SelectTrigger className="h-7 text-xs bg-zinc-800 border-zinc-700 text-white mt-0.5"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-zinc-700">
                                  <SelectItem value="none">None</SelectItem>
                                  <SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="high">High</SelectItem><SelectItem value="critical">Critical</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div><Label className="text-[10px] text-zinc-500">Influence</Label>
                              <Select value={editData.influenceWeight || "none"} onValueChange={v => setEditData({...editData, influenceWeight: v === "none" ? null : v})}>
                                <SelectTrigger className="h-7 text-xs bg-zinc-800 border-zinc-700 text-white mt-0.5"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-zinc-700">
                                  <SelectItem value="none">None</SelectItem>
                                  <SelectItem value="decision_maker">Decision Maker</SelectItem><SelectItem value="influencer">Influencer</SelectItem>
                                  <SelectItem value="gatekeeper">Gatekeeper</SelectItem><SelectItem value="champion">Champion</SelectItem>
                                  <SelectItem value="end_user">End User</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {[
                              { icon: Mail, label: "Email", value: profile.email, href: profile.email ? `mailto:${profile.email}` : undefined },
                              { icon: Phone, label: "Phone", value: profile.phone, href: profile.phone ? `tel:${profile.phone}` : undefined },
                              { icon: Building2, label: "Organization", value: profile.organization },
                              { icon: Briefcase, label: "Title", value: profile.title },
                              { icon: Globe, label: "Website", value: profile.website, href: profile.website },
                              { icon: Linkedin, label: "LinkedIn", value: profile.linkedin, href: profile.linkedin },
                              { icon: MapPin, label: "Address", value: profile.address },
                            ].filter(f => f.value).map(f => (
                              <div key={f.label} className="flex items-center gap-2.5 py-1">
                                <f.icon className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
                                {f.href ? (
                                  <a href={f.href} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-300 hover:text-yellow-500 transition-colors truncate">{f.value}</a>
                                ) : (
                                  <span className="text-xs text-zinc-300 truncate">{f.value}</span>
                                )}
                              </div>
                            ))}
                            {/* Category & Health */}
                            <div className="flex items-center gap-2 pt-1">
                              <Badge variant="outline" className={`text-[10px] border ${(categoryConfig[profile.category] || categoryConfig.other).bg}`}>
                                {(categoryConfig[profile.category] || categoryConfig.other).label}
                              </Badge>
                              {(() => {
                                const h = getHealth(profile.daysSinceLastMeeting, profile.meetingCount);
                                const hc = healthConfig[h];
                                return <span className={`text-[10px] flex items-center gap-1 ${hc.color}`}><span className={`h-1.5 w-1.5 rounded-full ${hc.dot}`} />{hc.label}</span>;
                              })()}
                              {profile.riskTier && (
                                <Badge variant="outline" className={`text-[10px] border ${riskConfig[profile.riskTier] || ""}`}>
                                  <Shield className="h-2.5 w-2.5 mr-0.5" />{profile.riskTier}
                                </Badge>
                              )}
                              {profile.influenceWeight && (
                                <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">
                                  {profile.influenceWeight.replace("_", " ")}
                                </Badge>
                              )}
                            </div>
                            {/* Notes */}
                            {profile.notes && (
                              <div className="mt-2 p-2.5 rounded-md bg-zinc-900/50 border border-zinc-800/40">
                                <p className="text-[10px] text-zinc-500 mb-1">Notes</p>
                                <p className="text-xs text-zinc-400 whitespace-pre-wrap">{profile.notes}</p>
                              </div>
                            )}
                            {/* Linked Company */}
                            {profile.companyName && (
                              <Link href={`/company/${profile.companyId}`}>
                                <div className="flex items-center gap-2 mt-2 p-2 rounded-md bg-zinc-900/50 border border-zinc-800/40 hover:border-yellow-600/30 transition-colors cursor-pointer">
                                  <Building2 className="h-3.5 w-3.5 text-yellow-500" />
                                  <span className="text-xs text-zinc-300">{profile.companyName}</span>
                                  <ChevronRight className="h-3 w-3 text-zinc-600 ml-auto" />
                                </div>
                              </Link>
                            )}
                            {/* Linked Employee */}
                            {linkedEmployee.data && (
                              <div className="flex items-center gap-2 p-2 rounded-md bg-zinc-900/50 border border-zinc-800/40">
                                <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
                                <span className="text-xs text-zinc-300">Employee: {linkedEmployee.data.name}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Aliases Section */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">Aliases</p>
                        <Dialog>
                          <DialogTrigger asChild>
                            <button className="text-[10px] text-zinc-600 hover:text-yellow-500 transition-colors flex items-center gap-0.5">
                              <Plus className="h-2.5 w-2.5" />Add
                            </button>
                          </DialogTrigger>
                          <DialogContent className="bg-zinc-900 border-zinc-800 max-w-sm">
                            <DialogHeader><DialogTitle className="text-white text-sm">Add Alias</DialogTitle></DialogHeader>
                            <AliasForm contactId={selectedId!} onSuccess={() => selectedAliases.refetch()} />
                          </DialogContent>
                        </Dialog>
                      </div>
                      {aliases.length === 0 ? (
                        <p className="text-[10px] text-zinc-600">No aliases. Future Fathom meetings will match by exact name.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {aliases.map((a: any) => (
                            <span key={a.id} className="inline-flex items-center gap-1 text-[10px] text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded-full border border-zinc-800">
                              {a.aliasName}
                              <button onClick={() => removeAlias.mutate({ aliasId: a.id })} className="text-zinc-600 hover:text-red-400 transition-colors">
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* ─── MEETINGS TAB ─── */}
                  <TabsContent value="meetings" className="p-5 space-y-2 mt-0">
                    {meetings.length === 0 ? (
                      <div className="text-center py-12">
                        <Calendar className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
                        <p className="text-xs text-zinc-500">No meetings recorded yet.</p>
                      </div>
                    ) : (
                      meetings.map((m: any) => (
                        <Link key={m.meeting.id} href={`/meeting/${m.meeting.id}`}>
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/30 border border-zinc-800/40 hover:border-zinc-700 transition-colors cursor-pointer group">
                            <div className="h-8 w-8 rounded-md bg-yellow-600/10 flex items-center justify-center shrink-0">
                              <Calendar className="h-4 w-4 text-yellow-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-white group-hover:text-yellow-500 transition-colors truncate">{m.meeting.meetingTitle || "Untitled"}</p>
                              <p className="text-[10px] text-zinc-600 mt-0.5">{formatDate(m.meeting.meetingDate)} · {timeAgo(m.meeting.meetingDate)}</p>
                              {m.meeting.executiveSummary && <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1">{m.meeting.executiveSummary}</p>}
                            </div>
                            <ChevronRight className="h-3.5 w-3.5 text-zinc-700 group-hover:text-zinc-500 shrink-0" />
                          </div>
                        </Link>
                      ))
                    )}
                  </TabsContent>

                  {/* ─── DOCUMENTS TAB ─── */}
                  <TabsContent value="documents" className="p-5 space-y-4 mt-0">
                    {/* Upload */}
                    <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/40">
                      <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest mb-2">Upload Document</p>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <Input value={docTitle} onChange={e => setDocTitle(e.target.value)} placeholder="Title" className="h-7 text-xs bg-zinc-800 border-zinc-700 text-white" />
                        <Select value={docCategory} onValueChange={setDocCategory}>
                          <SelectTrigger className="h-7 text-xs bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-zinc-900 border-zinc-700">
                            {Object.entries(DOC_CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt,.csv" />
                      <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="h-7 text-xs bg-yellow-600 hover:bg-yellow-700 text-black font-medium w-full">
                        {uploading ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Uploading...</> : <><Upload className="h-3 w-3 mr-1" />Choose File</>}
                      </Button>
                    </div>
                    {/* List */}
                    {documents.length === 0 ? (
                      <div className="text-center py-8">
                        <FileText className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
                        <p className="text-xs text-zinc-500">No documents yet.</p>
                      </div>
                    ) : (
                      documents.map((doc: any) => (
                        <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/30 border border-zinc-800/40 group">
                          <div className="h-8 w-8 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0">
                            <File className="h-4 w-4 text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-white truncate">{doc.title}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge variant="outline" className="text-[9px] px-1 py-0 border-zinc-700 text-zinc-500">{DOC_CATEGORY_LABELS[doc.category] || doc.category}</Badge>
                              <span className="text-[10px] text-zinc-600">{timeAgo(doc.createdAt)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-zinc-500 hover:text-white"><Download className="h-3 w-3" /></Button>
                            </a>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-zinc-600 hover:text-red-400"><Trash2 className="h-3 w-3" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-zinc-900 border-zinc-800">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-white">Delete Document</AlertDialogTitle>
                                  <AlertDialogDescription className="text-zinc-400">Delete "{doc.title}"?</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-zinc-300">Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteDocMutation.mutate({ id: doc.id })} className="bg-red-600 hover:bg-red-700 text-white">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      ))
                    )}
                  </TabsContent>

                  {/* ─── NOTES TAB ─── */}
                  <TabsContent value="notes" className="p-5 space-y-3 mt-0">
                    <div className="flex gap-2">
                      <Textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note..."
                        className="text-xs bg-zinc-900/50 border-zinc-800 text-white min-h-[60px]" />
                    </div>
                    <Button size="sm" onClick={() => { if (newNote.trim()) addNoteMutation.mutate({ contactId: selectedId!, content: newNote.trim() }); }}
                      disabled={!newNote.trim() || addNoteMutation.isPending} className="h-7 text-xs bg-yellow-600 hover:bg-yellow-700 text-black font-medium">
                      <Send className="h-3 w-3 mr-1" />Add Note
                    </Button>
                    {notes.length === 0 ? (
                      <div className="text-center py-8">
                        <MessageCircle className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
                        <p className="text-xs text-zinc-500">No notes yet.</p>
                      </div>
                    ) : (
                      notes.map((note: any) => (
                        <div key={note.id} className="p-3 rounded-lg bg-zinc-900/30 border border-zinc-800/40 group">
                          <p className="text-xs text-zinc-300 whitespace-pre-wrap">{note.content}</p>
                          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-zinc-800/40">
                            <span className="text-[10px] text-zinc-600">{note.createdByName} · {formatDate(note.createdAt)}</span>
                            <button onClick={() => deleteNoteMutation.mutate({ id: note.id })}
                              className="text-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </TabsContent>

                  {/* ─── EMAIL TAB ─── */}
                  <TabsContent value="email" className="p-5 mt-0">
                    <ContactEmailTab contact={profile} contactId={selectedId!} />
                  </TabsContent>
                </Tabs>
              </ScrollArea>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-zinc-500">Contact not found</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ CREATE CONTACT DIALOG ═══ */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2"><UserPlus className="h-5 w-5 text-yellow-500" />New Contact</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label className="text-xs text-zinc-500">Name *</Label>
              <Input value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} className="bg-zinc-800 border-zinc-700 text-white mt-1" /></div>
            <div><Label className="text-xs text-zinc-500">Email</Label>
              <Input value={newContact.email} onChange={e => setNewContact({...newContact, email: e.target.value})} className="bg-zinc-800 border-zinc-700 text-white mt-1" /></div>
            <div><Label className="text-xs text-zinc-500">Phone</Label>
              <Input value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})} className="bg-zinc-800 border-zinc-700 text-white mt-1" /></div>
            <div><Label className="text-xs text-zinc-500">Organization</Label>
              <Input value={newContact.organization} onChange={e => setNewContact({...newContact, organization: e.target.value})} className="bg-zinc-800 border-zinc-700 text-white mt-1" /></div>
            <div><Label className="text-xs text-zinc-500">Title</Label>
              <Input value={newContact.title} onChange={e => setNewContact({...newContact, title: e.target.value})} className="bg-zinc-800 border-zinc-700 text-white mt-1" /></div>
            <div className="col-span-2"><Label className="text-xs text-zinc-500">Category</Label>
              <Select value={newContact.category} onValueChange={v => setNewContact({...newContact, category: v})}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  {Object.entries(categoryConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select></div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" className="border-zinc-700 text-zinc-300">Cancel</Button></DialogClose>
            <Button onClick={() => createContact.mutate(newContact)} disabled={!newContact.name.trim() || createContact.isPending}
              className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium">
              {createContact.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ MERGE CONTACT DIALOG ═══ */}
      <Dialog open={mergeDialogOpen} onOpenChange={(open) => { setMergeDialogOpen(open); if (!open) { setMergeSourceId(null); setMergeTargetId(null); setMergeSearch(""); } }}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2"><Merge className="h-5 w-5 text-purple-400" />Merge Contact</DialogTitle>
          </DialogHeader>
          {(() => {
            const sourceContact = contacts?.find((c: any) => c.id === mergeSourceId);
            const mergeTargets = (contacts || []).filter((c: any) =>
              c.id !== mergeSourceId && c.approvalStatus !== "rejected" &&
              (mergeSearch === "" || c.name?.toLowerCase().includes(mergeSearch.toLowerCase()) ||
               c.email?.toLowerCase().includes(mergeSearch.toLowerCase()) ||
               c.organization?.toLowerCase().includes(mergeSearch.toLowerCase()))
            );
            return (
              <div className="space-y-4">
                {sourceContact && (
                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Merging this contact</p>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarGradient(sourceContact.name)} flex items-center justify-center text-white text-sm font-bold`}>
                        {getInitials(sourceContact.name)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{sourceContact.name}</p>
                        <p className="text-xs text-zinc-500">{sourceContact.email || sourceContact.organization || "No details"}</p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 text-zinc-500">
                  <div className="flex-1 h-px bg-zinc-800" />
                  <span className="text-xs">merge into</span>
                  <div className="flex-1 h-px bg-zinc-800" />
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input value={mergeSearch} onChange={e => setMergeSearch(e.target.value)} placeholder="Search contacts to merge into..." className="pl-9 bg-zinc-800 border-zinc-700 text-white" />
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1 border border-zinc-800 rounded-lg p-1">
                  {mergeTargets.length === 0 ? (
                    <p className="text-sm text-zinc-500 text-center py-4">No matching contacts found</p>
                  ) : (
                    mergeTargets.slice(0, 20).map((c: any) => (
                      <button key={c.id} onClick={() => setMergeTargetId(c.id)}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-md text-left transition-colors ${
                          mergeTargetId === c.id ? "bg-purple-500/20 border border-purple-500/30" : "hover:bg-zinc-800/50 border border-transparent"
                        }`}>
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarGradient(c.name)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                          {getInitials(c.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white truncate">{c.name}</p>
                          <p className="text-[10px] text-zinc-500 truncate">{c.email || c.organization || ""}</p>
                        </div>
                        {mergeTargetId === c.id && <Check className="h-4 w-4 text-purple-400 shrink-0" />}
                      </button>
                    ))
                  )}
                </div>
                {mergeTargetId && sourceContact && (() => {
                  const target = contacts?.find((c: any) => c.id === mergeTargetId);
                  return target ? (
                    <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
                      <p className="text-[10px] text-purple-400 uppercase tracking-wider mb-2">Merge Preview</p>
                      <ul className="text-xs text-zinc-400 space-y-1">
                        <li>{"\u2022"} <strong className="text-white">{sourceContact.name}</strong> will be saved as an alias of <strong className="text-white">{target.name}</strong></li>
                        <li>{"\u2022"} All meetings and interactions will transfer to <strong className="text-white">{target.name}</strong></li>
                        <li>{"\u2022"} Missing fields (email, phone, org) will be filled from the merged contact</li>
                        <li>{"\u2022"} Future Fathom meetings with "{sourceContact.name}" will auto-link to {target.name}</li>
                      </ul>
                    </div>
                  ) : null;
                })()}
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" className="border-zinc-700 text-zinc-300">Cancel</Button>
                  </DialogClose>
                  <Button onClick={() => { if (mergeSourceId && mergeTargetId) mergeMutation.mutate({ keepId: mergeTargetId, mergeId: mergeSourceId }); }}
                    disabled={!mergeTargetId || mergeMutation.isPending}
                    className="bg-purple-600 hover:bg-purple-700 text-white">
                    {mergeMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Merging...</> : <><Merge className="h-4 w-4 mr-2" />Merge Contacts</>}
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ALIAS FORM COMPONENT
   ═══════════════════════════════════════════════════════════════ */
function AliasForm({ contactId, onSuccess }: { contactId: number; onSuccess: () => void }) {
  const [aliasName, setAliasName] = useState("");
  const [aliasEmail, setAliasEmail] = useState("");
  const addAlias = trpc.contacts.addAlias.useMutation({
    onSuccess: () => { toast.success("Alias added"); setAliasName(""); setAliasEmail(""); onSuccess(); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="space-y-3">
      <div><Label className="text-xs text-zinc-500">Alias Name *</Label>
        <Input value={aliasName} onChange={e => setAliasName(e.target.value)} placeholder="e.g. Jake Ryan" className="bg-zinc-800 border-zinc-700 text-white mt-1" /></div>
      <div><Label className="text-xs text-zinc-500">Alias Email (optional)</Label>
        <Input value={aliasEmail} onChange={e => setAliasEmail(e.target.value)} placeholder="e.g. jake@example.com" className="bg-zinc-800 border-zinc-700 text-white mt-1" /></div>
      <DialogFooter>
        <DialogClose asChild><Button variant="outline" className="border-zinc-700 text-zinc-300">Cancel</Button></DialogClose>
        <Button onClick={() => addAlias.mutate({ contactId, aliasName, aliasEmail: aliasEmail || undefined })}
          disabled={!aliasName.trim() || addAlias.isPending} className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium">
          {addAlias.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}Add Alias
        </Button>
      </DialogFooter>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CONTACT EMAIL TAB COMPONENT
   ═══════════════════════════════════════════════════════════════ */
function ContactEmailTab({ contact, contactId }: { contact: any; contactId: number }) {
  const [composing, setComposing] = useState(false);
  const [composeData, setComposeData] = useState({ to: "", subject: "", body: "", cc: "" });
  const [expandedThread, setExpandedThread] = useState<string | null>(null);

  const contactEmail = contact?.email;
  const { data: connectionStatus } = trpc.mail.connectionStatus.useQuery();
  const authUrlMutation = trpc.mail.getAuthUrl.useMutation();
  const [authUrl, setAuthUrl] = useState<string | null>(null);

  useEffect(() => {
    if (connectionStatus?.connected === false && !authUrl) {
      authUrlMutation.mutateAsync({ origin: window.location.origin }).then(r => setAuthUrl(r.url)).catch(() => {});
    }
  }, [connectionStatus?.connected]);

  const { data: emailThreads, isLoading: emailsLoading, refetch: refetchEmails } = trpc.mail.getByContact.useQuery(
    { contactEmail: contactEmail! },
    { enabled: !!contactEmail && connectionStatus?.connected === true }
  );
  const { data: threadDetail, isLoading: threadLoading } = trpc.mail.getThread.useQuery(
    { threadId: expandedThread! },
    { enabled: !!expandedThread && connectionStatus?.connected === true }
  );
  const sendMutation = trpc.mail.send.useMutation({
    onSuccess: () => { toast.success("Email sent"); setComposing(false); setComposeData({ to: "", subject: "", body: "", cc: "" }); refetchEmails(); },
    onError: () => toast.error("Failed to send email"),
  });

  const handleCompose = () => { setComposeData({ to: contactEmail || "", subject: "", body: "", cc: "" }); setComposing(true); };
  const handleSend = () => {
    if (!composeData.to || !composeData.subject) { toast.error("To and Subject are required"); return; }
    sendMutation.mutate({
      to: composeData.to.split(',').map(e => e.trim()).filter(Boolean),
      subject: composeData.subject,
      body: composeData.body,
      cc: composeData.cc ? composeData.cc.split(',').map(e => e.trim()).filter(Boolean) : undefined,
    });
  };

  const formatEmailDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const diff = Date.now() - d.getTime();
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (!connectionStatus?.connected) {
    return (
      <div className="text-center py-12">
        <Mail className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-white mb-1">Connect Gmail</h3>
        <p className="text-xs text-zinc-500 mb-4 max-w-xs mx-auto">Connect your Google account to view email history.</p>
        {authUrl ? (
          <a href={authUrl}><Button size="sm" className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium"><Mail className="h-3.5 w-3.5 mr-1.5" />Connect</Button></a>
        ) : (
          <Button size="sm" disabled className="bg-zinc-700 text-zinc-400">Loading...</Button>
        )}
      </div>
    );
  }

  if (!contactEmail) {
    return (
      <div className="text-center py-12">
        <Mail className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-white mb-1">No Email Address</h3>
        <p className="text-xs text-zinc-500">Add an email address to view email history.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-[10px]">{contactEmail}</Badge>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => refetchEmails()} className="h-7 w-7 p-0 text-zinc-500 hover:text-white">
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button size="sm" onClick={handleCompose} className="h-7 text-xs bg-yellow-600 hover:bg-yellow-700 text-black font-medium">
            <Send className="h-3 w-3 mr-1" />Compose
          </Button>
        </div>
      </div>

      {composing && (
        <div className="p-3 rounded-lg bg-zinc-900 border border-yellow-600/30 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-yellow-500">New Email</span>
            <button onClick={() => setComposing(false)} className="text-zinc-500 hover:text-white"><X className="h-3.5 w-3.5" /></button>
          </div>
          <Input value={composeData.to} onChange={e => setComposeData(d => ({ ...d, to: e.target.value }))} placeholder="To" className="h-7 text-xs bg-zinc-800 border-zinc-700 text-white" />
          <Input value={composeData.cc} onChange={e => setComposeData(d => ({ ...d, cc: e.target.value }))} placeholder="Cc" className="h-7 text-xs bg-zinc-800 border-zinc-700 text-white" />
          <Input value={composeData.subject} onChange={e => setComposeData(d => ({ ...d, subject: e.target.value }))} placeholder="Subject" className="h-7 text-xs bg-zinc-800 border-zinc-700 text-white" />
          <Textarea value={composeData.body} onChange={e => setComposeData(d => ({ ...d, body: e.target.value }))} placeholder="Message..." className="text-xs bg-zinc-800 border-zinc-700 text-white min-h-[80px]" />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setComposing(false)} className="h-7 text-xs border-zinc-700 text-zinc-400">Cancel</Button>
            <Button size="sm" onClick={handleSend} disabled={sendMutation.isPending} className="h-7 text-xs bg-yellow-600 hover:bg-yellow-700 text-black font-medium">
              {sendMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}Send
            </Button>
          </div>
        </div>
      )}

      {emailsLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 bg-zinc-800/50" />)}</div>
      ) : !emailThreads?.threads?.length ? (
        <div className="text-center py-8">
          <Mail className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
          <p className="text-xs text-zinc-500">No email history.</p>
          <Button size="sm" onClick={handleCompose} className="mt-2 h-7 text-xs bg-yellow-600 hover:bg-yellow-700 text-black font-medium">
            <Send className="h-3 w-3 mr-1" />Send First Email
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {emailThreads.threads.map((thread: any) => (
            <div key={thread.threadId}>
              <button onClick={() => setExpandedThread(expandedThread === thread.threadId ? null : thread.threadId)}
                className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                  expandedThread === thread.threadId ? 'bg-zinc-800/80 border-yellow-600/30' :
                  thread.isUnread ? 'bg-zinc-900/60 border-zinc-700 hover:border-zinc-600' : 'bg-zinc-900/20 border-zinc-800/40 hover:border-zinc-700'
                }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs truncate ${thread.isUnread ? 'font-semibold text-white' : 'text-zinc-300'}`}>{thread.subject || '(no subject)'}</span>
                      {thread.messageCount > 1 && <span className="text-[9px] text-zinc-600 tabular-nums shrink-0">{thread.messageCount}</span>}
                    </div>
                    <p className="text-[10px] text-zinc-600 truncate mt-0.5">{thread.snippet}</p>
                  </div>
                  <span className="text-[10px] text-zinc-600 shrink-0">{formatEmailDate(thread.date)}</span>
                </div>
              </button>
              {expandedThread === thread.threadId && (
                <div className="mt-1.5 ml-2 pl-2.5 border-l-2 border-yellow-600/20 space-y-2">
                  {threadLoading ? (
                    <div className="py-3 flex items-center gap-2 text-zinc-500"><Loader2 className="h-3 w-3 animate-spin" /><span className="text-xs">Loading...</span></div>
                  ) : threadDetail?.messages?.map((msg: any, idx: number) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-zinc-800/40 border border-zinc-800/40">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-medium text-white">{msg.from}</span>
                        <span className="text-[9px] text-zinc-600">{new Date(msg.date).toLocaleString()}</span>
                      </div>
                      <div className="text-xs text-zinc-400 whitespace-pre-wrap break-words leading-relaxed">{msg.bodyText || msg.snippet || '(empty)'}</div>
                    </div>
                  ))}
                  <Button size="sm" variant="ghost" onClick={() => {
                    const lastMsg = threadDetail?.messages?.[threadDetail.messages.length - 1];
                    setComposeData({ to: lastMsg?.from || contactEmail, subject: `Re: ${thread.subject || ''}`, body: '', cc: '' });
                    setComposing(true);
                  }} className="h-6 text-[10px] text-zinc-500 hover:text-white">
                    <ArrowLeft className="h-2.5 w-2.5 mr-1" />Reply
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
