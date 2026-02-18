import { useState, useMemo, useEffect, useRef } from "react";
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
  Cake, Target, TrendingUp, Link2, AlertTriangle, User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

/* ─── Constants ─── */
const categoryColors: Record<string, string> = {
  client: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  prospect: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  partner: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  vendor: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  other: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

const healthColors: Record<string, { dot: string; text: string; label: string }> = {
  strong: { dot: "bg-emerald-500", text: "text-emerald-400", label: "Strong" },
  warm: { dot: "bg-yellow-500", text: "text-yellow-400", label: "Warm" },
  cold: { dot: "bg-red-500", text: "text-red-400", label: "Cold" },
  new: { dot: "bg-blue-500", text: "text-blue-400", label: "New" },
};

const RISK_COLORS: Record<string, string> = {
  low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
};

const DOC_CATEGORY_LABELS: Record<string, string> = {
  ncnda: "NCNDA", contract: "Contract", agreement: "Agreement",
  proposal: "Proposal", invoice: "Invoice", kyc: "KYC",
  compliance: "Compliance", correspondence: "Correspondence", other: "Other",
};

/* ─── Helpers ─── */
function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.charAt(0).toUpperCase();
}

function getAvatarColor(name: string) {
  const colors = [
    "from-yellow-600 to-amber-700", "from-emerald-600 to-green-700",
    "from-blue-600 to-indigo-700", "from-purple-600 to-violet-700",
    "from-rose-600 to-pink-700", "from-cyan-600 to-teal-700",
  ];
  return colors[name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length];
}

function getRelationshipHealth(days: number | null, meetingCount: number): keyof typeof healthColors {
  if (meetingCount === 0) return "new";
  if (days === null) return "cold";
  if (days <= 14) return "strong";
  if (days <= 45) return "warm";
  return "cold";
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

function formatRelative(d: string | Date) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/* ─── Stat Card ─── */
function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-400 bg-emerald-500/10", yellow: "text-yellow-400 bg-yellow-500/10",
    blue: "text-blue-400 bg-blue-500/10", red: "text-red-400 bg-red-500/10",
    purple: "text-purple-400 bg-purple-500/10", zinc: "text-zinc-400 bg-zinc-500/10",
  };
  const [iconColor, iconBg] = (colorMap[color] || colorMap.zinc).split(" ");
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
      <div className={`h-7 w-7 rounded-md ${iconBg} flex items-center justify-center ${iconColor} mb-1.5`}>{icon}</div>
      <p className="text-xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-[10px] text-zinc-500 mt-0.5">{label}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
