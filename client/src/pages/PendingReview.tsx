import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  UserPlus, Building2, Brain, Check, X, Search,
  ChevronDown, ChevronUp, GitMerge, Loader2,
  Sparkles, Link2, Briefcase,
  CheckSquare, Square, Minus, Shield, Clock,
  ArrowUpDown, MoreHorizontal, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type SortField = "name" | "source" | "date";
type SortDir = "asc" | "desc";
type ReviewTab = "contacts" | "companies" | "suggestions";

// ─── Avatar Helper ──────────────────────────────────────────────────────
function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

const avatarColors = [
  "from-amber-600 to-yellow-700",
  "from-emerald-600 to-teal-700",
  "from-blue-600 to-indigo-700",
  "from-violet-600 to-purple-700",
  "from-rose-600 to-pink-700",
  "from-cyan-600 to-sky-700",
  "from-orange-600 to-red-700",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

// ─── Inline Merge Panel ──────────────────────────────────────────────────
function InlineMergePanel({
  item,
  type,
  onMerge,
  onCancel,
}: {
  item: any;
  type: "contact" | "company";
  onMerge: (pendingId: number, mergeIntoId: number) => void;
  onCancel: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: contactDuplicates } = trpc.triage.findDuplicatesFor.useQuery(
    { contactId: item.id },
    { enabled: type === "contact" }
  );
  const { data: companyDuplicates } = trpc.triage.findCompanyDuplicatesFor.useQuery(
    { companyId: item.id },
    { enabled: type === "company" }
  );
  const duplicates = type === "contact" ? contactDuplicates : companyDuplicates;
  const hasDuplicates = duplicates && duplicates.length > 0;

  const { data: allContacts } = trpc.contacts.list.useQuery(undefined, { enabled: type === "contact" });
  const { data: allCompanies } = trpc.companies.list.useQuery(undefined, { enabled: type === "company" });

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    if (type === "contact") {
      if (!allContacts) return [];
      return (allContacts as any[])
        .filter((c: any) => c.approvalStatus === "approved" && c.id !== item.id)
        .filter((c: any) =>
          c.name.toLowerCase().includes(q) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.organization && c.organization.toLowerCase().includes(q))
        )
        .slice(0, 6);
    } else {
      if (!allCompanies) return [];
      return (allCompanies as any[])
        .filter((c: any) => c.approvalStatus === "approved" && c.id !== item.id)
        .filter((c: any) =>
          c.name.toLowerCase().includes(q) ||
          (c.domain && c.domain.toLowerCase().includes(q))
        )
        .slice(0, 6);
    }
  }, [allContacts, allCompanies, searchQuery, item.id, type]);

  const confidenceColor = (conf: number) => {
    if (conf >= 80) return "text-red-400 bg-red-950/40 border-red-900/40";
    if (conf >= 60) return "text-yellow-400 bg-yellow-950/40 border-yellow-900/40";
    return "text-zinc-400 bg-zinc-800/40 border-zinc-700/40";
  };

  return (
    <div className="col-span-full bg-zinc-950/80 border-t border-b border-yellow-900/20 px-5 py-4 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-yellow-600/20 flex items-center justify-center">
            <GitMerge className="h-3 w-3 text-yellow-500" />
          </div>
          <span className="text-xs font-medium text-zinc-300">
            Merge <span className="text-yellow-400">"{item.name}"</span> into an existing {type}
          </span>
        </div>
        <button onClick={onCancel} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors px-2 py-1 rounded hover:bg-zinc-800/50">
          Cancel
        </button>
      </div>

      {hasDuplicates && (
        <div className="mb-3">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2 font-medium">Possible Matches</p>
          <div className="space-y-1.5">
            {duplicates!.map((d: any, idx: number) => {
              const target = d.contact || d.company;
              return (
                <div
                  key={target?.id || idx}
                  className="flex items-center justify-between gap-3 bg-zinc-900/60 border border-zinc-800/40 rounded-lg px-4 py-2.5 hover:border-yellow-800/30 transition-all cursor-pointer group"
                  onClick={() => onMerge(item.id, target?.id)}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${getAvatarColor(target?.name || "")} flex items-center justify-center shrink-0`}>
                      <span className="text-[10px] font-bold text-white">{getInitials(target?.name || "?")}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-zinc-200 truncate">{target?.name}</p>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                        {type === "contact" && target?.organization && <span>{target.organization}</span>}
                        {type === "contact" && target?.email && <span className="truncate">{target.email}</span>}
                        {type === "company" && target?.domain && <span>{target.domain}</span>}
                        {d.reason && <span className="italic text-zinc-600">{d.reason}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${confidenceColor(d.confidence)}`}>
                      {d.confidence}%
                    </span>
                    <span className="text-xs text-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap font-medium">
                      Merge →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600" />
          <input
            type="text"
            placeholder={`Search approved ${type === "contact" ? "contacts" : "companies"} to merge into...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900/60 border border-zinc-800/40 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-yellow-800/40 transition-colors"
            autoFocus
          />
        </div>
        {searchQuery.trim() && searchResults.length > 0 && (
          <div className="space-y-1.5 mt-2 max-h-36 overflow-y-auto">
            {searchResults.map((c: any) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 bg-zinc-900/60 border border-zinc-800/40 rounded-lg px-4 py-2.5 hover:border-yellow-800/30 transition-all cursor-pointer group"
                onClick={() => onMerge(item.id, c.id)}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${getAvatarColor(c.name || "")} flex items-center justify-center shrink-0`}>
                    <span className="text-[10px] font-bold text-white">{getInitials(c.name || "?")}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-200 truncate">{c.name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                      {c.organization && <span>{c.organization}</span>}
                      {c.email && <span className="truncate">{c.email}</span>}
                      {c.domain && <span>{c.domain}</span>}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap font-medium">
                  Merge into this
                </span>
              </div>
            ))}
          </div>
        )}
        {searchQuery.trim() && searchResults.length === 0 && (
          <p className="text-xs text-zinc-600 text-center py-3 mt-1">No matching {type === "contact" ? "contacts" : "companies"} found</p>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────
export default function PendingReview() {
  const [activeTab, setActiveTab] = useState<ReviewTab>("contacts");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedContacts, setSelectedContacts] = useState<Set<number>>(new Set());
  const [selectedCompanies, setSelectedCompanies] = useState<Set<number>>(new Set());
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [mergeContactId, setMergeContactId] = useState<number | null>(null);
  const [mergeCompanyId, setMergeCompanyId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  // Data queries
  const { data: allContacts, isLoading: loadingContacts } = trpc.contacts.list.useQuery();
  const { data: allCompanies, isLoading: loadingCompanies } = trpc.companies.list.useQuery({ status: "pending" });
  const { data: suggestions, isLoading: loadingSuggestions } = trpc.contacts.pendingSuggestions.useQuery({ status: "pending" });

  // Mutations
  const approveContactMutation = trpc.triage.approveContact.useMutation({
    onSuccess: () => { utils.contacts.list.invalidate(); utils.triage.feed.invalidate(); },
  });
  const rejectContactMutation = trpc.triage.rejectContact.useMutation({
    onSuccess: () => { utils.contacts.list.invalidate(); utils.triage.feed.invalidate(); },
  });
  const bulkApproveContactsMutation = trpc.contacts.bulkApprove.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.approved} contacts approved`);
      setSelectedContacts(new Set());
      utils.contacts.list.invalidate();
      utils.triage.feed.invalidate();
    },
  });
  const bulkRejectContactsMutation = trpc.contacts.bulkReject.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.rejected} contacts rejected`);
      setSelectedContacts(new Set());
      utils.contacts.list.invalidate();
      utils.triage.feed.invalidate();
    },
  });
  const approveCompanyMutation = trpc.triage.approveCompany.useMutation({
    onSuccess: () => { utils.companies.list.invalidate(); utils.triage.feed.invalidate(); },
  });
  const rejectCompanyMutation = trpc.triage.rejectCompany.useMutation({
    onSuccess: () => { utils.companies.list.invalidate(); utils.triage.feed.invalidate(); },
  });
  const bulkApproveCompaniesMutation = trpc.triage.bulkApproveCompanies.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.approved} companies approved`);
      setSelectedCompanies(new Set());
      utils.companies.list.invalidate();
      utils.triage.feed.invalidate();
    },
  });
  const bulkRejectCompaniesMutation = trpc.triage.bulkRejectCompanies.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.rejected} companies rejected`);
      setSelectedCompanies(new Set());
      utils.companies.list.invalidate();
      utils.triage.feed.invalidate();
    },
  });
  const approveSuggestionMutation = trpc.contacts.approveSuggestion.useMutation({
    onSuccess: () => { utils.contacts.pendingSuggestions.invalidate(); utils.triage.feed.invalidate(); },
  });
  const rejectSuggestionMutation = trpc.contacts.rejectSuggestion.useMutation({
    onSuccess: () => { utils.contacts.pendingSuggestions.invalidate(); utils.triage.feed.invalidate(); },
  });
  const bulkApproveSuggestionsMutation = trpc.contacts.bulkApproveSuggestions.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.approved} suggestions approved`);
      setSelectedSuggestions(new Set());
      utils.contacts.pendingSuggestions.invalidate();
      utils.triage.feed.invalidate();
    },
  });
  const bulkRejectSuggestionsMutation = trpc.contacts.bulkRejectSuggestions.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.rejected} suggestions dismissed`);
      setSelectedSuggestions(new Set());
      utils.contacts.pendingSuggestions.invalidate();
      utils.triage.feed.invalidate();
    },
  });

  // Merge mutations
  const mergeContactMutation = trpc.triage.mergeAndApprove.useMutation({
    onSuccess: (data) => {
      toast.success(`Merged into ${data.mergedInto}`);
      setMergeContactId(null);
      utils.contacts.list.invalidate();
      utils.triage.feed.invalidate();
    },
    onError: () => toast.error("Could not merge contact"),
  });
  const mergeCompanyMutation = trpc.triage.mergeCompany.useMutation({
    onSuccess: (data) => {
      toast.success(`Merged into ${data.mergedInto}`);
      setMergeCompanyId(null);
      utils.companies.list.invalidate();
      utils.triage.feed.invalidate();
    },
    onError: () => toast.error("Could not merge company"),
  });

  // Undo helpers
  function showUndoToast(type: string, ids: number[], action: string, undoFn: () => void) {
    const toastId = toast(`${action} ${ids.length} ${type}`, {
      description: "Click Undo to reverse this action",
      action: {
        label: "Undo",
        onClick: () => {
          undoFn();
          toast.dismiss(toastId);
        },
      },
      duration: 5000,
    });
  }

  function handleApproveContact(id: number) {
    approveContactMutation.mutate({ contactId: id });
    showUndoToast("contact", [id], "Approved", () => {
      rejectContactMutation.mutate({ contactId: id });
    });
  }

  function handleRejectContact(id: number) {
    rejectContactMutation.mutate({ contactId: id });
    showUndoToast("contact", [id], "Rejected", () => {
      approveContactMutation.mutate({ contactId: id });
    });
  }

  function handleApproveCompany(id: number) {
    approveCompanyMutation.mutate({ companyId: id });
    showUndoToast("company", [id], "Approved", () => {
      rejectCompanyMutation.mutate({ companyId: id });
    });
  }

  function handleRejectCompany(id: number) {
    rejectCompanyMutation.mutate({ companyId: id });
    showUndoToast("company", [id], "Rejected", () => {
      approveCompanyMutation.mutate({ companyId: id });
    });
  }

  function handleApproveSuggestion(id: number) {
    approveSuggestionMutation.mutate({ id });
    toast.success("Suggestion approved");
  }

  function handleRejectSuggestion(id: number) {
    rejectSuggestionMutation.mutate({ id });
    toast.success("Suggestion dismissed");
  }

  // Filter pending contacts
  const pendingContacts = useMemo(() => {
    if (!allContacts) return [];
    let filtered = allContacts.filter((c: any) => c.approvalStatus === "pending");
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((c: any) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.organization || "").toLowerCase().includes(q)
      );
    }
    filtered.sort((a: any, b: any) => {
      if (sortField === "name") {
        const cmp = (a.name || "").localeCompare(b.name || "");
        return sortDir === "asc" ? cmp : -cmp;
      }
      if (sortField === "source") {
        const cmp = (a.source || "").localeCompare(b.source || "");
        return sortDir === "asc" ? cmp : -cmp;
      }
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return sortDir === "asc" ? dateA - dateB : dateB - dateA;
    });
    return filtered;
  }, [allContacts, searchQuery, sortField, sortDir]);

  // Filter pending companies
  const pendingCompanies = useMemo(() => {
    if (!allCompanies) return [];
    let filtered = allCompanies.filter((c: any) => c.approvalStatus === "pending");
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((c: any) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.sector || "").toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [allCompanies, searchQuery]);

  // Filter suggestions
  const pendingSuggestions = useMemo(() => {
    if (!suggestions) return [];
    if (!searchQuery) return suggestions;
    const q = searchQuery.toLowerCase();
    return suggestions.filter((s: any) =>
      (s.contactName || "").toLowerCase().includes(q) ||
      (s.companyName || "").toLowerCase().includes(q) ||
      (s.type || "").toLowerCase().includes(q)
    );
  }, [suggestions, searchQuery]);

  const tabCounts = {
    contacts: pendingContacts.length,
    companies: pendingCompanies.length,
    suggestions: pendingSuggestions.length,
  };

  const totalPending = tabCounts.contacts + tabCounts.companies + tabCounts.suggestions;

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-zinc-700" />;
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3 text-yellow-500" />
      : <ChevronDown className="h-3 w-3 text-yellow-500" />;
  }

  function toggleSelectAll(type: ReviewTab) {
    if (type === "contacts") {
      if (selectedContacts.size === pendingContacts.length) {
        setSelectedContacts(new Set());
      } else {
        setSelectedContacts(new Set(pendingContacts.map((c: any) => c.id)));
      }
    } else if (type === "companies") {
      if (selectedCompanies.size === pendingCompanies.length) {
        setSelectedCompanies(new Set());
      } else {
        setSelectedCompanies(new Set(pendingCompanies.map((c: any) => c.id)));
      }
    } else {
      if (selectedSuggestions.size === pendingSuggestions.length) {
        setSelectedSuggestions(new Set());
      } else {
        setSelectedSuggestions(new Set(pendingSuggestions.map((s: any) => s.id)));
      }
    }
  }

  function SelectAllCheckbox({ type, count, selected }: { type: ReviewTab; count: number; selected: number }) {
    const allSelected = count > 0 && selected === count;
    const someSelected = selected > 0 && selected < count;
    return (
      <button onClick={() => toggleSelectAll(type)} className="p-0.5 rounded hover:bg-zinc-800/50 transition-colors">
        {allSelected ? (
          <CheckSquare className="h-4 w-4 text-yellow-500" />
        ) : someSelected ? (
          <Minus className="h-4 w-4 text-yellow-500/60" />
        ) : (
          <Square className="h-4 w-4 text-zinc-700" />
        )}
      </button>
    );
  }

  const isLoading = loadingContacts || loadingCompanies || loadingSuggestions;

  const selectedCount = activeTab === "contacts" ? selectedContacts.size
    : activeTab === "companies" ? selectedCompanies.size
    : selectedSuggestions.size;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-full flex flex-col">
        {/* ─── Header ─── */}
        <div className="shrink-0 px-6 pt-5 pb-4 border-b border-zinc-800/40">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-yellow-600/20 to-amber-600/10 border border-yellow-800/20 flex items-center justify-center">
                <Shield className="h-4.5 w-4.5 text-yellow-500" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-zinc-100 tracking-tight">Pending Review</h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {totalPending > 0 ? `${totalPending} items awaiting your review` : "All caught up — no pending items"}
                </p>
              </div>
            </div>
            {totalPending > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-600/10 border border-yellow-800/20">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                <span className="text-[10px] font-medium text-yellow-400">{totalPending} pending</span>
              </div>
            )}
          </div>

          {/* Search + Tabs */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600" />
              <Input
                placeholder="Search pending items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 bg-zinc-900/40 border-zinc-800/40 text-sm placeholder:text-zinc-600 focus:border-yellow-800/40"
              />
            </div>
            <div className="flex items-center bg-zinc-900/40 border border-zinc-800/30 rounded-lg p-0.5">
              {(["contacts", "companies", "suggestions"] as ReviewTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    activeTab === tab
                      ? "bg-zinc-800/80 text-zinc-100 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {tab === "contacts" ? "People" : tab === "companies" ? "Companies" : "Suggestions"}
                  {tabCounts[tab] > 0 && (
                    <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      activeTab === tab ? "bg-yellow-600/20 text-yellow-400" : "bg-zinc-800 text-zinc-500"
                    }`}>
                      {tabCounts[tab]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Bulk Action Bar ─── */}
        {selectedCount > 0 && (
          <div className="shrink-0 flex items-center gap-3 bg-yellow-950/15 border-b border-yellow-800/20 px-6 py-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
            <span className="text-xs text-yellow-400 font-medium">{selectedCount} selected</span>
            <div className="flex-1" />
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs bg-emerald-950/20 border-emerald-800/30 text-emerald-400 hover:bg-emerald-950/40 hover:text-emerald-300"
              onClick={() => {
                if (activeTab === "contacts") {
                  const ids = Array.from(selectedContacts);
                  bulkApproveContactsMutation.mutate({ ids });
                  showUndoToast("contacts", ids, "Approved", () => bulkRejectContactsMutation.mutate({ ids }));
                } else if (activeTab === "companies") {
                  const ids = Array.from(selectedCompanies);
                  bulkApproveCompaniesMutation.mutate({ ids });
                  showUndoToast("companies", ids, "Approved", () => bulkRejectCompaniesMutation.mutate({ ids }));
                } else {
                  const ids = Array.from(selectedSuggestions);
                  bulkApproveSuggestionsMutation.mutate({ ids });
                }
              }}
              disabled={bulkApproveContactsMutation.isPending || bulkApproveCompaniesMutation.isPending || bulkApproveSuggestionsMutation.isPending}
            >
              <Check className="h-3 w-3 mr-1" /> Approve All
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs bg-red-950/20 border-red-800/30 text-red-400 hover:bg-red-950/40 hover:text-red-300"
              onClick={() => {
                if (activeTab === "contacts") {
                  const ids = Array.from(selectedContacts);
                  bulkRejectContactsMutation.mutate({ ids });
                  showUndoToast("contacts", ids, "Rejected", () => bulkApproveContactsMutation.mutate({ ids }));
                } else if (activeTab === "companies") {
                  const ids = Array.from(selectedCompanies);
                  bulkRejectCompaniesMutation.mutate({ ids });
                  showUndoToast("companies", ids, "Rejected", () => bulkApproveCompaniesMutation.mutate({ ids }));
                } else {
                  const ids = Array.from(selectedSuggestions);
                  bulkRejectSuggestionsMutation.mutate({ ids });
                }
              }}
              disabled={bulkRejectContactsMutation.isPending || bulkRejectCompaniesMutation.isPending || bulkRejectSuggestionsMutation.isPending}
            >
              <X className="h-3 w-3 mr-1" /> Reject All
            </Button>
          </div>
        )}

        {/* ─── Content ─── */}
        <ScrollArea className="flex-1">
          <div className="px-6 py-4">
            {/* Loading */}
            {isLoading && (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-yellow-500/40" />
                  <span className="text-xs text-zinc-600">Loading pending items...</span>
                </div>
              </div>
            )}

            {/* ── CONTACTS TAB ── */}
            {activeTab === "contacts" && !isLoading && (
              <div className="border border-zinc-800/30 rounded-xl overflow-hidden bg-zinc-900/20">
                {/* Table header */}
                <div className="grid grid-cols-[40px_1.2fr_1fr_100px_90px_110px] gap-3 px-5 py-2.5 bg-zinc-900/40 border-b border-zinc-800/30">
                  <div className="flex items-center">
                    <SelectAllCheckbox type="contacts" count={pendingContacts.length} selected={selectedContacts.size} />
                  </div>
                  <button onClick={() => toggleSort("name")} className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500 font-medium hover:text-zinc-300 transition-colors">
                    Name <SortIcon field="name" />
                  </button>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Details</div>
                  <button onClick={() => toggleSort("source")} className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500 font-medium hover:text-zinc-300 transition-colors">
                    Source <SortIcon field="source" />
                  </button>
                  <button onClick={() => toggleSort("date")} className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500 font-medium hover:text-zinc-300 transition-colors">
                    Added <SortIcon field="date" />
                  </button>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-medium text-right">Actions</div>
                </div>

                {pendingContacts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-zinc-700">
                    <div className="w-12 h-12 rounded-full bg-zinc-900/60 flex items-center justify-center mb-3">
                      <UserPlus className="h-5 w-5 opacity-40" />
                    </div>
                    <p className="text-sm font-medium text-zinc-600">No pending contacts</p>
                    <p className="text-xs text-zinc-700 mt-1">New contacts from meetings will appear here</p>
                  </div>
                ) : (
                  pendingContacts.map((c: any) => (
                    <div key={c.id}>
                      <div
                        className={`grid grid-cols-[40px_1.2fr_1fr_100px_90px_110px] gap-3 px-5 py-3 border-b border-zinc-800/20 hover:bg-zinc-800/20 transition-all items-center group ${
                          selectedContacts.has(c.id) ? "bg-yellow-950/10" : ""
                        }`}
                      >
                        <div>
                          <button
                            onClick={() => {
                              const next = new Set(selectedContacts);
                              next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                              setSelectedContacts(next);
                            }}
                            className="p-0.5"
                          >
                            {selectedContacts.has(c.id)
                              ? <CheckSquare className="h-4 w-4 text-yellow-500" />
                              : <Square className="h-4 w-4 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
                            }
                          </button>
                        </div>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(c.name || "")} flex items-center justify-center shrink-0`}>
                            <span className="text-[10px] font-bold text-white">{getInitials(c.name || "?")}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-zinc-200 truncate font-medium">{c.name}</p>
                            {c.email && <p className="text-[11px] text-zinc-500 truncate">{c.email}</p>}
                          </div>
                        </div>
                        <div className="min-w-0">
                          {c.organization && (
                            <span className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                              <Building2 className="h-3 w-3 text-zinc-600 shrink-0" /> <span className="truncate">{c.organization}</span>
                            </span>
                          )}
                          {c.title && <span className="text-[11px] text-zinc-600 block truncate">{c.title}</span>}
                        </div>
                        <div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800/60 border border-zinc-700/30 text-zinc-500 font-medium">
                            {c.source || "unknown"}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-600">
                          {c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                        </div>
                        <div className="flex items-center justify-end gap-0.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleApproveContact(c.id)}
                                disabled={approveContactMutation.isPending}
                                className="p-1.5 rounded-md hover:bg-emerald-950/40 text-zinc-600 hover:text-emerald-400 transition-colors"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">Approve</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => setMergeContactId(mergeContactId === c.id ? null : c.id)}
                                className={`p-1.5 rounded-md transition-colors ${
                                  mergeContactId === c.id
                                    ? "bg-yellow-950/40 text-yellow-400"
                                    : "text-zinc-600 hover:bg-yellow-950/30 hover:text-yellow-400"
                                }`}
                              >
                                <GitMerge className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">Merge with existing</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleRejectContact(c.id)}
                                disabled={rejectContactMutation.isPending}
                                className="p-1.5 rounded-md hover:bg-red-950/40 text-zinc-600 hover:text-red-400 transition-colors"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">Reject</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                      {mergeContactId === c.id && (
                        <InlineMergePanel
                          item={c}
                          type="contact"
                          onMerge={(pendingId, mergeIntoId) => {
                            mergeContactMutation.mutate({ pendingId, mergeIntoId });
                          }}
                          onCancel={() => setMergeContactId(null)}
                        />
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── COMPANIES TAB ── */}
            {activeTab === "companies" && !isLoading && (
              <div className="border border-zinc-800/30 rounded-xl overflow-hidden bg-zinc-900/20">
                <div className="grid grid-cols-[40px_1.2fr_1fr_100px_110px] gap-3 px-5 py-2.5 bg-zinc-900/40 border-b border-zinc-800/30">
                  <div className="flex items-center">
                    <SelectAllCheckbox type="companies" count={pendingCompanies.length} selected={selectedCompanies.size} />
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Company</div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Sector</div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Source</div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-medium text-right">Actions</div>
                </div>

                {pendingCompanies.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-zinc-700">
                    <div className="w-12 h-12 rounded-full bg-zinc-900/60 flex items-center justify-center mb-3">
                      <Building2 className="h-5 w-5 opacity-40" />
                    </div>
                    <p className="text-sm font-medium text-zinc-600">No pending companies</p>
                    <p className="text-xs text-zinc-700 mt-1">New companies from meetings will appear here</p>
                  </div>
                ) : (
                  pendingCompanies.map((c: any) => (
                    <div key={c.id}>
                      <div
                        className={`grid grid-cols-[40px_1.2fr_1fr_100px_110px] gap-3 px-5 py-3 border-b border-zinc-800/20 hover:bg-zinc-800/20 transition-all items-center group ${
                          selectedCompanies.has(c.id) ? "bg-yellow-950/10" : ""
                        }`}
                      >
                        <div>
                          <button
                            onClick={() => {
                              const next = new Set(selectedCompanies);
                              next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                              setSelectedCompanies(next);
                            }}
                            className="p-0.5"
                          >
                            {selectedCompanies.has(c.id)
                              ? <CheckSquare className="h-4 w-4 text-yellow-500" />
                              : <Square className="h-4 w-4 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
                            }
                          </button>
                        </div>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getAvatarColor(c.name || "")} flex items-center justify-center shrink-0`}>
                            <span className="text-[10px] font-bold text-white">{getInitials(c.name || "?")}</span>
                          </div>
                          <p className="text-sm text-zinc-200 truncate font-medium">{c.name}</p>
                        </div>
                        <div className="min-w-0">
                          {c.sector ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800/60 border border-zinc-700/30 text-zinc-400 font-medium">{c.sector}</span>
                          ) : (
                            <span className="text-[11px] text-zinc-700">—</span>
                          )}
                        </div>
                        <div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800/60 border border-zinc-700/30 text-zinc-500 font-medium">
                            {c.source || "meeting"}
                          </span>
                        </div>
                        <div className="flex items-center justify-end gap-0.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleApproveCompany(c.id)}
                                disabled={approveCompanyMutation.isPending}
                                className="p-1.5 rounded-md hover:bg-emerald-950/40 text-zinc-600 hover:text-emerald-400 transition-colors"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">Approve</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => setMergeCompanyId(mergeCompanyId === c.id ? null : c.id)}
                                className={`p-1.5 rounded-md transition-colors ${
                                  mergeCompanyId === c.id
                                    ? "bg-yellow-950/40 text-yellow-400"
                                    : "text-zinc-600 hover:bg-yellow-950/30 hover:text-yellow-400"
                                }`}
                              >
                                <GitMerge className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">Merge with existing</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleRejectCompany(c.id)}
                                disabled={rejectCompanyMutation.isPending}
                                className="p-1.5 rounded-md hover:bg-red-950/40 text-zinc-600 hover:text-red-400 transition-colors"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">Reject</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                      {mergeCompanyId === c.id && (
                        <InlineMergePanel
                          item={c}
                          type="company"
                          onMerge={(pendingId, mergeIntoId) => {
                            mergeCompanyMutation.mutate({ pendingId, mergeIntoId });
                          }}
                          onCancel={() => setMergeCompanyId(null)}
                        />
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── SUGGESTIONS TAB ── */}
            {activeTab === "suggestions" && !isLoading && (
              <div className="border border-zinc-800/30 rounded-xl overflow-hidden bg-zinc-900/20">
                <div className="grid grid-cols-[40px_1fr_1.5fr_90px_70px_100px] gap-3 px-5 py-2.5 bg-zinc-900/40 border-b border-zinc-800/30">
                  <div className="flex items-center">
                    <SelectAllCheckbox type="suggestions" count={pendingSuggestions.length} selected={selectedSuggestions.size} />
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Type</div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Details</div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Confidence</div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-medium">Source</div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-medium text-right">Actions</div>
                </div>

                {pendingSuggestions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-zinc-700">
                    <div className="w-12 h-12 rounded-full bg-zinc-900/60 flex items-center justify-center mb-3">
                      <Brain className="h-5 w-5 opacity-40" />
                    </div>
                    <p className="text-sm font-medium text-zinc-600">No pending suggestions</p>
                    <p className="text-xs text-zinc-700 mt-1">AI-generated suggestions will appear here</p>
                  </div>
                ) : (
                  pendingSuggestions.map((s: any) => {
                    const typeConfig: Record<string, { icon: any; label: string; color: string; bg: string }> = {
                      company_link: { icon: Link2, label: "Company Link", color: "text-blue-400", bg: "bg-blue-950/30 border-blue-900/30" },
                      enrichment: { icon: Sparkles, label: "Enrichment", color: "text-violet-400", bg: "bg-violet-950/30 border-violet-900/30" },
                      company_enrichment: { icon: Briefcase, label: "Company Data", color: "text-amber-400", bg: "bg-amber-950/30 border-amber-900/30" },
                    };
                    const cfg = typeConfig[s.type] || { icon: Brain, label: s.type, color: "text-zinc-400", bg: "bg-zinc-800/40 border-zinc-700/30" };
                    const Icon = cfg.icon;

                    let details = "";
                    if (s.type === "company_link") {
                      details = `Link ${s.contactName || "contact"} → ${s.suggestedCompanyName || "company"}`;
                    } else if (s.type === "enrichment") {
                      const data = typeof s.suggestedData === "string" ? JSON.parse(s.suggestedData) : s.suggestedData;
                      details = data ? Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(", ") : "AI enrichment";
                    } else if (s.type === "company_enrichment") {
                      const data = typeof s.suggestedData === "string" ? JSON.parse(s.suggestedData) : s.suggestedData;
                      details = data ? Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(", ") : "Company data";
                    }

                    return (
                      <div
                        key={s.id}
                        className={`grid grid-cols-[40px_1fr_1.5fr_90px_70px_100px] gap-3 px-5 py-3 border-b border-zinc-800/20 hover:bg-zinc-800/20 transition-all items-center group ${
                          selectedSuggestions.has(s.id) ? "bg-yellow-950/10" : ""
                        }`}
                      >
                        <div>
                          <button
                            onClick={() => {
                              const next = new Set(selectedSuggestions);
                              next.has(s.id) ? next.delete(s.id) : next.add(s.id);
                              setSelectedSuggestions(next);
                            }}
                            className="p-0.5"
                          >
                            {selectedSuggestions.has(s.id)
                              ? <CheckSquare className="h-4 w-4 text-yellow-500" />
                              : <Square className="h-4 w-4 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
                            }
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded flex items-center justify-center border ${cfg.bg}`}>
                            <Icon className={`h-3 w-3 ${cfg.color}`} />
                          </div>
                          <span className="text-xs text-zinc-300 font-medium">{cfg.label}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] text-zinc-400 truncate">{details}</p>
                        </div>
                        <div>
                          {s.confidence != null && (
                            <div className="flex items-center gap-1.5">
                              <div className="w-10 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    s.confidence >= 80 ? "bg-emerald-500" : s.confidence >= 50 ? "bg-yellow-500" : "bg-red-500"
                                  }`}
                                  style={{ width: `${s.confidence}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-zinc-500 font-medium">{s.confidence}%</span>
                            </div>
                          )}
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-600">{s.source || "AI"}</span>
                        </div>
                        <div className="flex items-center justify-end gap-0.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleApproveSuggestion(s.id)}
                                disabled={approveSuggestionMutation.isPending}
                                className="p-1.5 rounded-md hover:bg-emerald-950/40 text-zinc-600 hover:text-emerald-400 transition-colors"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">Approve</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleRejectSuggestion(s.id)}
                                disabled={rejectSuggestionMutation.isPending}
                                className="p-1.5 rounded-md hover:bg-red-950/40 text-zinc-600 hover:text-red-400 transition-colors"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">Dismiss</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
}
