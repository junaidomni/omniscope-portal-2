import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  FileText, Search, Plus, FolderOpen, Star, Clock, Filter,
  ChevronRight, Upload, File, Grid3X3, List, MoreHorizontal,
  Building2, User, Calendar, Tag, Eye, Download, Trash2,
  Edit3, Link2, Sparkles, FolderPlus, ArrowLeft, Archive,
  Loader2, X, Check, Globe, Lock, Users, Shield,
  FileSpreadsheet, Presentation, FilePlus, Send, Bookmark,
  HardDrive, ExternalLink, Import, RefreshCw, PlusCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─── Constants ───
const COLLECTION_LABELS: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  company_repo: { label: "Company Repository", icon: Building2, color: "text-yellow-500" },
  personal: { label: "Personal", icon: Lock, color: "text-blue-400" },
  counterparty: { label: "Counterparty Files", icon: Users, color: "text-purple-400" },
  template: { label: "Templates", icon: FilePlus, color: "text-emerald-400" },
  transaction: { label: "Transactions", icon: FileSpreadsheet, color: "text-orange-400" },
  signed: { label: "Signed Documents", icon: Shield, color: "text-green-400" },
};

const CATEGORY_LABELS: Record<string, { label: string; desc: string }> = {
  agreement: { label: "Agreement", desc: "Contracts, JVAs, SPPPs, NCNDAs, MOUs, and binding documents" },
  compliance: { label: "Compliance", desc: "KYB, KYC, AML docs, OFAC checks, source of funds" },
  intake: { label: "Intake Form", desc: "Client onboarding forms, buyer/seller intake, questionnaires" },
  profile: { label: "Profile", desc: "Executive bios, company profiles, resumes, credentials" },
  strategy: { label: "Strategy", desc: "Business plans, market analysis, pitch decks, proposals" },
  operations: { label: "Operations", desc: "Trackers, order books, salary sheets, expense reports" },
  transaction: { label: "Transaction", desc: "Deal sheets, trade confirmations, settlement records" },
  correspondence: { label: "Correspondence", desc: "Letters, emails, memos, formal communications" },
  template: { label: "Template", desc: "Reusable document templates for generating new documents" },
  other: { label: "Other", desc: "Documents that don't fit other categories" },
};

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" },
  active: { label: "Active", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  pending_signature: { label: "Pending Signature", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  sent: { label: "Sent for Signing", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  viewed: { label: "Viewed", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  signed: { label: "Signed", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  voided: { label: "Voided", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  declined: { label: "Declined", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  archived: { label: "Archived", color: "bg-zinc-600/20 text-zinc-500 border-zinc-600/30" },
};

const SOURCE_ICONS: Record<string, typeof FileText> = {
  google_doc: FileText,
  google_sheet: FileSpreadsheet,
  google_slide: Presentation,
  pdf: File,
  uploaded: Upload,
  generated: Sparkles,
};

function getFileIcon(sourceType: string) {
  return SOURCE_ICONS[sourceType] || FileText;
}

function getDriveMimeIcon(mimeType: string) {
  if (mimeType === "application/vnd.google-apps.document") return FileText;
  if (mimeType === "application/vnd.google-apps.spreadsheet") return FileSpreadsheet;
  if (mimeType === "application/vnd.google-apps.presentation") return Presentation;
  if (mimeType === "application/vnd.google-apps.folder") return FolderOpen;
  if (mimeType?.includes("pdf")) return File;
  return FileText;
}

function formatDate(date: Date | string | null) {
  if (!date) return "—";
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

function formatBytes(bytes: number | string | null) {
  if (!bytes) return "";
  const b = typeof bytes === "string" ? parseInt(bytes) : bytes;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Main Component ───
type ViewMode = "recents" | "collection" | "folder" | "search" | "favorites" | "drive";
type MainTab = "vault" | "drive";

export default function Vault() {
  const { user } = useAuth();
  const [mainTab, setMainTab] = useState<MainTab>("vault");
  const [viewMode, setViewMode] = useState<ViewMode>("recents");
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [folderBreadcrumbs, setFolderBreadcrumbs] = useState<Array<{ id: number | null; name: string }>>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [displayMode, setDisplayMode] = useState<"grid" | "list">("list");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<"doc" | "sheet">("doc");
  const [detailDocId, setDetailDocId] = useState<number | null>(null);

  // Vault Queries
  const recentDocs = trpc.vault.getRecent.useQuery({ limit: 20 }, { enabled: mainTab === "vault" && viewMode === "recents" });
  const favoriteDocs = trpc.vault.getFavorites.useQuery(undefined, { enabled: mainTab === "vault" && viewMode === "favorites" });
  const collectionDocs = trpc.vault.listDocuments.useQuery(
    {
      collection: selectedCollection || undefined,
      category: filterCategory !== "all" ? filterCategory : undefined,
      status: filterStatus !== "all" ? filterStatus : undefined,
      search: activeSearch || undefined,
      limit: 100,
    },
    { enabled: mainTab === "vault" && (viewMode === "collection" || viewMode === "search") }
  );
  const folderDocs = trpc.vault.listDocuments.useQuery(
    { folderId: selectedFolderId, limit: 100 },
    { enabled: mainTab === "vault" && viewMode === "folder" && selectedFolderId !== null }
  );
  const folders = trpc.vault.listFolders.useQuery(
    { collection: selectedCollection || undefined, parentId: selectedFolderId },
    { enabled: mainTab === "vault" && (viewMode === "collection" || viewMode === "folder") }
  );

  const toggleFavorite = trpc.vault.toggleFavorite.useMutation({
    onSuccess: (data) => {
      toast.success(data.isFavorited ? "Added to favorites" : "Removed from favorites");
      recentDocs.refetch();
      favoriteDocs.refetch();
      collectionDocs.refetch();
    },
  });

  const deleteDoc = trpc.vault.deleteDocument.useMutation({
    onSuccess: () => {
      toast.success("Document deleted");
      recentDocs.refetch();
      collectionDocs.refetch();
      folderDocs.refetch();
    },
  });

  // Navigation helpers
  const navigateToCollection = (collection: string) => {
    setSelectedCollection(collection);
    setSelectedFolderId(null);
    setFolderBreadcrumbs([]);
    setViewMode("collection");
  };

  const navigateToFolder = (folderId: number, folderName: string) => {
    setSelectedFolderId(folderId);
    setFolderBreadcrumbs(prev => [...prev, { id: folderId, name: folderName }]);
    setViewMode("folder");
  };

  const navigateBack = () => {
    if (viewMode === "folder" && folderBreadcrumbs.length > 1) {
      const newBreadcrumbs = folderBreadcrumbs.slice(0, -1);
      setFolderBreadcrumbs(newBreadcrumbs);
      setSelectedFolderId(newBreadcrumbs[newBreadcrumbs.length - 1].id);
    } else if (viewMode === "folder" || viewMode === "collection") {
      setViewMode("recents");
      setSelectedCollection(null);
      setSelectedFolderId(null);
      setFolderBreadcrumbs([]);
    } else {
      setViewMode("recents");
    }
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setActiveSearch(searchQuery.trim());
      setViewMode("search");
    }
  };

  // Current documents based on view mode
  const currentDocs = useMemo(() => {
    switch (viewMode) {
      case "recents": return recentDocs.data || [];
      case "favorites": return favoriteDocs.data || [];
      case "collection":
      case "search": return collectionDocs.data?.items || [];
      case "folder": return folderDocs.data?.items || [];
      default: return [];
    }
  }, [viewMode, recentDocs.data, favoriteDocs.data, collectionDocs.data, folderDocs.data]);

  const currentFolders = folders.data || [];
  const isLoading = recentDocs.isLoading || collectionDocs.isLoading || folderDocs.isLoading || favoriteDocs.isLoading;

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Top Tab Bar */}
      <div className="shrink-0 px-6 pt-4 border-b border-zinc-800/60">
        <div className="flex items-center justify-between">
          <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as MainTab)}>
            <TabsList className="bg-zinc-900/60 border border-zinc-800/60">
              <TabsTrigger value="vault" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400">
                <Shield className="h-4 w-4 mr-1.5" /> Vault
              </TabsTrigger>
              <TabsTrigger value="drive" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400">
                <HardDrive className="h-4 w-4 mr-1.5" /> Google Drive
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            {mainTab === "vault" && (
              <>
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    placeholder="Search documents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="pl-9 w-64 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600"
                  />
                </div>

                {/* View toggle */}
                <div className="flex items-center border border-zinc-800 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setDisplayMode("list")}
                    className={`p-2 ${displayMode === "list" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                  >
                    <List className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDisplayMode("grid")}
                    className={`p-2 ${displayMode === "grid" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </button>
                </div>

                {/* Create New */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium" size="sm">
                      <Plus className="h-4 w-4 mr-1.5" /> New
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800 w-56">
                    <DropdownMenuItem onClick={() => setUploadDialogOpen(true)}>
                      <Upload className="h-4 w-4 mr-2 text-zinc-400" /> Upload Document
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-zinc-800" />
                    <DropdownMenuItem onClick={() => { setCreateType("doc"); setCreateDialogOpen(true); }}>
                      <FileText className="h-4 w-4 mr-2 text-blue-400" /> New Google Doc
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setCreateType("sheet"); setCreateDialogOpen(true); }}>
                      <FileSpreadsheet className="h-4 w-4 mr-2 text-green-400" /> New Google Sheet
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>

        {/* Quick filters when in collection/search view */}
        {mainTab === "vault" && (viewMode === "collection" || viewMode === "search") && (
          <div className="flex items-center gap-2 mt-3 pb-3">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-40 bg-zinc-900 border-zinc-800 text-sm h-8">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40 bg-zinc-900 border-zinc-800 text-sm h-8">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(STATUS_BADGES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto">
        {mainTab === "vault" && (
          <div className="p-6">
            {/* Vault navigation header */}
            {viewMode !== "recents" && (
              <div className="flex items-center gap-3 mb-4">
                <Button variant="ghost" size="sm" onClick={navigateBack} className="text-zinc-400 hover:text-white -ml-2">
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {viewMode === "favorites" && "Starred Documents"}
                    {viewMode === "collection" && (COLLECTION_LABELS[selectedCollection || ""]?.label || "Documents")}
                    {viewMode === "folder" && (folderBreadcrumbs[folderBreadcrumbs.length - 1]?.name || "Folder")}
                    {viewMode === "search" && `Search: "${activeSearch}"`}
                  </h2>
                  {viewMode === "folder" && folderBreadcrumbs.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-zinc-500 mt-0.5">
                      <button onClick={() => navigateToCollection(selectedCollection || "")} className="hover:text-zinc-300">
                        {COLLECTION_LABELS[selectedCollection || ""]?.label || "Root"}
                      </button>
                      {folderBreadcrumbs.map((bc, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <ChevronRight className="h-3 w-3" />
                          <button
                            onClick={() => {
                              setFolderBreadcrumbs(folderBreadcrumbs.slice(0, i + 1));
                              setSelectedFolderId(bc.id);
                            }}
                            className={i === folderBreadcrumbs.length - 1 ? "text-zinc-300" : "hover:text-zinc-300"}
                          >
                            {bc.name}
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Recents view */}
            {viewMode === "recents" && (
              <div className="space-y-8">
                {/* Quick Actions */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setViewMode("favorites")}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-yellow-500 hover:border-yellow-600/30 transition-all"
                  >
                    <Star className="h-4 w-4" /> Starred
                  </button>
                  <button
                    onClick={() => { setActiveSearch(""); setViewMode("search"); }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 transition-all"
                  >
                    <Search className="h-4 w-4" /> Browse All
                  </button>
                  <button
                    onClick={() => setMainTab("drive")}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-blue-400 hover:border-blue-600/30 transition-all"
                  >
                    <HardDrive className="h-4 w-4" /> Google Drive
                  </button>
                </div>

                {/* Collections Grid */}
                <div>
                  <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Collections</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {Object.entries(COLLECTION_LABELS).map(([key, { label, icon: Icon, color }]) => (
                      <button
                        key={key}
                        onClick={() => navigateToCollection(key)}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/60 hover:border-zinc-700 hover:bg-zinc-900 transition-all group"
                      >
                        <div className={`h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center ${color} group-hover:scale-110 transition-transform`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className="text-xs text-zinc-400 group-hover:text-white transition-colors text-center leading-tight">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recent Documents */}
                <div>
                  <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Recent</h3>
                  {isLoading ? (
                    <div className="space-y-2">
                      {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 bg-zinc-900" />)}
                    </div>
                  ) : currentDocs.length === 0 ? (
                    <div className="text-center py-16">
                      <FileText className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
                      <p className="text-zinc-500">No documents yet</p>
                      <p className="text-zinc-600 text-sm mt-1">Upload a document, create a Google Doc, or import from Drive</p>
                      <div className="flex items-center justify-center gap-2 mt-4">
                        <Button onClick={() => setUploadDialogOpen(true)} className="bg-yellow-600 hover:bg-yellow-700 text-black" size="sm">
                          <Upload className="h-4 w-4 mr-1.5" /> Upload
                        </Button>
                        <Button onClick={() => { setCreateType("doc"); setCreateDialogOpen(true); }} variant="outline" className="border-zinc-700 text-zinc-300" size="sm">
                          <FileText className="h-4 w-4 mr-1.5" /> New Doc
                        </Button>
                        <Button onClick={() => { setCreateType("sheet"); setCreateDialogOpen(true); }} variant="outline" className="border-zinc-700 text-zinc-300" size="sm">
                          <FileSpreadsheet className="h-4 w-4 mr-1.5" /> New Sheet
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <DocumentList
                      documents={currentDocs}
                      displayMode={displayMode}
                      onToggleFavorite={(id) => toggleFavorite.mutate({ documentId: id })}
                      onDelete={(id) => deleteDoc.mutate({ id })}
                      onViewDetail={(id) => setDetailDocId(id)}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Collection / Folder / Search / Favorites views */}
            {viewMode !== "recents" && (
              <div className="space-y-4">
                {/* Subfolders */}
                {(viewMode === "collection" || viewMode === "folder") && currentFolders.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Folders</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                      {currentFolders.map((folder: any) => (
                        <button
                          key={folder.id}
                          onClick={() => navigateToFolder(folder.id, folder.name)}
                          className="flex items-center gap-2.5 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/60 hover:border-zinc-700 hover:bg-zinc-900 transition-all group text-left"
                        >
                          <FolderOpen className="h-5 w-5 text-yellow-600 shrink-0" />
                          <span className="text-sm text-zinc-300 group-hover:text-white truncate">{folder.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Documents */}
                {isLoading ? (
                  <div className="space-y-2">
                    {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-14 bg-zinc-900" />)}
                  </div>
                ) : currentDocs.length === 0 ? (
                  <div className="text-center py-16">
                    <FileText className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
                    <p className="text-zinc-500">
                      {viewMode === "search" ? "No documents match your search" : "No documents in this collection"}
                    </p>
                  </div>
                ) : (
                  <DocumentList
                    documents={currentDocs}
                    displayMode={displayMode}
                    onToggleFavorite={(id) => toggleFavorite.mutate({ documentId: id })}
                    onDelete={(id) => deleteDoc.mutate({ id })}
                    onViewDetail={(id) => setDetailDocId(id)}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* Google Drive Tab */}
        {mainTab === "drive" && (
          <DriveBrowser
            onImport={() => {
              recentDocs.refetch();
              collectionDocs.refetch();
            }}
          />
        )}
      </div>

      {/* Upload Dialog */}
      <UploadDialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} onSuccess={() => {
        recentDocs.refetch();
        collectionDocs.refetch();
      }} />

      {/* Create Google Doc/Sheet Dialog */}
      <CreateGoogleDialog
        open={createDialogOpen}
        type={createType}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={() => {
          recentDocs.refetch();
          collectionDocs.refetch();
        }}
      />

      {/* Document Detail Panel */}
      {detailDocId && (
        <DocumentDetailPanel
          documentId={detailDocId}
          onClose={() => setDetailDocId(null)}
        />
      )}
    </div>
  );
}

// ─── Google Drive Browser ───
function DriveBrowser({ onImport }: { onImport: () => void }) {
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const [currentDriveId, setCurrentDriveId] = useState<string | undefined>(undefined);
  const [folderPath, setFolderPath] = useState<Array<{ id: string | undefined; name: string }>>([{ id: undefined, name: "My Drive" }]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [importingFileId, setImportingFileId] = useState<string | null>(null);

  const driveStatus = trpc.drive.connectionStatus.useQuery();
  const sharedDrives = trpc.drive.listSharedDrives.useQuery(undefined, {
    enabled: !!driveStatus.data?.connected && !!driveStatus.data?.hasDriveScopes,
  });
  const driveFiles = trpc.drive.listFiles.useQuery(
    { folderId: currentFolderId, driveId: currentDriveId, pageSize: 50 },
    { enabled: !!driveStatus.data?.connected && !!driveStatus.data?.hasDriveScopes && !isSearching }
  );
  const searchResults = trpc.drive.searchFiles.useQuery(
    { query: searchQuery, pageSize: 30 },
    { enabled: !!driveStatus.data?.connected && !!driveStatus.data?.hasDriveScopes && isSearching && searchQuery.length > 0 }
  );

  const importToVault = trpc.drive.importToVault.useMutation({
    onSuccess: (doc) => {
      toast.success(`"${doc?.title}" imported to Vault`);
      setImportingFileId(null);
      onImport();
    },
    onError: (err) => {
      toast.error(err.message);
      setImportingFileId(null);
    },
  });

  const navigateToFolder = (folderId: string, folderName: string) => {
    setCurrentFolderId(folderId);
    setFolderPath(prev => [...prev, { id: folderId, name: folderName }]);
    setIsSearching(false);
    setSearchQuery("");
  };

  const navigateToSharedDrive = (driveId: string, driveName: string) => {
    setCurrentDriveId(driveId);
    setCurrentFolderId(driveId);
    setFolderPath([{ id: driveId, name: driveName }]);
    setIsSearching(false);
    setSearchQuery("");
  };

  const navigateToMyDrive = () => {
    setCurrentDriveId(undefined);
    setCurrentFolderId(undefined);
    setFolderPath([{ id: undefined, name: "My Drive" }]);
    setIsSearching(false);
    setSearchQuery("");
  };

  const navigateToPathIndex = (index: number) => {
    const target = folderPath[index];
    setCurrentFolderId(target.id);
    setFolderPath(folderPath.slice(0, index + 1));
    setIsSearching(false);
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setIsSearching(true);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setIsSearching(false);
  };

  const handleImport = (fileId: string) => {
    setImportingFileId(fileId);
    importToVault.mutate({ googleFileId: fileId });
  };

  const files = isSearching ? (searchResults.data || []) : (driveFiles.data?.files || []);
  const isLoadingFiles = isSearching ? searchResults.isLoading : driveFiles.isLoading;

  // Not connected at all
  if (!driveStatus.data?.connected) {
    return (
      <div className="p-6">
        <div className="text-center py-20">
          <HardDrive className="h-16 w-16 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Connect Google Drive</h3>
          <p className="text-zinc-500 text-sm max-w-md mx-auto mb-6">
            Connect your Google account to browse, import, and create documents directly from OmniScope.
            Go to Settings and connect your Google account with Drive permissions.
          </p>
          <Badge variant="outline" className="text-zinc-400 border-zinc-700">
            Settings → Integrations → Google Account
          </Badge>
        </div>
      </div>
    );
  }

  // Connected but missing Drive scopes — needs re-auth
  if (!driveStatus.data?.hasDriveScopes) {
    return (
      <div className="p-6">
        <div className="text-center py-20">
          <HardDrive className="h-16 w-16 text-yellow-600/50 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Drive Permissions Required</h3>
          <p className="text-zinc-500 text-sm max-w-md mx-auto mb-4">
            Your Google account is connected but doesn't have Drive, Docs, or Sheets permissions yet.
            Please re-authenticate to grant the required scopes.
          </p>
          <p className="text-zinc-600 text-xs max-w-sm mx-auto mb-6">
            Go to <span className="text-yellow-500">Settings → Integrations</span> and click <span className="text-yellow-500">"Reconnect"</span> on your Google account.
            This will prompt you to grant Drive, Docs, and Sheets access.
          </p>
          <Badge variant="outline" className="text-yellow-500 border-yellow-600/30">
            Settings → Integrations → Reconnect Google
          </Badge>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Shared Drives Quick Access */}
      {(sharedDrives.data || []).length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={navigateToMyDrive}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              !currentDriveId ? "bg-yellow-600/20 text-yellow-500 border border-yellow-600/30" : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700"
            }`}
          >
            <HardDrive className="h-3 w-3 inline mr-1.5" />My Drive
          </button>
          {(sharedDrives.data || []).map((sd: any) => (
            <button
              key={sd.id}
              onClick={() => navigateToSharedDrive(sd.id, sd.name)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentDriveId === sd.id ? "bg-yellow-600/20 text-yellow-500 border border-yellow-600/30" : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700"
              }`}
            >
              <Users className="h-3 w-3 inline mr-1.5" />{sd.name}
            </button>
          ))}
        </div>
      )}

      {/* Drive Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 text-sm">
            {folderPath.map((fp, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 text-zinc-600" />}
                <button
                  onClick={() => navigateToPathIndex(i)}
                  className={`px-1.5 py-0.5 rounded ${i === folderPath.length - 1 ? "text-white font-medium" : "text-zinc-400 hover:text-white"}`}
                >
                  {fp.name}
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Drive */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Search Drive..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-9 w-64 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600"
            />
            {isSearching && (
              <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => driveFiles.refetch()} className="text-zinc-400 hover:text-white">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isSearching && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-zinc-400 border-zinc-700">
            Search results for "{searchQuery}"
          </Badge>
          <button onClick={clearSearch} className="text-xs text-zinc-500 hover:text-white">Clear</button>
        </div>
      )}

      {/* File List */}
      {isLoadingFiles ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 bg-zinc-900" />)}
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-16">
          <FolderOpen className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500">{isSearching ? "No files match your search" : "This folder is empty"}</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {/* Column headers */}
          <div className="flex items-center gap-4 px-4 py-2 text-xs text-zinc-600 uppercase tracking-wider font-medium">
            <div className="w-9" />
            <div className="flex-1">Name</div>
            <div className="w-24 text-right">Size</div>
            <div className="w-28 text-right">Modified</div>
            <div className="w-20" />
          </div>

          {files.map((file: any) => {
            const isFolder = file.mimeType === "application/vnd.google-apps.folder";
            const MimeIcon = getDriveMimeIcon(file.mimeType);
            const isImporting = importingFileId === file.id;

            return (
              <div
                key={file.id}
                className="flex items-center gap-4 px-4 py-2.5 rounded-lg hover:bg-zinc-900/80 transition-all group"
              >
                <div className="h-9 w-9 rounded-lg bg-zinc-800/80 flex items-center justify-center shrink-0">
                  <MimeIcon className={`h-4.5 w-4.5 ${isFolder ? "text-yellow-600" : "text-zinc-400"}`} />
                </div>

                <button
                  className="flex-1 text-left min-w-0"
                  onClick={() => isFolder ? navigateToFolder(file.id, file.name) : window.open(file.webViewLink, "_blank")}
                >
                  <p className="text-sm font-medium text-white truncate hover:text-yellow-500 transition-colors">{file.name}</p>
                </button>

                <span className="text-xs text-zinc-600 w-24 text-right shrink-0">
                  {!isFolder && formatBytes(file.size)}
                </span>

                <span className="text-xs text-zinc-600 w-28 text-right shrink-0">
                  {formatDate(file.modifiedTime)}
                </span>

                <div className="w-20 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {!isFolder && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleImport(file.id)}
                      disabled={isImporting}
                      className="h-7 px-2 text-xs text-yellow-500 hover:text-yellow-400 hover:bg-yellow-600/10"
                    >
                      {isImporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Import className="h-3 w-3 mr-1" />}
                      {isImporting ? "" : "Import"}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(file.webViewLink, "_blank")}
                    className="h-7 px-1.5 text-zinc-500 hover:text-white"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Create Google Doc/Sheet Dialog ───
function CreateGoogleDialog({
  open, type, onClose, onSuccess
}: {
  open: boolean;
  type: "doc" | "sheet";
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState("");
  const [collection, setCollection] = useState("company_repo");
  const [category, setCategory] = useState("other");
  const [entitySearch, setEntitySearch] = useState("");
  const [linkedEntities, setLinkedEntities] = useState<Array<{ type: "company" | "contact"; id: number; name: string }>>([]);

  // Entity search queries
  const companyResults = trpc.companies.list.useQuery(
    { search: entitySearch, limit: 5 },
    { enabled: entitySearch.length >= 2 }
  );
  const contactResults = trpc.contacts.searchByName.useQuery(
    { query: entitySearch, limit: 5 },
    { enabled: entitySearch.length >= 2 }
  );

  const createDoc = trpc.drive.createDoc.useMutation({
    onSuccess: (data) => {
      toast.success(`Google Doc "${title}" created`);
      if (data.webViewLink) {
        window.open(data.webViewLink, "_blank");
      }
      onSuccess();
      resetAndClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const createSheet = trpc.drive.createSheet.useMutation({
    onSuccess: (data) => {
      toast.success(`Google Sheet "${title}" created`);
      if (data.webViewLink) {
        window.open(data.webViewLink, "_blank");
      }
      onSuccess();
      resetAndClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const linkEntity = trpc.vault.linkEntity.useMutation();

  const resetAndClose = () => {
    setTitle("");
    setCollection("company_repo");
    setCategory("other");
    setEntitySearch("");
    setLinkedEntities([]);
    onClose();
  };

  const addEntity = (entity: { type: "company" | "contact"; id: number; name: string }) => {
    if (!linkedEntities.find(e => e.type === entity.type && e.id === entity.id)) {
      setLinkedEntities(prev => [...prev, entity]);
    }
    setEntitySearch("");
  };

  const removeEntity = (type: string, id: number) => {
    setLinkedEntities(prev => prev.filter(e => !(e.type === type && e.id === id)));
  };

  const handleCreate = () => {
    const params = {
      title,
      registerInVault: true,
      collection: collection as any,
      category: category as any,
      entityLinks: linkedEntities.map(e => ({ entityType: e.type, entityId: e.id, linkType: "related" as const })),
    };
    if (type === "doc") {
      createDoc.mutate(params);
    } else {
      createSheet.mutate(params);
    }
  };

  const isPending = createDoc.isPending || createSheet.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && resetAndClose()}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            {type === "doc" ? (
              <><FileText className="h-5 w-5 text-blue-400" /> New Google Doc</>
            ) : (
              <><FileSpreadsheet className="h-5 w-5 text-green-400" /> New Google Sheet</>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-zinc-400 text-xs">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={type === "doc" ? "e.g., SPPP Agreement — Wintermute" : "e.g., OTC Deal Tracker Q1 2026"}
              className="bg-zinc-900 border-zinc-800 text-white mt-1"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-zinc-400 text-xs">Collection</Label>
              <Select value={collection} onValueChange={setCollection}>
                <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(COLLECTION_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-zinc-400 text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      <div>
                        <span>{v.label}</span>
                        <span className="text-[10px] text-zinc-500 ml-1.5">{v.desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {category && CATEGORY_LABELS[category] && (
                <p className="text-[10px] text-zinc-500 mt-1">{CATEGORY_LABELS[category].desc}</p>
              )}
            </div>
          </div>

          {/* Entity Tagging */}
          <div>
            <Label className="text-zinc-400 text-xs">Tag People & Companies</Label>
            <p className="text-[10px] text-zinc-600 mb-1.5">Link this document to contacts or companies so it appears in their profile</p>
            <div className="relative">
              <Input
                value={entitySearch}
                onChange={(e) => setEntitySearch(e.target.value)}
                placeholder="Search contacts or companies..."
                className="bg-zinc-900 border-zinc-800 text-white"
              />
              {entitySearch.length >= 2 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-h-48 overflow-auto">
                  {(companyResults.data?.items || []).map((c: any) => (
                    <button
                      key={`co-${c.id}`}
                      className="w-full px-3 py-2 text-left hover:bg-zinc-800 flex items-center gap-2 text-sm"
                      onClick={() => addEntity({ type: "company", id: c.id, name: c.name })}
                    >
                      <Building2 className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                      <span className="text-zinc-300 truncate">{c.name}</span>
                      <Badge variant="outline" className="text-[9px] ml-auto shrink-0">Company</Badge>
                    </button>
                  ))}
                  {(contactResults.data || []).map((c: any) => (
                    <button
                      key={`ct-${c.id}`}
                      className="w-full px-3 py-2 text-left hover:bg-zinc-800 flex items-center gap-2 text-sm"
                      onClick={() => addEntity({ type: "contact", id: c.id, name: c.name })}
                    >
                      <User className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                      <span className="text-zinc-300 truncate">{c.name}</span>
                      <Badge variant="outline" className="text-[9px] ml-auto shrink-0">Contact</Badge>
                    </button>
                  ))}
                  {(companyResults.data?.items || []).length === 0 && (contactResults.data || []).length === 0 && (
                    <p className="px-3 py-2 text-xs text-zinc-600">No results found</p>
                  )}
                </div>
              )}
            </div>
            {linkedEntities.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {linkedEntities.map((e) => (
                  <Badge
                    key={`${e.type}-${e.id}`}
                    variant="outline"
                    className={`text-xs cursor-pointer hover:bg-zinc-800 ${
                      e.type === "company" ? "border-yellow-500/30 text-yellow-400" : "border-blue-500/30 text-blue-400"
                    }`}
                    onClick={() => removeEntity(e.type, e.id)}
                  >
                    {e.type === "company" ? <Building2 className="h-3 w-3 mr-1" /> : <User className="h-3 w-3 mr-1" />}
                    {e.name}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-lg p-3">
            <p className="text-xs text-zinc-500">
              This will create a new {type === "doc" ? "Google Doc" : "Google Sheet"} in your Drive and register it in the Vault.
              {linkedEntities.length > 0 && ` It will be linked to ${linkedEntities.length} ${linkedEntities.length === 1 ? "entity" : "entities"} and appear in their profiles.`}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={resetAndClose} className="border-zinc-700 text-zinc-400">Cancel</Button>
          <Button
            onClick={handleCreate}
            disabled={!title.trim() || isPending}
            className="bg-yellow-600 hover:bg-yellow-700 text-black"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <PlusCircle className="h-4 w-4 mr-1.5" />}
            Create & Open
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Document List Component ───
function DocumentList({
  documents,
  displayMode,
  onToggleFavorite,
  onDelete,
  onViewDetail,
}: {
  documents: any[];
  displayMode: "grid" | "list";
  onToggleFavorite: (id: number) => void;
  onDelete: (id: number) => void;
  onViewDetail: (id: number) => void;
}) {
  if (displayMode === "grid") {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {documents.map((doc: any) => {
          const FileIcon = getFileIcon(doc.sourceType);
          const status = STATUS_BADGES[doc.status] || STATUS_BADGES.active;
          return (
            <button
              key={doc.id}
              onClick={() => onViewDetail(doc.id)}
              className="flex flex-col p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/60 hover:border-zinc-700 hover:bg-zinc-900 transition-all text-left group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                  <FileIcon className="h-5 w-5 text-zinc-400" />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1 rounded text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleFavorite(doc.id); }}>
                      <Star className="h-4 w-4 mr-2" /> Toggle Star
                    </DropdownMenuItem>
                    {doc.googleFileId && (
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        const baseUrl = doc.sourceType === "google_sheet"
                          ? `https://docs.google.com/spreadsheets/d/${doc.googleFileId}/edit`
                          : `https://docs.google.com/document/d/${doc.googleFileId}/edit`;
                        window.open(baseUrl, "_blank");
                      }}>
                        <ExternalLink className="h-4 w-4 mr-2" /> Open in Google
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(doc.id); }} className="text-red-400">
                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <p className="text-sm font-medium text-white truncate mb-1">{doc.title}</p>
              <div className="flex items-center gap-2 mt-auto">
                <Badge variant="outline" className={`text-[10px] ${status.color}`}>{status.label}</Badge>
                <span className="text-[10px] text-zinc-600">{formatDate(doc.updatedAt)}</span>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-1">
      {documents.map((doc: any) => {
        const FileIcon = getFileIcon(doc.sourceType);
        const status = STATUS_BADGES[doc.status] || STATUS_BADGES.active;
        const category = CATEGORY_LABELS[doc.category]?.label || doc.category;
        return (
          <button
            key={doc.id}
            onClick={() => onViewDetail(doc.id)}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-zinc-900/80 transition-all group text-left"
          >
            <div className="h-9 w-9 rounded-lg bg-zinc-800/80 flex items-center justify-center shrink-0">
              <FileIcon className="h-4.5 w-4.5 text-zinc-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{doc.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-zinc-600">{category}</span>
                {doc.subcategory && (
                  <>
                    <span className="text-zinc-700">·</span>
                    <span className="text-xs text-zinc-600 uppercase">{doc.subcategory}</span>
                  </>
                )}
                {doc.sourceType?.startsWith("google_") && (
                  <>
                    <span className="text-zinc-700">·</span>
                    <span className="text-xs text-blue-500/60">Google</span>
                  </>
                )}
              </div>
            </div>
            <Badge variant="outline" className={`text-[10px] shrink-0 ${status.color}`}>{status.label}</Badge>
            <span className="text-xs text-zinc-600 shrink-0 w-20 text-right">{formatDate(doc.updatedAt)}</span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(doc.id); }}
                className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-yellow-500"
              >
                <Star className="h-3.5 w-3.5" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-white" onClick={(e) => e.stopPropagation()}>
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onViewDetail(doc.id); }}>
                    <Eye className="h-4 w-4 mr-2" /> View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleFavorite(doc.id); }}>
                    <Star className="h-4 w-4 mr-2" /> Toggle Star
                  </DropdownMenuItem>
                  {doc.googleFileId && (
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      const baseUrl = doc.sourceType === "google_sheet"
                        ? `https://docs.google.com/spreadsheets/d/${doc.googleFileId}/edit`
                        : `https://docs.google.com/document/d/${doc.googleFileId}/edit`;
                      window.open(baseUrl, "_blank");
                    }}>
                      <ExternalLink className="h-4 w-4 mr-2" /> Open in Google
                    </DropdownMenuItem>
                  )}
                  {doc.s3Url && (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); window.open(doc.s3Url, "_blank"); }}>
                      <Download className="h-4 w-4 mr-2" /> Download
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(doc.id); }} className="text-red-400">
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Upload Dialog with AI Analysis ───
function UploadDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState<"upload" | "analyzing" | "review">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [collection, setCollection] = useState("company_repo");
  const [category, setCategory] = useState("other");
  const [subcategory, setSubcategory] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);
  const [textContent, setTextContent] = useState("");
  const [entitySearch, setEntitySearch] = useState("");
  const [linkedEntities, setLinkedEntities] = useState<Array<{ type: "company" | "contact"; id: number; name: string }>>([]);

  // Entity search queries
  const companyResults = trpc.companies.list.useQuery(
    { search: entitySearch, limit: 5 },
    { enabled: entitySearch.length >= 2 }
  );
  const contactResults = trpc.contacts.searchByName.useQuery(
    { query: entitySearch, limit: 5 },
    { enabled: entitySearch.length >= 2 }
  );

  const analyzeDoc = trpc.vault.analyzeDocument.useMutation();
  const createDoc = trpc.vault.createDocument.useMutation({
    onSuccess: () => {
      toast.success("Document uploaded and filed");
      onSuccess();
      resetAndClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const addEntity = (entity: { type: "company" | "contact"; id: number; name: string }) => {
    if (!linkedEntities.find(e => e.type === entity.type && e.id === entity.id)) {
      setLinkedEntities(prev => [...prev, entity]);
    }
    setEntitySearch("");
  };

  const removeEntity = (type: string, id: number) => {
    setLinkedEntities(prev => prev.filter(e => !(e.type === type && e.id === id)));
  };

  const resetAndClose = () => {
    setStep("upload");
    setFile(null);
    setTitle("");
    setDescription("");
    setCollection("company_repo");
    setCategory("other");
    setSubcategory("");
    setAiSuggestions(null);
    setTextContent("");
    setEntitySearch("");
    setLinkedEntities([]);
    onClose();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setTitle(f.name.replace(/\.[^/.]+$/, ""));

    // Extract text for AI analysis
    if (f.type === "text/plain" || f.name.endsWith(".txt") || f.name.endsWith(".md")) {
      const text = await f.text();
      setTextContent(text);
    }
  };

  const handleAnalyze = async () => {
    setStep("analyzing");
    try {
      const result = await analyzeDoc.mutateAsync({
        title: title || file?.name || "Untitled",
        fileName: file?.name,
        mimeType: file?.type,
        textContent: textContent || undefined,
      });
      if (result) {
        setAiSuggestions(result);
        if (result.suggestedTitle) setTitle(result.suggestedTitle);
        if (result.category) setCategory(result.category);
        if (result.subcategory) setSubcategory(result.subcategory);
        if (result.collection) setCollection(result.collection);
        if (result.summary) setDescription(result.summary);
      }
      setStep("review");
    } catch {
      toast.error("AI analysis failed — please fill in details manually");
      setStep("review");
    }
  };

  const handleSubmit = () => {
    createDoc.mutate({
      title,
      description: description || undefined,
      sourceType: "uploaded",
      fileName: file?.name,
      mimeType: file?.type,
      collection: collection as any,
      category: category as any,
      subcategory: subcategory || undefined,
      visibility: "organization",
      entityLinks: linkedEntities.map(e => ({ entityType: e.type, entityId: e.id, linkType: "primary" as const })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && resetAndClose()}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">
            {step === "upload" && "Upload Document"}
            {step === "analyzing" && "Analyzing Document..."}
            {step === "review" && "Review & File"}
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-zinc-700 rounded-xl p-8 text-center hover:border-yellow-600/50 transition-colors cursor-pointer"
              onClick={() => document.getElementById("vault-file-input")?.click()}
            >
              <Upload className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 text-sm">
                {file ? file.name : "Click to select a file or drag and drop"}
              </p>
              {file && (
                <p className="text-zinc-600 text-xs mt-1">
                  {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type || "Unknown type"}
                </p>
              )}
              <input
                id="vault-file-input"
                type="file"
                className="hidden"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.jpg,.jpeg,.png"
              />
            </div>

            <div>
              <Label className="text-zinc-400 text-xs">Document Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter title or let AI suggest one"
                className="bg-zinc-900 border-zinc-800 text-white mt-1"
              />
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={resetAndClose} className="border-zinc-700 text-zinc-400">Cancel</Button>
              <Button
                onClick={handleAnalyze}
                disabled={!file}
                className="bg-yellow-600 hover:bg-yellow-700 text-black"
              >
                <Sparkles className="h-4 w-4 mr-1.5" /> Analyze & File
              </Button>
              <Button
                onClick={() => setStep("review")}
                disabled={!file}
                variant="outline"
                className="border-zinc-700 text-zinc-400"
              >
                Skip AI → Manual
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "analyzing" && (
          <div className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-yellow-600 mx-auto mb-4" />
            <p className="text-zinc-400">AI is analyzing your document...</p>
            <p className="text-zinc-600 text-sm mt-1">Detecting type, category, and linked entities</p>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            {aiSuggestions && (
              <div className="bg-yellow-600/5 border border-yellow-600/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-yellow-500" />
                  <span className="text-xs font-medium text-yellow-500">AI Suggestions Applied</span>
                </div>
                {aiSuggestions.detectedEntities?.companies?.length > 0 && (
                  <p className="text-xs text-zinc-400">
                    Detected companies: {aiSuggestions.detectedEntities.companies.join(", ")}
                  </p>
                )}
                {aiSuggestions.detectedEntities?.people?.length > 0 && (
                  <p className="text-xs text-zinc-400">
                    Detected people: {aiSuggestions.detectedEntities.people.join(", ")}
                  </p>
                )}
                {aiSuggestions.tags?.length > 0 && (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {aiSuggestions.tags.map((tag: string) => (
                      <Badge key={tag} variant="outline" className="text-[10px] border-yellow-600/30 text-yellow-500">{tag}</Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <Label className="text-zinc-400 text-xs">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-zinc-900 border-zinc-800 text-white mt-1" />
            </div>

            <div>
              <Label className="text-zinc-400 text-xs">Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="bg-zinc-900 border-zinc-800 text-white mt-1" rows={2} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-zinc-400 text-xs">Collection</Label>
                <Select value={collection} onValueChange={setCollection}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(COLLECTION_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-zinc-400 text-xs">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        <div>
                          <span>{v.label}</span>
                          <span className="text-[10px] text-zinc-500 ml-1.5">{v.desc}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {category && CATEGORY_LABELS[category] && (
                  <p className="text-[10px] text-zinc-500 mt-1">{CATEGORY_LABELS[category].desc}</p>
                )}
              </div>
            </div>

            <div>
              <Label className="text-zinc-400 text-xs">Subcategory (e.g., SPPP, NCNDA, JVA, KYC)</Label>
              <Input value={subcategory} onChange={(e) => setSubcategory(e.target.value)} className="bg-zinc-900 border-zinc-800 text-white mt-1" placeholder="Optional" />
            </div>

            {/* Entity Tagging */}
            <div>
              <Label className="text-zinc-400 text-xs">Tag People & Companies</Label>
              <p className="text-[10px] text-zinc-600 mb-1.5">Link this document to contacts or companies so it appears in their profile</p>
              <div className="relative">
                <Input
                  value={entitySearch}
                  onChange={(e) => setEntitySearch(e.target.value)}
                  placeholder="Search contacts or companies..."
                  className="bg-zinc-900 border-zinc-800 text-white"
                />
                {entitySearch.length >= 2 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-h-48 overflow-auto">
                    {(companyResults.data?.items || []).map((c: any) => (
                      <button
                        key={`co-${c.id}`}
                        className="w-full px-3 py-2 text-left hover:bg-zinc-800 flex items-center gap-2 text-sm"
                        onClick={() => addEntity({ type: "company", id: c.id, name: c.name })}
                      >
                        <Building2 className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                        <span className="text-zinc-300 truncate">{c.name}</span>
                        <Badge variant="outline" className="text-[9px] ml-auto shrink-0">Company</Badge>
                      </button>
                    ))}
                    {(contactResults.data || []).map((c: any) => (
                      <button
                        key={`ct-${c.id}`}
                        className="w-full px-3 py-2 text-left hover:bg-zinc-800 flex items-center gap-2 text-sm"
                        onClick={() => addEntity({ type: "contact", id: c.id, name: c.name })}
                      >
                        <User className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                        <span className="text-zinc-300 truncate">{c.name}</span>
                        <Badge variant="outline" className="text-[9px] ml-auto shrink-0">Contact</Badge>
                      </button>
                    ))}
                    {(companyResults.data?.items || []).length === 0 && (contactResults.data || []).length === 0 && (
                      <p className="px-3 py-2 text-xs text-zinc-600">No results found</p>
                    )}
                  </div>
                )}
              </div>
              {linkedEntities.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {linkedEntities.map((e) => (
                    <Badge
                      key={`${e.type}-${e.id}`}
                      variant="outline"
                      className={`text-xs cursor-pointer hover:bg-zinc-800 ${
                        e.type === "company" ? "border-yellow-500/30 text-yellow-400" : "border-blue-500/30 text-blue-400"
                      }`}
                      onClick={() => removeEntity(e.type, e.id)}
                    >
                      {e.type === "company" ? <Building2 className="h-3 w-3 mr-1" /> : <User className="h-3 w-3 mr-1" />}
                      {e.name}
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={resetAndClose} className="border-zinc-700 text-zinc-400">Cancel</Button>
              <Button
                onClick={handleSubmit}
                disabled={!title || createDoc.isPending}
                className="bg-yellow-600 hover:bg-yellow-700 text-black"
              >
                {createDoc.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Check className="h-4 w-4 mr-1.5" />}
                File Document
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Document Detail Panel (Slide-over) ───
function DocumentDetailPanel({ documentId, onClose }: { documentId: number; onClose: () => void }) {
  const doc = trpc.vault.getDocument.useQuery({ id: documentId });

  if (doc.isLoading) {
    return (
      <div className="fixed inset-y-0 right-0 w-[480px] bg-zinc-950 border-l border-zinc-800 z-50 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-yellow-600" />
      </div>
    );
  }

  if (!doc.data) return null;

  const d = doc.data;
  const FileIcon = getFileIcon(d.sourceType);
  const status = STATUS_BADGES[d.status] || STATUS_BADGES.active;

  // Determine the Google link based on source type
  const googleLink = d.googleFileId
    ? d.sourceType === "google_sheet"
      ? `https://docs.google.com/spreadsheets/d/${d.googleFileId}/edit`
      : d.sourceType === "google_slide"
        ? `https://docs.google.com/presentation/d/${d.googleFileId}/edit`
        : `https://docs.google.com/document/d/${d.googleFileId}/edit`
    : null;

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-zinc-950 border-l border-zinc-800 z-50 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
            <FileIcon className="h-5 w-5 text-zinc-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">{d.title}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className={`text-[10px] ${status.color}`}>{status.label}</Badge>
              <span className="text-[10px] text-zinc-600">{formatDate(d.updatedAt)}</span>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="text-zinc-500 hover:text-white">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Description */}
        {d.description && (
          <div>
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Description</h4>
            <p className="text-sm text-zinc-300">{d.description}</p>
          </div>
        )}

        {/* Metadata */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Details</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Collection</span>
              <span className="text-zinc-300">{COLLECTION_LABELS[d.collection]?.label || d.collection}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Category</span>
              <span className="text-zinc-300">{CATEGORY_LABELS[d.category]?.label || d.category}</span>
            </div>
            {d.subcategory && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">Subcategory</span>
                <span className="text-zinc-300 uppercase">{d.subcategory}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Source</span>
              <span className="text-zinc-300 capitalize">{d.sourceType?.replace(/_/g, " ")}</span>
            </div>
            {d.fileName && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">File</span>
                <span className="text-zinc-300 truncate ml-4">{d.fileName}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Visibility</span>
              <Badge variant="outline" className="text-[10px]">{d.visibility}</Badge>
            </div>
          </div>
        </div>

        {/* Entity Links */}
        {d.entityLinks && d.entityLinks.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Linked Entities</h4>
            <div className="space-y-1.5">
              {d.entityLinks.map((link: any) => (
                <div key={link.id} className="flex items-center gap-2 text-sm">
                  {link.entityType === "company" && <Building2 className="h-3.5 w-3.5 text-yellow-500" />}
                  {link.entityType === "contact" && <User className="h-3.5 w-3.5 text-blue-400" />}
                  {link.entityType === "meeting" && <Calendar className="h-3.5 w-3.5 text-purple-400" />}
                  <span className="text-zinc-300 capitalize">{link.entityType} #{link.entityId}</span>
                  <Badge variant="outline" className="text-[10px]">{link.linkType}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Signing History */}
        {d.envelopes && d.envelopes.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Signing History</h4>
            <div className="space-y-2">
              {d.envelopes.map((env: any) => (
                <div key={env.id} className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={`text-[10px] ${STATUS_BADGES[env.status]?.color || ""}`}>
                      {STATUS_BADGES[env.status]?.label || env.status}
                    </Badge>
                    <span className="text-[10px] text-zinc-600">{formatDate(env.sentAt)}</span>
                  </div>
                  {env.signedDocumentUrl && (
                    <a href={env.signedDocumentUrl} target="_blank" rel="noopener" className="text-xs text-yellow-500 hover:underline mt-1 inline-block">
                      Download Signed Copy
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          {googleLink && (
            <Button variant="outline" className="w-full border-zinc-700 text-zinc-300" onClick={() => window.open(googleLink, "_blank")}>
              <ExternalLink className="h-4 w-4 mr-2" /> Open in Google {d.sourceType === "google_sheet" ? "Sheets" : d.sourceType === "google_slide" ? "Slides" : "Docs"}
            </Button>
          )}
          {d.s3Url && (
            <Button variant="outline" className="w-full border-zinc-700 text-zinc-300" onClick={() => window.open(d.s3Url!, "_blank")}>
              <Download className="h-4 w-4 mr-2" /> Download Original
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