export default function Contacts() {
  const { isAuthenticated } = useAuth();
  const { data: contacts, isLoading } = trpc.contacts.list.useQuery(undefined, { enabled: isAuthenticated });
  const utils = trpc.useUtils();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [healthFilter, setHealthFilter] = useState<string>("all");
  const [showPending, setShowPending] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", email: "", phone: "", organization: "", title: "", category: "other" as string });

  // Dossier panel state
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [activeTab, setActiveTab] = useState("overview");
  const [showIntel, setShowIntel] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const [docCategory, setDocCategory] = useState("other");
  const [docNotes, setDocNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Selected contact profile data
  const { data: selectedProfile, isLoading: profileLoading } = trpc.contacts.getProfile.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId }
  );
  const { data: selectedNotes = [] } = trpc.contacts.getNotes.useQuery(
    { contactId: selectedId! },
    { enabled: !!selectedId }
  );
  const { data: documents = [] } = trpc.contacts.getDocuments.useQuery(
    { contactId: selectedId! },
    { enabled: !!selectedId }
  );
  const { data: linkedEmployee } = trpc.contacts.getLinkedEmployee.useQuery(
    { contactId: selectedId! },
    { enabled: !!selectedId }
  );

  /* ─── Mutations ─── */
  const syncMutation = trpc.contacts.syncFromMeetings.useMutation({
    onSuccess: (result: any) => {
      toast.success(`Synced ${result.created || 0} new contacts, ${result.linked || 0} meeting links`);
      utils.contacts.list.invalidate();
    },
  });

  const createMutation = trpc.contacts.create.useMutation({
    onSuccess: () => {
      toast.success("Relationship created");
      utils.contacts.list.invalidate();
      setShowCreate(false);
      setNewContact({ name: "", email: "", phone: "", organization: "", title: "", category: "other" });
    },
  });

  const approveMutation = trpc.contacts.approve.useMutation({
    onSuccess: () => { toast.success("Contact approved"); utils.contacts.list.invalidate(); },
  });

  const rejectMutation = trpc.contacts.reject.useMutation({
    onSuccess: () => {
      toast.success("Contact rejected"); utils.contacts.list.invalidate();
      if (selectedId) setSelectedId(null);
    },
  });

  const deleteMutation = trpc.contacts.delete.useMutation({
    onSuccess: () => {
      toast.success("Contact deleted"); utils.contacts.list.invalidate();
      setSelectedId(null); setEditing(false);
    },
  });

  const bulkApproveMutation = trpc.contacts.bulkApprove.useMutation({
    onSuccess: (result: any) => {
      toast.success(`Approved ${result.count} contacts`); utils.contacts.list.invalidate();
    },
  });

  const toggleStarMutation = trpc.contacts.toggleStar.useMutation({
    onSuccess: () => {
      utils.contacts.list.invalidate();
      if (selectedId) utils.contacts.getProfile.invalidate({ id: selectedId });
    },
  });

  const updateMutation = trpc.contacts.update.useMutation({
    onSuccess: () => {
      toast.success("Contact updated");
      utils.contacts.getProfile.invalidate({ id: selectedId! });
      utils.contacts.list.invalidate();
      setEditing(false);
    },
    onError: () => toast.error("Failed to update contact"),
  });

  const aiSummaryMutation = trpc.contacts.generateAiSummary.useMutation({
    onSuccess: () => {
      toast.success("AI summary generated");
      utils.contacts.getProfile.invalidate({ id: selectedId! });
    },
    onError: () => toast.error("Failed to generate AI summary"),
  });

  const enrichMutation = trpc.contacts.enrichWithAI.useMutation({
    onSuccess: (data) => {
      const count = data.updated.length;
      if (count > 0) toast.success(`AI enriched ${count} field${count > 1 ? "s" : ""}: ${data.updated.join(", ")}`);
      else toast.info("AI couldn't find new information to add.");
      utils.contacts.getProfile.invalidate({ id: selectedId! });
    },
    onError: () => toast.error("Failed to enrich contact with AI"),
  });

  const addNoteMutation = trpc.contacts.addNote.useMutation({
    onSuccess: () => {
      toast.success("Note added");
      utils.contacts.getNotes.invalidate({ contactId: selectedId! });
      setNewNote("");
    },
    onError: () => toast.error("Failed to add note"),
  });

  const deleteNoteMutation = trpc.contacts.deleteNote.useMutation({
    onSuccess: () => {
      toast.success("Note deleted");
      utils.contacts.getNotes.invalidate({ contactId: selectedId! });
    },
  });

  const uploadDocMutation = trpc.contacts.uploadDocument.useMutation({
    onSuccess: () => {
      toast.success("Document uploaded");
      utils.contacts.getDocuments.invalidate({ contactId: selectedId! });
      setDocTitle(""); setDocCategory("other"); setDocNotes(""); setUploading(false);
    },
    onError: () => { toast.error("Failed to upload document"); setUploading(false); },
  });

  const deleteDocMutation = trpc.contacts.deleteDocument.useMutation({
    onSuccess: () => {
      toast.success("Document deleted");
      utils.contacts.getDocuments.invalidate({ contactId: selectedId! });
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("File size must be under 10MB"); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadDocMutation.mutate({
        contactId: selectedId!, title: docTitle || file.name,
        category: docCategory as any, fileData: base64,
        fileName: file.name, mimeType: file.type || "application/octet-stream",
        notes: docNotes || undefined,
      });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* ─── Edit helpers ─── */
  const startEditing = () => {
    if (!selectedProfile) return;
    const p = selectedProfile as any;
    setEditData({
      name: p.name || "", email: p.email || "", phone: p.phone || "",
      organization: p.organization || "", title: p.title || "",
      dateOfBirth: p.dateOfBirth || "", address: p.address || "",
      website: p.website || "", linkedin: p.linkedin || "",
      notes: p.notes || "", category: p.category || "other",
      riskTier: p.riskTier || "", complianceStage: p.complianceStage || "",
      influenceWeight: p.influenceWeight ?? "",
      introducerSource: p.introducerSource || "", referralChain: p.referralChain || "",
    });
    setEditing(true);
  };

  const handleSave = () => {
    const updates: any = { id: selectedId! };
    for (const [key, value] of Object.entries(editData)) {
      if (key === "category" || key === "riskTier" || key === "complianceStage") {
        updates[key] = value || undefined;
      } else if (key === "influenceWeight") {
        updates[key] = value !== "" ? Number(value) : undefined;
      } else {
        updates[key] = (value as string)?.trim() || null;
      }
    }
    updateMutation.mutate(updates);
  };

  // Reset dossier state when switching contacts
  useEffect(() => {
    setEditing(false);
    setActiveTab("overview");
    setNewNote("");
  }, [selectedId]);

  /* ─── Filtered lists ─── */
  const pendingContacts = useMemo(() => {
    if (!contacts) return [];
    return contacts.filter((c: any) => c.approvalStatus === "pending");
  }, [contacts]);

  const approvedContacts = useMemo(() => {
    if (!contacts) return [];
    return contacts.filter((c: any) => c.approvalStatus !== "pending" && c.approvalStatus !== "rejected");
  }, [contacts]);

  const filtered = useMemo(() => {
    let result = [...approvedContacts];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c: any) =>
        c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) ||
        c.organization?.toLowerCase().includes(q) || c.title?.toLowerCase().includes(q) ||
        c.companyName?.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== "all") {
      if (categoryFilter === "starred") result = result.filter((c: any) => c.starred);
      else result = result.filter((c: any) => c.category === categoryFilter);
    }
    if (healthFilter !== "all") {
      result = result.filter((c: any) => {
        const health = getRelationshipHealth(c.daysSinceLastMeeting, c.meetingCount || 0);
        return health === healthFilter;
      });
    }
    result.sort((a: any, b: any) => {
      if (a.starred && !b.starred) return -1;
      if (!a.starred && b.starred) return 1;
      return (b.meetingCount || 0) - (a.meetingCount || 0);
    });
    return result;
  }, [approvedContacts, search, categoryFilter, healthFilter]);

  // Auto-select first contact
  useEffect(() => {
    if (!selectedId && filtered.length > 0) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  const stats = useMemo(() => {
    if (!contacts) return { total: 0, pending: 0, strong: 0, warm: 0, cold: 0 };
    const approved = contacts.filter((c: any) => c.approvalStatus !== "pending" && c.approvalStatus !== "rejected");
    return {
      total: approved.length, pending: pendingContacts.length,
      strong: approved.filter((c: any) => getRelationshipHealth(c.daysSinceLastMeeting, c.meetingCount || 0) === "strong").length,
      warm: approved.filter((c: any) => getRelationshipHealth(c.daysSinceLastMeeting, c.meetingCount || 0) === "warm").length,
      cold: approved.filter((c: any) => getRelationshipHealth(c.daysSinceLastMeeting, c.meetingCount || 0) === "cold").length,
    };
  }, [contacts, pendingContacts]);

  const selectedContact = useMemo(() => {
    if (!selectedId || !contacts) return null;
    return contacts.find((c: any) => c.id === selectedId) || null;
  }, [selectedId, contacts]);

  /* ─── Loading ─── */
  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)]">
        <div className="w-80 border-r border-zinc-800 p-4 space-y-3">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-16 bg-zinc-800/50 rounded-lg" />)}
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-48 bg-zinc-800/50 rounded-xl" />
        </div>
      </div>
    );
  }

  const profile = selectedProfile as any;
  const daysSince = profile?.daysSinceLastMeeting ?? null;
  const healthColor = daysSince === null ? "bg-zinc-500" : daysSince > 14 ? "bg-red-500" : daysSince > 7 ? "bg-yellow-500" : "bg-emerald-500";
  const healthLabel = daysSince === null ? "No meetings" : daysSince === 0 ? "Spoke today" : daysSince === 1 ? "Spoke yesterday" : `${daysSince}d since last contact`;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* ═══════════════════════════════════════════════════════════════════
          LEFT PANEL — People List
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="w-80 border-r border-zinc-800 flex flex-col bg-zinc-950/50 flex-shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-yellow-600" />
              Relationships
            </h1>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-white"
                onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
                <RefreshCw className={`h-3.5 w-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              </Button>
              <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-yellow-500">
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <UserPlus className="h-5 w-5 text-yellow-600" /> New Relationship
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    <div>
                      <Label className="text-zinc-400 text-xs">Name *</Label>
                      <Input value={newContact.name} onChange={e => setNewContact(p => ({ ...p, name: e.target.value }))}
                        className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="Full name" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-zinc-400 text-xs">Email</Label>
                        <Input value={newContact.email} onChange={e => setNewContact(p => ({ ...p, email: e.target.value }))}
                          className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="email@example.com" />
                      </div>
                      <div>
                        <Label className="text-zinc-400 text-xs">Phone</Label>
                        <Input value={newContact.phone} onChange={e => setNewContact(p => ({ ...p, phone: e.target.value }))}
                          className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="+1 (555) 000-0000" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-zinc-400 text-xs">Organization</Label>
                        <Input value={newContact.organization} onChange={e => setNewContact(p => ({ ...p, organization: e.target.value }))}
                          className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="Company name" />
                      </div>
                      <div>
                        <Label className="text-zinc-400 text-xs">Title</Label>
                        <Input value={newContact.title} onChange={e => setNewContact(p => ({ ...p, title: e.target.value }))}
                          className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="Job title" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-zinc-400 text-xs">Category</Label>
                      <Select value={newContact.category} onValueChange={v => setNewContact(p => ({ ...p, category: v }))}>
                        <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-700">
                          <SelectItem value="client">Client</SelectItem>
                          <SelectItem value="prospect">Prospect</SelectItem>
                          <SelectItem value="partner">Partner</SelectItem>
                          <SelectItem value="vendor">Vendor</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild><Button variant="ghost" className="text-zinc-400">Cancel</Button></DialogClose>
                    <Button onClick={() => createMutation.mutate({
                      ...newContact,
                      email: newContact.email || undefined,
                      phone: newContact.phone || undefined,
                      organization: newContact.organization || undefined,
                      title: newContact.title || undefined,
                      category: newContact.category as any,
                    })} disabled={!newContact.name.trim() || createMutation.isPending}
                      className="bg-yellow-600 hover:bg-yellow-700 text-black font-semibold">
                      {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <Input placeholder="Search people..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600" />
          </div>

          {/* Category filters */}
          <div className="flex gap-1.5 flex-wrap">
            {["all", "client", "prospect", "partner", "vendor", "starred"].map(f => (
              <button key={f} onClick={() => setCategoryFilter(f)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors border ${
                  categoryFilter === f
                    ? "bg-yellow-600/20 text-yellow-400 border-yellow-600/40"
                    : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700"
                }`}>
                {f === "all" ? "All" : f === "starred" ? "★ Starred" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Health filter */}
          <div className="flex gap-1.5">
            {(["all", "strong", "warm", "cold"] as const).map(h => (
              <button key={h} onClick={() => setHealthFilter(h)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors border flex items-center gap-1 ${
                  healthFilter === h
                    ? "bg-yellow-600/20 text-yellow-400 border-yellow-600/40"
                    : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700"
                }`}>
                {h !== "all" && <span className={`w-1.5 h-1.5 rounded-full ${healthColors[h].dot}`} />}
                {h === "all" ? "All Health" : healthColors[h].label}
              </button>
            ))}
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-3 text-[10px] text-zinc-500">
            <span>{stats.total} people</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{stats.strong}</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />{stats.warm}</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />{stats.cold}</span>
            {stats.pending > 0 && <span className="text-amber-400 font-medium">{stats.pending} pending</span>}
          </div>
        </div>

        {/* People List */}
        <div className="flex-1 overflow-y-auto">
          {/* Pending Approval Section */}
          {pendingContacts.length > 0 && (
            <div className="border-b border-zinc-800">
              <button onClick={() => setShowPending(!showPending)}
                className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-amber-400 hover:bg-zinc-900/50">
                <span className="flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Pending Review ({pendingContacts.length})
                </span>
                {showPending ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {showPending && (
                <div>
                  <div className="px-4 pb-1.5">
                    <Button size="sm" variant="outline"
                      className="h-6 text-[10px] border-amber-600/30 text-amber-400 hover:bg-amber-600/10 w-full"
                      onClick={() => bulkApproveMutation.mutate({ ids: pendingContacts.map((c: any) => c.id) })}
                      disabled={bulkApproveMutation.isPending}>
                      <Check className="h-3 w-3 mr-1" /> Approve All
                    </Button>
                  </div>
                  {pendingContacts.map((contact: any) => (
                    <div key={contact.id}
                      className={`px-4 py-2.5 border-l-2 border-amber-500/50 hover:bg-zinc-900/50 cursor-pointer transition-colors ${
                        selectedId === contact.id ? "bg-zinc-900/80 border-l-amber-500" : ""
                      }`}
                      onClick={() => setSelectedId(contact.id)}>
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(contact.name)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ring-1 ring-amber-500/30`}>
                          {getInitials(contact.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-white truncate">{contact.name}</div>
                          <div className="text-[10px] text-zinc-500 truncate">{contact.companyName || contact.organization || "Unknown org"}</div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={(e) => { e.stopPropagation(); approveMutation.mutate({ id: contact.id }); }}
                            className="p-1 rounded hover:bg-emerald-500/20 text-emerald-400" title="Approve">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); rejectMutation.mutate({ id: contact.id }); }}
                            className="p-1 rounded hover:bg-red-500/20 text-red-400" title="Reject">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Approved contacts list */}
          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-zinc-600 text-sm">
              {search ? "No matches found" : "No relationships yet"}
            </div>
          ) : (
            filtered.map((contact: any) => {
              const health = getRelationshipHealth(contact.daysSinceLastMeeting, contact.meetingCount || 0);
              return (
                <div key={contact.id}
                  className={`px-4 py-2.5 hover:bg-zinc-900/50 cursor-pointer transition-colors border-b border-zinc-800/30 ${
                    selectedId === contact.id ? "bg-zinc-900/80 border-l-2 border-l-yellow-600" : "border-l-2 border-l-transparent"
                  }`}
                  onClick={() => setSelectedId(contact.id)}>
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarColor(contact.name)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                        {getInitials(contact.name)}
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-zinc-950 ${healthColors[health].dot}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium text-white truncate">{contact.name}</span>
                        {contact.starred && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />}
                      </div>
                      <div className="text-[10px] text-zinc-500 truncate">
                        {contact.companyName || contact.organization || contact.title || "—"}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[10px] text-zinc-500">{timeAgo(contact.lastMeetingDate)}</div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          RIGHT PANEL — Full Dossier View
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto">
        {!selectedContact ? (
          <div className="flex items-center justify-center h-full text-zinc-600">
            <div className="text-center">
              <Users className="h-12 w-12 mx-auto mb-3 text-zinc-700" />
              <p className="text-sm">Select a person to view their dossier</p>
            </div>
          </div>
        ) : profileLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-40 bg-zinc-800/50 rounded-xl" />
            <div className="grid grid-cols-5 gap-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20 bg-zinc-800/50 rounded-lg" />)}</div>
            <Skeleton className="h-32 bg-zinc-800/50 rounded-xl" />
          </div>
        ) : !profile ? (
          <div className="flex items-center justify-center h-full text-zinc-600">
            <div className="text-center">
              <User className="h-12 w-12 mx-auto mb-3 text-zinc-700" />
              <p className="text-sm">Contact not found</p>
            </div>
          </div>
        ) : (
          <div className="p-6 max-w-5xl mx-auto">
            {/* ═══ TOP BAR — Back + Actions ═══ */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-zinc-500 flex items-center gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" /> Relationships
              </span>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" onClick={() => enrichMutation.mutate({ id: selectedId! })}
                  disabled={enrichMutation.isPending}
                  className="border-yellow-600/30 text-yellow-500 hover:bg-yellow-600/10 h-8 text-xs">
                  {enrichMutation.isPending ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Enriching...</> : <><Brain className="h-3.5 w-3.5 mr-1.5" />AI Enrich</>}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => toggleStarMutation.mutate({ id: selectedId! })}
                  className="text-zinc-400 hover:text-yellow-500 h-8 w-8 p-0">
                  <Star className={`h-4 w-4 ${profile.starred ? "text-yellow-500 fill-yellow-500" : ""}`} />
                </Button>
                {!editing ? (
                  <Button variant="outline" size="sm" onClick={startEditing}
                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 h-8 text-xs">
                    <Edit3 className="h-3.5 w-3.5 mr-1.5" />Edit
                  </Button>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(false)} className="text-zinc-400 h-8 text-xs">
                      <X className="h-3.5 w-3.5 mr-1" />Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}
                      className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium h-8 text-xs">
                      <Save className="h-3.5 w-3.5 mr-1" />{updateMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                  </>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 p-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-zinc-900 border-zinc-800">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-white">Delete Contact</AlertDialogTitle>
                      <AlertDialogDescription className="text-zinc-400">
                        Are you sure you want to delete {profile.name}? All notes, documents, and interactions will be permanently removed.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-zinc-300">Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteMutation.mutate({ id: selectedId! })}
                        className="bg-red-600 hover:bg-red-700 text-white">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            {/* ═══ DOSSIER HEADER CARD ═══ */}
            <Card className="bg-zinc-900/80 border-zinc-800 mb-5 overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-yellow-600 via-yellow-500 to-yellow-600" />
              <CardContent className="p-5">
                {editing ? (
                  /* ═══ EDIT MODE ═══ */
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-yellow-600 uppercase tracking-wider mb-2">Edit Contact</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div><Label className="text-zinc-500 text-xs">Full Name</Label>
                        <Input value={editData.name} onChange={e => setEditData((p: any) => ({ ...p, name: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white mt-1" /></div>
                      <div><Label className="text-zinc-500 text-xs">Job Title</Label>
                        <Input value={editData.title} onChange={e => setEditData((p: any) => ({ ...p, title: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="Managing Director" /></div>
                      <div><Label className="text-zinc-500 text-xs">Category</Label>
                        <Select value={editData.category || "other"} onValueChange={v => setEditData((p: any) => ({ ...p, category: v }))}>
                          <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-zinc-900 border-zinc-700">
                            <SelectItem value="client">Client</SelectItem><SelectItem value="prospect">Prospect</SelectItem>
                            <SelectItem value="partner">Partner</SelectItem><SelectItem value="vendor">Vendor</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div><Label className="text-zinc-500 text-xs">Organization</Label>
                        <Input value={editData.organization} onChange={e => setEditData((p: any) => ({ ...p, organization: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white mt-1" /></div>
                      <div><Label className="text-zinc-500 text-xs">Email</Label>
                        <Input value={editData.email} onChange={e => setEditData((p: any) => ({ ...p, email: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white mt-1" /></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div><Label className="text-zinc-500 text-xs">Phone</Label>
                        <Input value={editData.phone} onChange={e => setEditData((p: any) => ({ ...p, phone: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white mt-1" /></div>
                      <div><Label className="text-zinc-500 text-xs">Date of Birth</Label>
                        <Input value={editData.dateOfBirth} onChange={e => setEditData((p: any) => ({ ...p, dateOfBirth: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="YYYY-MM-DD" /></div>
                    </div>
                    <div><Label className="text-zinc-500 text-xs">Address</Label>
                      <Input value={editData.address} onChange={e => setEditData((p: any) => ({ ...p, address: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white mt-1" /></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div><Label className="text-zinc-500 text-xs">Website</Label>
                        <Input value={editData.website} onChange={e => setEditData((p: any) => ({ ...p, website: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white mt-1" /></div>
                      <div><Label className="text-zinc-500 text-xs">LinkedIn</Label>
                        <Input value={editData.linkedin} onChange={e => setEditData((p: any) => ({ ...p, linkedin: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white mt-1" /></div>
                    </div>
                    {/* Intelligence Fields */}
                    <div className="border-t border-zinc-800 pt-4 mt-4">
                      <h4 className="text-xs font-semibold text-yellow-600 uppercase tracking-wider mb-3">Intelligence & Compliance</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div><Label className="text-zinc-500 text-xs">Risk Tier</Label>
                          <Select value={editData.riskTier || "none"} onValueChange={v => setEditData((p: any) => ({ ...p, riskTier: v === "none" ? "" : v }))}>
                            <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-700">
                              <SelectItem value="none">Not Set</SelectItem><SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem>
                              <SelectItem value="critical">Critical</SelectItem>
                            </SelectContent>
                          </Select></div>
                        <div><Label className="text-zinc-500 text-xs">Compliance Stage</Label>
                          <Select value={editData.complianceStage || "none"} onValueChange={v => setEditData((p: any) => ({ ...p, complianceStage: v === "none" ? "" : v }))}>
                            <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-700">
                              <SelectItem value="none">Not Set</SelectItem><SelectItem value="not_started">Not Started</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="cleared">Cleared</SelectItem>
                              <SelectItem value="flagged">Flagged</SelectItem>
                            </SelectContent>
                          </Select></div>
                        <div><Label className="text-zinc-500 text-xs">Influence Weight (1-10)</Label>
                          <Input type="number" min={1} max={10} value={editData.influenceWeight}
                            onChange={e => setEditData((p: any) => ({ ...p, influenceWeight: e.target.value }))}
                            className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="1-10" /></div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                        <div><Label className="text-zinc-500 text-xs">Introducer / Source</Label>
                          <Input value={editData.introducerSource} onChange={e => setEditData((p: any) => ({ ...p, introducerSource: e.target.value }))}
                            className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="Who introduced this contact?" /></div>
                        <div><Label className="text-zinc-500 text-xs">Referral Chain</Label>
                          <Input value={editData.referralChain} onChange={e => setEditData((p: any) => ({ ...p, referralChain: e.target.value }))}
                            className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="e.g. Ahmed → Khalid → Contact" /></div>
                      </div>
                    </div>
                    <div><Label className="text-zinc-500 text-xs">Private Notes</Label>
                      <Textarea value={editData.notes} onChange={e => setEditData((p: any) => ({ ...p, notes: e.target.value }))}
                        className="bg-zinc-800 border-zinc-700 text-white mt-1 min-h-[80px]" /></div>
                  </div>
                ) : (
                  /* ═══ VIEW MODE ═══ */
                  <div className="flex items-start gap-5">
                    <div className={`h-[72px] w-[72px] rounded-xl bg-gradient-to-br ${getAvatarColor(profile.name)} flex items-center justify-center flex-shrink-0 relative`}>
                      <span className="text-2xl font-bold text-white">{profile.name?.charAt(0)?.toUpperCase()}</span>
                      {profile.starred && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 absolute -top-1 -right-1" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h1 className="text-2xl font-bold text-white">{profile.name}</h1>
                        {profile.category && profile.category !== "other" && (
                          <Badge variant="outline" className={categoryColors[profile.category] || ""}>{profile.category}</Badge>
                        )}
                        {linkedEmployee && (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30"><Users className="h-3 w-3 mr-1" />Employee</Badge>
                        )}
                        {profile.riskTier && (
                          <Badge variant="outline" className={RISK_COLORS[profile.riskTier] || ""}><Shield className="h-3 w-3 mr-1" />{profile.riskTier}</Badge>
                        )}
                        {profile.complianceStage && profile.complianceStage !== "not_started" && (
                          <Badge variant="outline" className={profile.complianceStage === "cleared" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : profile.complianceStage === "flagged" ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-blue-500/20 text-blue-400 border-blue-500/30"}>
                            {profile.complianceStage.replace("_", " ")}
                          </Badge>
                        )}
                        {selectedContact.approvalStatus === "pending" && (
                          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Pending</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-400">
                        {profile.title && <span className="flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5 text-yellow-600" />{profile.title}</span>}
                        {profile.organization && <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-yellow-600" />{profile.organization}</span>}
                        {profile.email && <a href={`mailto:${profile.email}`} className="flex items-center gap-1.5 hover:text-yellow-500 transition-colors"><Mail className="h-3.5 w-3.5 text-yellow-600" />{profile.email}</a>}
                        {profile.phone && <a href={`tel:${profile.phone}`} className="flex items-center gap-1.5 hover:text-yellow-500 transition-colors"><Phone className="h-3.5 w-3.5 text-yellow-600" />{profile.phone}</a>}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500 mt-1">
                        {profile.dateOfBirth && <span className="flex items-center gap-1.5"><Cake className="h-3.5 w-3.5 text-zinc-600" />{profile.dateOfBirth}</span>}
                        {profile.address && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-zinc-600" />{profile.address}</span>}
                        {profile.website && <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-yellow-500 transition-colors"><Globe className="h-3.5 w-3.5 text-zinc-600" />Website</a>}
                        {profile.linkedin && <a href={profile.linkedin.startsWith('http') ? profile.linkedin : `https://${profile.linkedin}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-yellow-500 transition-colors"><Linkedin className="h-3.5 w-3.5 text-zinc-600" />LinkedIn</a>}
                      </div>
                      {/* Health + Intelligence Row */}
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          <span className={`h-2 w-2 rounded-full ${healthColor}`} />
                          <span className={daysSince === null ? "text-zinc-500" : daysSince > 14 ? "text-red-400" : daysSince > 7 ? "text-yellow-500" : "text-emerald-400"}>
                            {healthLabel}
                          </span>
                        </span>
                        {profile.influenceWeight && (
                          <span className="text-xs text-zinc-500 flex items-center gap-1"><Target className="h-3 w-3 text-yellow-600" />Influence: {profile.influenceWeight}/10</span>
                        )}
                        {profile.introducerSource && (
                          <span className="text-xs text-zinc-500 flex items-center gap-1"><TrendingUp className="h-3 w-3 text-zinc-600" />Via: {profile.introducerSource}</span>
                        )}
                        {profile.referralChain && (
                          <span className="text-xs text-zinc-500 flex items-center gap-1"><Link2 className="h-3 w-3 text-zinc-600" />{profile.referralChain}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ═══ STATS GRID ═══ */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
              <StatCard icon={<Calendar className="h-4 w-4" />} label="Meetings" value={profile.meetingCount} color="yellow" />
              <StatCard icon={<CheckSquare className="h-4 w-4" />} label="Tasks" value={profile.taskCount} color="blue" />
              <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Open Tasks" value={profile.openTaskCount} color={profile.openTaskCount > 0 ? "red" : "emerald"} />
              <StatCard icon={<FileText className="h-4 w-4" />} label="Documents" value={documents.length} color="purple" />
              <StatCard icon={<Clock className="h-4 w-4" />} label="Days Since" value={daysSince ?? "—"} color={daysSince !== null && daysSince > 14 ? "red" : daysSince !== null && daysSince > 7 ? "yellow" : "emerald"} />
            </div>

            {/* ═══ AI INTELLIGENCE PANEL ═══ */}
            <Card className="bg-zinc-900/50 border-zinc-800 mb-5">
              <CardContent className="p-0">
                <button onClick={() => setShowIntel(!showIntel)} className="w-full flex items-center justify-between p-4">
                  <span className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Sparkles className="h-4 w-4 text-yellow-600" />
                    AI Relationship Intelligence
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm"
                      onClick={(e) => { e.stopPropagation(); aiSummaryMutation.mutate({ id: selectedId! }); }}
                      disabled={aiSummaryMutation.isPending}
                      className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-yellow-500 h-7 text-xs">
                      {aiSummaryMutation.isPending ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Generating...</> : <><Sparkles className="h-3 w-3 mr-1" />{profile.aiSummary ? "Regenerate" : "Generate"}</>}
                    </Button>
                    {showIntel ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
                  </div>
                </button>
                {showIntel && (
                  <div className="px-4 pb-4 border-t border-zinc-800/50">
                    {profile.aiSummary ? (
                      <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap mt-3">{profile.aiSummary}</p>
                    ) : (
                      <p className="text-sm text-zinc-600 italic mt-3">No AI summary yet. Click "Generate" to create an intelligence summary based on all meetings.</p>
                    )}
                    {profile.aiMemory && (
                      <div className="mt-3 p-3 bg-yellow-600/5 rounded-lg border border-yellow-600/10">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Brain className="h-3.5 w-3.5 text-yellow-600" />
                          <span className="text-xs font-semibold text-yellow-600 uppercase tracking-wider">Persistent Memory</span>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">{profile.aiMemory}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ═══ TABBED CONTENT ═══ */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-zinc-900/50 border border-zinc-800 mb-4">
                <TabsTrigger value="overview" className="data-[state=active]:bg-yellow-600/20 data-[state=active]:text-yellow-500">Overview</TabsTrigger>
                <TabsTrigger value="meetings" className="data-[state=active]:bg-yellow-600/20 data-[state=active]:text-yellow-500">Meetings ({profile.meetingCount})</TabsTrigger>
                <TabsTrigger value="documents" className="data-[state=active]:bg-yellow-600/20 data-[state=active]:text-yellow-500">Documents ({documents.length})</TabsTrigger>
                <TabsTrigger value="notes" className="data-[state=active]:bg-yellow-600/20 data-[state=active]:text-yellow-500">Notes ({selectedNotes.length})</TabsTrigger>
                <TabsTrigger value="email" className="data-[state=active]:bg-yellow-600/20 data-[state=active]:text-yellow-500">
                  <Mail className="h-3.5 w-3.5 mr-1" />Email
                </TabsTrigger>
              </TabsList>

              {/* ═══ OVERVIEW TAB ═══ */}
              <TabsContent value="overview">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Recent Meetings */}
                  <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-yellow-600" />Recent Meetings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {profile.meetings.length === 0 ? (
                        <p className="text-sm text-zinc-500 py-4 text-center">No meetings recorded</p>
                      ) : (
                        profile.meetings.slice(0, 5).map((mc: any) => {
                          const m = mc.meeting;
                          return (
                            <Link key={`meeting-${m.id}`} href={`/meeting/${m.id}`}>
                              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/40 border border-zinc-800 hover:border-yellow-600/30 transition-colors cursor-pointer group">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-white group-hover:text-yellow-500 transition-colors truncate">{m.meetingTitle || "Untitled Meeting"}</p>
                                  <p className="text-xs text-zinc-500 mt-0.5">{formatDate(m.meetingDate)} · {formatRelative(m.meetingDate)}</p>
                                </div>
                                <Badge variant="outline" className="border-zinc-700 text-zinc-500 text-xs ml-2 flex-shrink-0">{m.sourceType}</Badge>
                              </div>
                            </Link>
                          );
                        })
                      )}
                      {profile.meetings.length > 5 && (
                        <Button variant="ghost" size="sm" onClick={() => setActiveTab("meetings")} className="w-full text-zinc-400 hover:text-yellow-500 mt-2">View all {profile.meetingCount} meetings</Button>
                      )}
                    </CardContent>
                  </Card>

                  {/* Tasks */}
                  <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                        <CheckSquare className="h-4 w-4 text-yellow-600" />Assigned Tasks
                        <Badge variant="outline" className="border-zinc-700 text-zinc-400 ml-auto">{profile.taskCount}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
                      {profile.tasks.length === 0 ? (
                        <p className="text-sm text-zinc-500 py-4 text-center">No tasks assigned</p>
                      ) : (
                        profile.tasks.map((task: any) => {
                          const isCompleted = task.status === "completed";
                          const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isCompleted;
                          return (
                            <div key={task.id} className={`p-3 rounded-lg border transition-all ${isCompleted ? "bg-zinc-800/20 border-zinc-800/40 opacity-70" : "bg-zinc-800/40 border-zinc-800"}`}>
                              <div className="flex items-start gap-2">
                                <div className={`h-2 w-2 rounded-full mt-1.5 flex-shrink-0 ${isCompleted ? "bg-emerald-500" : task.status === "in_progress" ? "bg-yellow-500" : "bg-zinc-500"}`} />
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium ${isCompleted ? "text-zinc-500 line-through" : "text-white"}`}>{task.title}</p>
                                  <div className="flex items-center gap-3 mt-1.5">
                                    <Badge variant="outline" className={`text-xs ${task.priority === "high" ? "border-red-500/30 text-red-400" : task.priority === "medium" ? "border-yellow-500/30 text-yellow-400" : "border-blue-500/30 text-blue-400"}`}>{task.priority}</Badge>
                                    {task.dueDate && <span className={`text-xs ${isOverdue ? "text-red-400 font-medium" : "text-zinc-500"}`}>{isOverdue ? "Overdue · " : ""}{formatDate(task.dueDate)}</span>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </CardContent>
                  </Card>

                  {/* Recent Notes */}
                  <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-yellow-600" />Recent Notes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2 mb-3">
                        <Input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a quick note..."
                          className="bg-zinc-800 border-zinc-700 text-white text-sm"
                          onKeyDown={e => { if (e.key === "Enter" && newNote.trim()) addNoteMutation.mutate({ contactId: selectedId!, content: newNote.trim() }); }} />
                        <Button size="sm" onClick={() => { if (newNote.trim()) addNoteMutation.mutate({ contactId: selectedId!, content: newNote.trim() }); }}
                          disabled={!newNote.trim() || addNoteMutation.isPending} className="bg-yellow-600 hover:bg-yellow-700 text-black"><Send className="h-4 w-4" /></Button>
                      </div>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {selectedNotes.length === 0 ? (
                          <p className="text-sm text-zinc-500 py-2 text-center">No notes yet</p>
                        ) : (
                          selectedNotes.slice(0, 4).map((note: any) => (
                            <div key={note.id} className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800 group">
                              <p className="text-sm text-zinc-300 whitespace-pre-wrap line-clamp-2">{note.content}</p>
                              <span className="text-xs text-zinc-600 mt-1 block">{note.createdByName} · {formatRelative(note.createdAt)}</span>
                            </div>
                          ))
                        )}
                      </div>
                      {selectedNotes.length > 4 && (
                        <Button variant="ghost" size="sm" onClick={() => setActiveTab("notes")} className="w-full text-zinc-400 hover:text-yellow-500 mt-2">View all {selectedNotes.length} notes</Button>
                      )}
                    </CardContent>
                  </Card>

                  {/* Recent Documents */}
                  <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                          <FileText className="h-4 w-4 text-yellow-600" />Recent Documents
                        </CardTitle>
                        <Button variant="ghost" size="sm" onClick={() => setActiveTab("documents")} className="text-zinc-400 hover:text-yellow-500"><Plus className="h-3.5 w-3.5 mr-1" />Upload</Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {documents.length === 0 ? (
                        <p className="text-sm text-zinc-500 py-4 text-center">No documents uploaded</p>
                      ) : (
                        documents.slice(0, 4).map((doc: any) => (
                          <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/40 border border-zinc-800">
                            <div className="h-8 w-8 rounded-md bg-yellow-600/10 flex items-center justify-center flex-shrink-0"><File className="h-4 w-4 text-yellow-500" /></div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">{doc.title}</p>
                              <p className="text-xs text-zinc-500">{DOC_CATEGORY_LABELS[doc.category] || doc.category} · {formatRelative(doc.createdAt)}</p>
                            </div>
                            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-yellow-500 h-7 w-7 p-0"><Download className="h-3.5 w-3.5" /></Button>
                            </a>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Private Notes */}
                {profile.notes && !editing && (
                  <Card className="bg-zinc-900/50 border-zinc-800 mt-5">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold text-white flex items-center gap-2"><Shield className="h-4 w-4 text-yellow-600" />Private Notes</CardTitle>
                    </CardHeader>
                    <CardContent><p className="text-sm text-zinc-300 whitespace-pre-wrap">{profile.notes}</p></CardContent>
                  </Card>
                )}

                {/* Employee Link */}
                {linkedEmployee && (
                  <Card className="bg-zinc-900/50 border-zinc-800 mt-5">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold text-white flex items-center gap-2"><Link2 className="h-4 w-4 text-blue-400" />Linked Employee Profile</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Link href={`/hr/employee/${linkedEmployee.id}`}>
                        <div className="flex items-center gap-4 p-4 rounded-lg bg-zinc-800/40 border border-zinc-800 hover:border-blue-500/30 transition-colors cursor-pointer">
                          <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center"><Users className="h-6 w-6 text-blue-400" /></div>
                          <div>
                            <p className="text-sm font-medium text-white">{linkedEmployee.firstName} {linkedEmployee.lastName}</p>
                            <p className="text-xs text-zinc-400">{linkedEmployee.jobTitle} · {linkedEmployee.department || "No department"}</p>
                            <p className="text-xs text-zinc-500 mt-0.5">Hired {linkedEmployee.hireDate}</p>
                          </div>
                        </div>
                      </Link>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* ═══ MEETINGS TAB ═══ */}
              <TabsContent value="meetings">
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-yellow-600" />All Meetings
                      <Badge variant="outline" className="border-zinc-700 text-zinc-400 ml-auto">{profile.meetingCount}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {profile.meetings.length === 0 ? (
                      <p className="text-sm text-zinc-500 py-8 text-center">No meetings recorded with this contact</p>
                    ) : (
                      profile.meetings.map((mc: any) => {
                        const m = mc.meeting;
                        return (
                          <Link key={`all-meeting-${m.id}`} href={`/meeting/${m.id}`}>
                            <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-800/40 border border-zinc-800 hover:border-yellow-600/30 transition-colors cursor-pointer group">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white group-hover:text-yellow-500 transition-colors">{m.meetingTitle || "Untitled Meeting"}</p>
                                <p className="text-xs text-zinc-500 mt-1">{formatDate(m.meetingDate)} · {formatRelative(m.meetingDate)}</p>
                                {m.executiveSummary && <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{m.executiveSummary}</p>}
                              </div>
                              <Badge variant="outline" className="border-zinc-700 text-zinc-500 text-xs ml-4 flex-shrink-0">{m.sourceType}</Badge>
                            </div>
                          </Link>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ═══ DOCUMENTS TAB ═══ */}
              <TabsContent value="documents">
                <Card className="bg-zinc-900/50 border-zinc-800 mb-5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold text-white flex items-center gap-2"><Upload className="h-4 w-4 text-yellow-600" />Upload Document</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                      <div><Label className="text-zinc-500 text-xs">Document Title</Label>
                        <Input value={docTitle} onChange={e => setDocTitle(e.target.value)} placeholder="e.g. NCNDA - OmniScope" className="bg-zinc-800 border-zinc-700 text-white mt-1" /></div>
                      <div><Label className="text-zinc-500 text-xs">Category</Label>
                        <Select value={docCategory} onValueChange={setDocCategory}>
                          <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-zinc-900 border-zinc-700">
                            <SelectItem value="ncnda">NCNDA</SelectItem><SelectItem value="contract">Contract</SelectItem>
                            <SelectItem value="agreement">Agreement</SelectItem><SelectItem value="proposal">Proposal</SelectItem>
                            <SelectItem value="invoice">Invoice</SelectItem><SelectItem value="kyc">KYC</SelectItem>
                            <SelectItem value="compliance">Compliance</SelectItem><SelectItem value="correspondence">Correspondence</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select></div>
                      <div><Label className="text-zinc-500 text-xs">Notes (optional)</Label>
                        <Input value={docNotes} onChange={e => setDocNotes(e.target.value)} placeholder="Quick note" className="bg-zinc-800 border-zinc-700 text-white mt-1" /></div>
                    </div>
                    <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt,.csv" />
                    <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium">
                      {uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</> : <><Upload className="h-4 w-4 mr-2" />Choose File & Upload</>}
                    </Button>
                    <p className="text-xs text-zinc-600 mt-2">Max 10MB. Supported: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, TXT, CSV</p>
                  </CardContent>
                </Card>
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                      <FileText className="h-4 w-4 text-yellow-600" />All Documents
                      <Badge variant="outline" className="border-zinc-700 text-zinc-400 ml-auto">{documents.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {documents.length === 0 ? (
                      <p className="text-sm text-zinc-500 py-8 text-center">No documents uploaded yet.</p>
                    ) : (
                      documents.map((doc: any) => (
                        <div key={doc.id} className="flex items-center gap-3 p-4 rounded-lg bg-zinc-800/40 border border-zinc-800 group">
                          <div className="h-10 w-10 rounded-lg bg-yellow-600/10 flex items-center justify-center flex-shrink-0"><File className="h-5 w-5 text-yellow-500" /></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white">{doc.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs">{DOC_CATEGORY_LABELS[doc.category] || doc.category}</Badge>
                              <span className="text-xs text-zinc-500">{formatRelative(doc.createdAt)}</span>
                            </div>
                            {doc.notes && <p className="text-xs text-zinc-500 mt-1">{doc.notes}</p>}
                          </div>
                          <div className="flex items-center gap-1">
                            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-yellow-500 h-8 w-8 p-0"><Download className="h-4 w-4" /></Button>
                            </a>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"><Trash2 className="h-4 w-4" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-zinc-900 border-zinc-800">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-white">Delete Document</AlertDialogTitle>
                                  <AlertDialogDescription className="text-zinc-400">Delete "{doc.title}"? This cannot be undone.</AlertDialogDescription>
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
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ═══ NOTES TAB ═══ */}
              <TabsContent value="notes">
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-yellow-600" />Contact Notes
                      <Badge variant="outline" className="border-zinc-700 text-zinc-400 ml-auto">{selectedNotes.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2 mb-4">
                      <Textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a detailed note..."
                        className="bg-zinc-800 border-zinc-700 text-white text-sm min-h-[80px]" />
                    </div>
                    <Button size="sm" onClick={() => { if (newNote.trim()) addNoteMutation.mutate({ contactId: selectedId!, content: newNote.trim() }); }}
                      disabled={!newNote.trim() || addNoteMutation.isPending} className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium mb-4">
                      <Send className="h-4 w-4 mr-2" />Add Note
                    </Button>
                    <div className="space-y-3">
                      {selectedNotes.length === 0 ? (
                        <p className="text-sm text-zinc-500 py-8 text-center">No notes yet. Add your first note above.</p>
                      ) : (
                        selectedNotes.map((note: any) => (
                          <div key={note.id} className="p-4 rounded-lg bg-zinc-800/40 border border-zinc-800 group">
                            <p className="text-sm text-zinc-300 whitespace-pre-wrap">{note.content}</p>
                            <div className="flex items-center justify-between mt-3 pt-2 border-t border-zinc-800">
                              <span className="text-xs text-zinc-600">{note.createdByName} · {formatDate(note.createdAt)} ({formatRelative(note.createdAt)})</span>
                              <Button variant="ghost" size="sm" onClick={() => deleteNoteMutation.mutate({ id: note.id })}
                                className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ═══ EMAIL TAB ═══ */}
              <TabsContent value="email">
                <ContactEmailTab contact={selectedProfile} contactId={selectedId!} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══ CONTACT EMAIL TAB COMPONENT ═══ */
function ContactEmailTab({ contact, contactId }: { contact: any; contactId: number }) {
  const [composing, setComposing] = useState(false);
  const [composeData, setComposeData] = useState({ to: "", subject: "", body: "", cc: "" });
  const [expandedThread, setExpandedThread] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const contactEmail = contact?.email;

  // Check Gmail connection
  const { data: connectionStatus } = trpc.mail.connectionStatus.useQuery();
  const authUrlMutation = trpc.mail.getAuthUrl.useMutation();
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  
  useEffect(() => {
    if (connectionStatus?.connected === false && !authUrl) {
      authUrlMutation.mutateAsync({ origin: window.location.origin }).then(r => setAuthUrl(r.url)).catch(() => {});
    }
  }, [connectionStatus?.connected]);

  // Fetch emails for this contact
  const { data: emailThreads, isLoading: emailsLoading, refetch: refetchEmails } = trpc.mail.getByContact.useQuery(
    { contactEmail: contactEmail! },
    { enabled: !!contactEmail && connectionStatus?.connected === true }
  );

  // Get thread detail
  const { data: threadDetail, isLoading: threadLoading } = trpc.mail.getThread.useQuery(
    { threadId: expandedThread! },
    { enabled: !!expandedThread && connectionStatus?.connected === true }
  );

  // Send email mutation
  const sendMutation = trpc.mail.send.useMutation({
    onSuccess: () => {
      toast.success("Email sent");
      setComposing(false);
      setComposeData({ to: "", subject: "", body: "", cc: "" });
      refetchEmails();
    },
    onError: () => toast.error("Failed to send email"),
  });

  const handleCompose = () => {
    setComposeData({ to: contactEmail || "", subject: "", body: "", cc: "" });
    setComposing(true);
  };

  const handleSend = () => {
    if (!composeData.to || !composeData.subject) {
      toast.error("To and Subject are required");
      return;
    }
    sendMutation.mutate({
      to: composeData.to.split(',').map(e => e.trim()).filter(Boolean),
      subject: composeData.subject,
      body: composeData.body,
      cc: composeData.cc ? composeData.cc.split(',').map(e => e.trim()).filter(Boolean) : undefined,
    });
  };

  const formatEmailDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Not connected state
  if (!connectionStatus?.connected) {
    return (
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="py-12 text-center">
          <Mail className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Connect Gmail</h3>
          <p className="text-sm text-zinc-400 mb-6 max-w-sm mx-auto">
            Connect your Google account to view email history with this contact and send emails directly.
          </p>
          {authUrl ? (
            <a href={authUrl}>
              <Button className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium">
                <Mail className="h-4 w-4 mr-2" />Connect Google Account
              </Button>
            </a>
          ) : (
            <Button disabled className="bg-zinc-700 text-zinc-400">Loading...</Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // No email on file
  if (!contactEmail) {
    return (
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="py-12 text-center">
          <Mail className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Email Address</h3>
          <p className="text-sm text-zinc-400 mb-4">
            Add an email address to this contact to view email history and send messages.
          </p>
          <p className="text-xs text-zinc-500">Click "Edit" above to add an email address.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Compose Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-yellow-600" />
          <span className="text-sm font-medium text-white">Email with {contact?.name?.split(' ')[0]}</span>
          <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs">{contactEmail}</Badge>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => refetchEmails()} className="border-zinc-700 text-zinc-400 hover:text-white h-8">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" onClick={handleCompose} className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium h-8">
            <Send className="h-3.5 w-3.5 mr-1.5" />Compose
          </Button>
        </div>
      </div>

      {/* Compose Drawer */}
      {composing && (
        <Card className="bg-zinc-900 border-yellow-600/30">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-yellow-500">New Email</span>
              <Button variant="ghost" size="sm" onClick={() => setComposing(false)} className="text-zinc-400 hover:text-white h-6 w-6 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              <Input value={composeData.to} onChange={e => setComposeData(d => ({ ...d, to: e.target.value }))} placeholder="To" className="bg-zinc-800 border-zinc-700 text-white text-sm h-9" />
              <Input value={composeData.cc} onChange={e => setComposeData(d => ({ ...d, cc: e.target.value }))} placeholder="Cc (optional)" className="bg-zinc-800 border-zinc-700 text-white text-sm h-9" />
              <Input value={composeData.subject} onChange={e => setComposeData(d => ({ ...d, subject: e.target.value }))} placeholder="Subject" className="bg-zinc-800 border-zinc-700 text-white text-sm h-9" />
              <Textarea value={composeData.body} onChange={e => setComposeData(d => ({ ...d, body: e.target.value }))} placeholder="Write your message..." className="bg-zinc-800 border-zinc-700 text-white text-sm min-h-[120px]" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setComposing(false)} className="border-zinc-700 text-zinc-400">Cancel</Button>
              <Button size="sm" onClick={handleSend} disabled={sendMutation.isPending} className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium">
                {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                Send
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Thread List */}
      {emailsLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-20 bg-zinc-800" />)}
        </div>
      ) : !emailThreads?.threads?.length ? (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="py-8 text-center">
            <Mail className="h-8 w-8 text-zinc-600 mx-auto mb-3" />
            <p className="text-sm text-zinc-400">No email history with {contact?.name?.split(' ')[0]}.</p>
            <Button size="sm" onClick={handleCompose} className="mt-3 bg-yellow-600 hover:bg-yellow-700 text-black font-medium">
              <Send className="h-3.5 w-3.5 mr-1.5" />Send First Email
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {emailThreads.threads.map((thread: any) => (
            <div key={thread.threadId}>
              <button
                onClick={() => setExpandedThread(expandedThread === thread.threadId ? null : thread.threadId)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  expandedThread === thread.threadId
                    ? 'bg-zinc-800 border-yellow-600/30'
                    : thread.isUnread
                      ? 'bg-zinc-900/80 border-zinc-700 hover:border-zinc-600'
                      : 'bg-zinc-900/30 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm truncate ${thread.isUnread ? 'font-semibold text-white' : 'text-zinc-300'}`}>
                        {thread.subject || '(no subject)'}
                      </span>
                      {thread.messageCount > 1 && (
                        <Badge variant="outline" className="border-zinc-700 text-zinc-500 text-[10px] px-1.5 py-0 shrink-0">{thread.messageCount}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 truncate mt-1">{thread.snippet}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-zinc-500">{formatEmailDate(thread.date)}</span>
                    {expandedThread === thread.threadId ? <ChevronUp className="h-3.5 w-3.5 text-zinc-500" /> : <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />}
                  </div>
                </div>
              </button>

              {/* Expanded Thread Detail */}
              {expandedThread === thread.threadId && (
                <div className="mt-2 ml-3 pl-3 border-l-2 border-yellow-600/20 space-y-3">
                  {threadLoading ? (
                    <div className="py-4 flex items-center gap-2 text-zinc-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Loading messages...</span>
                    </div>
                  ) : threadDetail?.messages?.map((msg: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-800">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-yellow-600 to-amber-700 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-black">{(msg.from || '?')[0].toUpperCase()}</span>
                          </div>
                          <span className="text-xs font-medium text-white">{msg.from}</span>
                        </div>
                        <span className="text-[10px] text-zinc-500">{new Date(msg.date).toLocaleString()}</span>
                      </div>
                      <div className="text-sm text-zinc-300 whitespace-pre-wrap break-words leading-relaxed">
                        {msg.bodyText || msg.snippet || '(empty message)'}
                      </div>
                      {msg.to && (
                        <div className="mt-2 pt-2 border-t border-zinc-800">
                          <span className="text-[10px] text-zinc-600">To: {msg.to}</span>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Quick Reply */}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => {
                      const lastMsg = threadDetail?.messages?.[threadDetail.messages.length - 1];
                      setComposeData({
                        to: lastMsg?.from || contactEmail,
                        subject: `Re: ${thread.subject || ''}`,
                        body: '',
                        cc: '',
                      });
                      setComposing(true);
                    }} className="border-zinc-700 text-zinc-400 hover:text-white h-7 text-xs">
                      <ArrowLeft className="h-3 w-3 mr-1" />Reply
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
