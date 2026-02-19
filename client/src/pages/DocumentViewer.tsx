import { useState, useEffect, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useRoute, useLocation } from "wouter";
import { toast } from "sonner";
import {
  FileText, FileSpreadsheet, Presentation, ArrowLeft, ExternalLink,
  Building2, User, Calendar, Tag, Link2, MessageSquare, Plus,
  Loader2, X, Send, Trash2, Star, Download, Edit3, ChevronRight,
  MoreHorizontal, Clock, Shield, Eye, Bookmark, StickyNote, Info,
  Maximize2, Minimize2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";

// ─── Constants ───
const COLLECTION_LABELS: Record<string, { label: string; color: string }> = {
  company_repo: { label: "Company Repository", color: "text-yellow-500" },
  personal: { label: "Personal", color: "text-blue-400" },
  counterparty: { label: "Counterparty Files", color: "text-purple-400" },
  template: { label: "Templates", color: "text-emerald-400" },
  transaction: { label: "Transactions", color: "text-orange-400" },
  signed: { label: "Signed Documents", color: "text-green-400" },
};

const CATEGORY_LABELS: Record<string, string> = {
  agreement: "Agreement", compliance: "Compliance", intake: "Intake Form",
  profile: "Profile", strategy: "Strategy", operations: "Operations",
  transaction: "Transaction", correspondence: "Correspondence",
  template: "Template", other: "Other",
};

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" },
  active: { label: "Active", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  pending_signature: { label: "Pending", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  sent: { label: "Sent", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  signed: { label: "Signed", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  archived: { label: "Archived", color: "bg-zinc-600/20 text-zinc-500 border-zinc-600/30" },
};

function formatDate(date: Date | string | null) {
  if (!date) return "—";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Sidebar Panel Types ───
type SidePanel = "info" | "notes" | "links" | null;

export default function DocumentViewer() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/vault/doc/:id");
  const docId = params?.id ? parseInt(params.id) : null;

  const [sidePanel, setSidePanel] = useState<SidePanel>("info");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [entitySearch, setEntitySearch] = useState("");

  // Queries
  const doc = trpc.vault.getDocument.useQuery(
    { id: docId! },
    { enabled: !!docId }
  );

  const notes = trpc.vault.getNotes.useQuery(
    { documentId: docId! },
    { enabled: !!docId }
  );

  // Google Doc HTML export for internal viewing
  const docHtml = trpc.drive.exportDocHtml.useQuery(
    { docId: doc.data?.googleFileId! },
    { enabled: !!doc.data?.googleFileId && doc.data?.sourceType === "google_doc" }
  );

  // Google Sheet data for internal viewing
  const sheetData = trpc.drive.readSheetData.useQuery(
    { spreadsheetId: doc.data?.googleFileId!, range: "Sheet1!A1:Z200" },
    { enabled: !!doc.data?.googleFileId && doc.data?.sourceType === "google_sheet" }
  );

  // Entity search for linking
  const companyResults = trpc.companies.list.useQuery(
    { search: entitySearch, limit: 5 },
    { enabled: entitySearch.length >= 2 }
  );
  const contactResults = trpc.contacts.searchByName.useQuery(
    { query: entitySearch, limit: 5 },
    { enabled: entitySearch.length >= 2 }
  );

  // Mutations
  const addNote = trpc.vault.addNote.useMutation({
    onSuccess: () => {
      setNoteText("");
      notes.refetch();
      toast.success("Note added");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteNote = trpc.vault.deleteNote.useMutation({
    onSuccess: () => {
      notes.refetch();
      toast.success("Note deleted");
    },
  });

  const linkEntity = trpc.vault.addEntityLink.useMutation({
    onSuccess: () => {
      doc.refetch();
      setLinkDialogOpen(false);
      setEntitySearch("");
      toast.success("Entity linked");
    },
    onError: (err) => toast.error(err.message),
  });

  const unlinkEntity = trpc.vault.removeEntityLink.useMutation({
    onSuccess: () => {
      doc.refetch();
      toast.success("Entity unlinked");
    },
  });

  const toggleFavorite = trpc.vault.toggleFavorite.useMutation({
    onSuccess: (data) => {
      doc.refetch();
      toast.success(data.isFavorited ? "Added to favorites" : "Removed from favorites");
    },
  });

  if (!docId) {
    return (
      <div className="h-full flex items-center justify-center bg-black">
        <p className="text-zinc-500">Document not found</p>
      </div>
    );
  }

  if (doc.isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-600" />
      </div>
    );
  }

  if (!doc.data) {
    return (
      <div className="h-full flex items-center justify-center bg-black">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">Document not found</p>
          <Button variant="outline" onClick={() => setLocation("/vault")} className="border-zinc-700 text-zinc-300">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Vault
          </Button>
        </div>
      </div>
    );
  }

  const d = doc.data;
  const status = STATUS_BADGES[d.status] || STATUS_BADGES.active;
  const isGoogleDoc = d.sourceType === "google_doc";
  const isGoogleSheet = d.sourceType === "google_sheet";
  const isGoogleSlide = d.sourceType === "google_slide";
  const isPdf = d.sourceType === "pdf" || d.sourceType === "uploaded";

  const googleLink = d.googleFileId
    ? isGoogleSheet
      ? `https://docs.google.com/spreadsheets/d/${d.googleFileId}/edit`
      : isGoogleSlide
        ? `https://docs.google.com/presentation/d/${d.googleFileId}/edit`
        : `https://docs.google.com/document/d/${d.googleFileId}/edit`
    : null;

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addNote.mutate({ documentId: docId!, content: noteText.trim() });
  };

  const handleLinkEntity = (entityType: "company" | "contact", entityId: number) => {
    linkEntity.mutate({ documentId: docId!, entityType, entityId, linkType: "related" as const });
  };

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Top Toolbar */}
      <div className="shrink-0 h-14 px-4 border-b border-zinc-800/60 flex items-center justify-between bg-zinc-950">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/vault")}
            className="text-zinc-400 hover:text-white shrink-0"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Vault
          </Button>

          <div className="h-5 w-px bg-zinc-800" />

          <div className="flex items-center gap-2 min-w-0">
            {isGoogleDoc && <FileText className="h-4 w-4 text-blue-400 shrink-0" />}
            {isGoogleSheet && <FileSpreadsheet className="h-4 w-4 text-green-400 shrink-0" />}
            {isGoogleSlide && <Presentation className="h-4 w-4 text-orange-400 shrink-0" />}
            {isPdf && <FileText className="h-4 w-4 text-red-400 shrink-0" />}
            <h1 className="text-sm font-semibold text-white truncate">{d.title}</h1>
            <Badge variant="outline" className={`text-[10px] shrink-0 ${status.color}`}>{status.label}</Badge>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Side panel toggles */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidePanel(sidePanel === "info" ? null : "info")}
            className={`text-xs ${sidePanel === "info" ? "text-yellow-500 bg-yellow-500/10" : "text-zinc-400 hover:text-white"}`}
          >
            <Info className="h-4 w-4 mr-1" /> Info
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidePanel(sidePanel === "notes" ? null : "notes")}
            className={`text-xs ${sidePanel === "notes" ? "text-yellow-500 bg-yellow-500/10" : "text-zinc-400 hover:text-white"}`}
          >
            <StickyNote className="h-4 w-4 mr-1" /> Notes
            {notes.data && notes.data.length > 0 && (
              <span className="ml-1 text-[10px] bg-zinc-800 px-1.5 rounded-full">{notes.data.length}</span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidePanel(sidePanel === "links" ? null : "links")}
            className={`text-xs ${sidePanel === "links" ? "text-yellow-500 bg-yellow-500/10" : "text-zinc-400 hover:text-white"}`}
          >
            <Link2 className="h-4 w-4 mr-1" /> Links
            {d.entityLinks && d.entityLinks.length > 0 && (
              <span className="ml-1 text-[10px] bg-zinc-800 px-1.5 rounded-full">{d.entityLinks.length}</span>
            )}
          </Button>

          <div className="h-5 w-px bg-zinc-800 mx-1" />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleFavorite.mutate({ documentId: docId! })}
            className="text-zinc-400 hover:text-yellow-500"
          >
            <Star className="h-4 w-4" />
          </Button>

          {googleLink && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(googleLink, "_blank")}
              className="text-zinc-400 hover:text-white"
            >
              <ExternalLink className="h-4 w-4 mr-1" /> Google
            </Button>
          )}

          {d.s3Url && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(d.s3Url!, "_blank")}
              className="text-zinc-400 hover:text-white"
            >
              <Download className="h-4 w-4" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setIsFullscreen(!isFullscreen); setSidePanel(isFullscreen ? "info" : null); }}
            className="text-zinc-400 hover:text-white"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Document Content */}
        <div className="flex-1 overflow-auto bg-zinc-950">
          {/* Google Doc - render HTML internally */}
          {isGoogleDoc && (
            <div className="h-full">
              {docHtml.isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-yellow-600 mx-auto mb-3" />
                    <p className="text-sm text-zinc-500">Loading document...</p>
                  </div>
                </div>
              ) : docHtml.data?.html ? (
                <div className="max-w-4xl mx-auto py-8 px-6">
                  <div
                    className="google-doc-content prose prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: sanitizeGoogleHtml(docHtml.data.html) }}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <FileText className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
                    <p className="text-sm text-zinc-500 mb-4">Unable to load document content</p>
                    {googleLink && (
                      <Button variant="outline" size="sm" onClick={() => window.open(googleLink, "_blank")} className="border-zinc-700 text-zinc-300">
                        <ExternalLink className="h-4 w-4 mr-2" /> Open in Google Docs
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Google Sheet - render table internally */}
          {isGoogleSheet && (
            <div className="h-full overflow-auto">
              {sheetData.isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-yellow-600 mx-auto mb-3" />
                    <p className="text-sm text-zinc-500">Loading spreadsheet...</p>
                  </div>
                </div>
              ) : sheetData.data?.values && sheetData.data.values.length > 0 ? (
                <div className="p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-green-400" />
                    <span className="text-sm font-medium text-zinc-300">{sheetData.data.sheetTitle}</span>
                    <span className="text-xs text-zinc-600">{sheetData.data.values.length} rows</span>
                  </div>
                  <div className="overflow-auto border border-zinc-800 rounded-lg">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-zinc-900/80">
                          {sheetData.data.values[0]?.map((header: string, i: number) => (
                            <th key={i} className="px-3 py-2 text-left text-xs font-semibold text-zinc-400 border-b border-zinc-800 whitespace-nowrap">
                              {header || `Column ${i + 1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sheetData.data.values.slice(1).map((row: string[], rowIdx: number) => (
                          <tr key={rowIdx} className="hover:bg-zinc-900/40 border-b border-zinc-800/40">
                            {row.map((cell: string, cellIdx: number) => (
                              <td key={cellIdx} className="px-3 py-2 text-zinc-300 whitespace-nowrap">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <FileSpreadsheet className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
                    <p className="text-sm text-zinc-500 mb-4">Unable to load spreadsheet data</p>
                    {googleLink && (
                      <Button variant="outline" size="sm" onClick={() => window.open(googleLink, "_blank")} className="border-zinc-700 text-zinc-300">
                        <ExternalLink className="h-4 w-4 mr-2" /> Open in Google Sheets
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Google Slide - embed iframe */}
          {isGoogleSlide && d.googleFileId && (
            <div className="h-full flex items-center justify-center p-4">
              <iframe
                src={`https://docs.google.com/presentation/d/${d.googleFileId}/embed?start=false&loop=false&delayms=3000`}
                className="w-full max-w-5xl aspect-video rounded-lg border border-zinc-800"
                allowFullScreen
              />
            </div>
          )}

          {/* PDF / Uploaded - embed or download */}
          {isPdf && d.s3Url && (
            <div className="h-full">
              <iframe
                src={d.s3Url}
                className="w-full h-full"
                title={d.title}
              />
            </div>
          )}

          {/* Fallback for no content */}
          {!isGoogleDoc && !isGoogleSheet && !isGoogleSlide && !isPdf && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FileText className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
                <p className="text-sm text-zinc-500 mb-2">No preview available</p>
                <p className="text-xs text-zinc-600 mb-4">This document type doesn't support internal viewing</p>
                {googleLink && (
                  <Button variant="outline" size="sm" onClick={() => window.open(googleLink, "_blank")} className="border-zinc-700 text-zinc-300">
                    <ExternalLink className="h-4 w-4 mr-2" /> Open Externally
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Side Panel */}
        {sidePanel && !isFullscreen && (
          <div className="w-[360px] shrink-0 border-l border-zinc-800 bg-zinc-950 flex flex-col overflow-hidden">
            {/* Panel Header */}
            <div className="shrink-0 h-12 px-4 border-b border-zinc-800/60 flex items-center justify-between">
              <span className="text-sm font-semibold text-white capitalize">{sidePanel}</span>
              <Button variant="ghost" size="sm" onClick={() => setSidePanel(null)} className="text-zinc-500 hover:text-white h-7 w-7 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-auto p-4">
              {/* Info Panel */}
              {sidePanel === "info" && (
                <div className="space-y-5">
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
                        <span className="text-zinc-300">{CATEGORY_LABELS[d.category] || d.category}</span>
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
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-500">Created</span>
                        <span className="text-zinc-300">{formatDate(d.createdAt)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-500">Updated</span>
                        <span className="text-zinc-300">{formatDate(d.updatedAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* AI Summary */}
                  {d.aiSummary && (
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">AI Summary</h4>
                      <p className="text-sm text-zinc-400 leading-relaxed">{d.aiSummary}</p>
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
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Notes Panel */}
              {sidePanel === "notes" && (
                <div className="space-y-4">
                  {/* Add note */}
                  <div className="space-y-2">
                    <Textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Add a note about this document..."
                      className="bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600 min-h-[80px] text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAddNote();
                      }}
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-600">Ctrl+Enter to submit</span>
                      <Button
                        size="sm"
                        onClick={handleAddNote}
                        disabled={!noteText.trim() || addNote.isPending}
                        className="bg-yellow-600 hover:bg-yellow-700 text-black text-xs h-7"
                      >
                        {addNote.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                        Add Note
                      </Button>
                    </div>
                  </div>

                  {/* Notes list */}
                  {notes.isLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-16 bg-zinc-800" />
                      <Skeleton className="h-16 bg-zinc-800" />
                    </div>
                  ) : notes.data && notes.data.length > 0 ? (
                    <div className="space-y-3">
                      {notes.data.map((note: any) => (
                        <div key={note.id} className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/60 group">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-zinc-300">{note.userName}</span>
                                <span className="text-[10px] text-zinc-600">{formatDate(note.createdAt)}</span>
                              </div>
                              <p className="text-sm text-zinc-400 whitespace-pre-wrap">{note.content}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteNote.mutate({ noteId: note.id })}
                              className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 h-6 w-6 p-0 shrink-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <StickyNote className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
                      <p className="text-sm text-zinc-500">No notes yet</p>
                      <p className="text-xs text-zinc-600 mt-1">Add notes to track context about this document</p>
                    </div>
                  )}
                </div>
              )}

              {/* Links Panel */}
              {sidePanel === "links" && (
                <div className="space-y-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLinkDialogOpen(true)}
                    className="w-full border-zinc-700 text-zinc-300 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" /> Link Company or Contact
                  </Button>

                  {d.entityLinks && d.entityLinks.length > 0 ? (
                    <div className="space-y-2">
                      {d.entityLinks.map((link: any) => (
                        <div key={link.id} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/60 group">
                          <div className="h-8 w-8 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                            {link.entityType === "company" && <Building2 className="h-4 w-4 text-yellow-500" />}
                            {link.entityType === "contact" && <User className="h-4 w-4 text-blue-400" />}
                            {link.entityType === "meeting" && <Calendar className="h-4 w-4 text-purple-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-zinc-300 capitalize">{link.entityType} #{link.entityId}</p>
                            <Badge variant="outline" className="text-[10px] mt-0.5">{link.linkType}</Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => unlinkEntity.mutate({ id: link.id })}
                            className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 h-6 w-6 p-0 shrink-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Link2 className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
                      <p className="text-sm text-zinc-500">No linked entities</p>
                      <p className="text-xs text-zinc-600 mt-1">Link this document to companies or contacts</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Link Entity Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Link2 className="h-5 w-5 text-yellow-500" /> Link Entity
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={entitySearch}
              onChange={(e) => setEntitySearch(e.target.value)}
              placeholder="Search companies or contacts..."
              className="bg-zinc-900 border-zinc-800 text-white"
              autoFocus
            />
            {entitySearch.length >= 2 && (
              <div className="max-h-60 overflow-auto space-y-1">
                {companyResults.data?.items?.map((c: any) => (
                  <button
                    key={`company-${c.id}`}
                    onClick={() => handleLinkEntity("company", c.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-900 text-left transition-colors"
                  >
                    <Building2 className="h-4 w-4 text-yellow-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{c.name}</p>
                      <p className="text-[10px] text-zinc-500">Company</p>
                    </div>
                  </button>
                ))}
                {contactResults.data?.map((c: any) => (
                  <button
                    key={`contact-${c.id}`}
                    onClick={() => handleLinkEntity("contact", c.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-900 text-left transition-colors"
                  >
                    <User className="h-4 w-4 text-blue-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{c.name}</p>
                      <p className="text-[10px] text-zinc-500">Contact{c.company ? ` · ${c.company}` : ""}</p>
                    </div>
                  </button>
                ))}
                {(!companyResults.data?.items?.length && !contactResults.data?.length) && (
                  <p className="text-sm text-zinc-500 text-center py-4">No results found</p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Sanitize Google Docs exported HTML for safe internal rendering.
 * Strips <html>, <head>, <body> wrappers and adjusts styles for dark theme.
 */
function sanitizeGoogleHtml(html: string): string {
  // Extract body content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let content = bodyMatch ? bodyMatch[1] : html;

  // Remove Google's tracking images
  content = content.replace(/<img[^>]*googleusercontent[^>]*>/gi, "");

  // Inject dark theme overrides
  const styleOverrides = `
    <style>
      .google-doc-content { color: #d4d4d8 !important; }
      .google-doc-content * { color: inherit !important; background-color: transparent !important; }
      .google-doc-content table { border-color: #3f3f46 !important; }
      .google-doc-content td, .google-doc-content th { border-color: #3f3f46 !important; padding: 8px !important; }
      .google-doc-content a { color: #eab308 !important; text-decoration: underline; }
      .google-doc-content h1, .google-doc-content h2, .google-doc-content h3, .google-doc-content h4 { color: #fafafa !important; }
      .google-doc-content p { margin-bottom: 0.5em; line-height: 1.7; }
      .google-doc-content img { max-width: 100%; border-radius: 8px; }
      .google-doc-content hr { border-color: #3f3f46 !important; }
      .google-doc-content ul, .google-doc-content ol { padding-left: 1.5em; }
      .google-doc-content li { margin-bottom: 0.25em; }
    </style>
  `;

  return styleOverrides + content;
}
