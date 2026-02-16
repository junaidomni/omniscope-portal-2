import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Calendar, User, Building2, MapPin, ArrowLeft, AlertTriangle, TrendingUp, Target, Mail, Download, FileText, Quote, CheckSquare, Clock, Tag, X, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Link, useParams, useLocation } from "wouter";
import { SendRecapDialog } from "@/components/SendRecapDialog";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

const PRESET_CATEGORIES = [
  "Gold", "BTC", "Private Placement", "Real Estate", "Stablecoin",
  "Oil & Energy", "Little Miracles", "Payment Rails", "Compliance", "Partnership"
];

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [sendRecapOpen, setSendRecapOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  
  const { data: meeting, isLoading } = trpc.meetings.getById.useQuery(
    { id: Number(id) },
    { enabled: isAuthenticated && !!id }
  );

  const { data: tasks } = trpc.meetings.getTasks.useQuery(
    { meetingId: Number(id) },
    { enabled: isAuthenticated && !!id }
  );

  const { data: meetingContacts } = trpc.meetings.getContacts.useQuery(
    { meetingId: Number(id) },
    { enabled: isAuthenticated && !!id }
  );

  const { data: categories = [], refetch: refetchCategories } = trpc.meetingCategories.getForMeeting.useQuery(
    { meetingId: Number(id) },
    { enabled: isAuthenticated && !!id }
  );

  const addCategoryMutation = trpc.meetingCategories.add.useMutation({
    onSuccess: () => {
      refetchCategories();
      setNewCategory("");
      setShowCategoryInput(false);
    },
    onError: () => toast.error("Failed to add category"),
  });

  const removeCategoryMutation = trpc.meetingCategories.remove.useMutation({
    onSuccess: () => refetchCategories(),
    onError: () => toast.error("Failed to remove category"),
  });

  const deleteMutation = trpc.meetings.delete.useMutation({
    onSuccess: () => {
      toast.success('Meeting deleted');
      setLocation('/meetings');
    },
    onError: () => toast.error('Failed to delete meeting'),
  });

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadReport = async () => {
    if (!meeting) return;
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/meeting/${meeting.id}/pdf`);
      if (!response.ok) throw new Error('Failed to generate PDF');
      const blob = await response.blob();
      
      // Extract filename from Content-Disposition header, or build from meeting data
      let filename = 'OmniScope Intelligence Report.pdf';
      const disposition = response.headers.get('Content-Disposition');
      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      } else if (meeting.meetingTitle) {
        const dateStr = new Date(meeting.meetingDate).toISOString().split('T')[0];
        const cleanTitle = (meeting.meetingTitle || 'Meeting').replace(/[^a-zA-Z0-9\s-]/g, '').trim();
        filename = `OmniScope Intelligence Report - ${cleanTitle} - ${dateStr}.pdf`;
      }
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('PDF report downloaded');
    } catch {
      toast.error('Failed to generate PDF report');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleAddCategory = (category: string) => {
    const cat = category.trim();
    if (!cat || !meeting) return;
    if (categories.some((c: any) => c.category === cat)) {
      toast.error("Category already added");
      return;
    }
    addCategoryMutation.mutate({ meetingId: meeting.id, category: cat });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-600" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <FileText className="h-16 w-16 text-zinc-700 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Meeting not found</h2>
        <p className="text-zinc-400 mb-6">This meeting may have been removed or the ID is invalid.</p>
        <Link href="/meetings">
          <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Meetings
          </Button>
        </Link>
      </div>
    );
  }

  const rawParticipants = JSON.parse(meeting.participants || '[]');
  const participants = Array.from(new Set(rawParticipants as string[]));
  const organizations = JSON.parse(meeting.organizations || '[]');
  const jurisdictions = JSON.parse(meeting.jurisdictions || '[]');
  const strategicHighlights = JSON.parse(meeting.strategicHighlights || '[]');
  const opportunities = JSON.parse(meeting.opportunities || '[]');
  const risks = JSON.parse(meeting.risks || '[]');
  const keyQuotes = JSON.parse(meeting.keyQuotes || '[]');

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const displayTitle = meeting.meetingTitle || (organizations.length > 0 ? organizations.join(', ') : 'Meeting Report');

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Back Button */}
      <Link href="/meetings">
        <Button variant="ghost" size="sm" className="mb-6 text-zinc-400 hover:text-white hover:bg-zinc-800">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Meetings
        </Button>
      </Link>

      {/* OmniScope Branded Report Header */}
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 border border-zinc-800 rounded-xl overflow-hidden mb-6">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <img src="/omniscope-only.png" alt="OmniScope" className="h-7" />
            <span className="text-zinc-500 text-xs tracking-[0.25em] font-medium">ALL MARKETS. ONE SCOPE.</span>
          </div>
          <Badge variant="outline" className="border-yellow-600/30 bg-yellow-600/10 text-yellow-600 text-xs tracking-wider font-semibold">
            INTELLIGENCE REPORT
          </Badge>
        </div>

        {/* Report Title & Meta */}
        <div className="px-8 py-8">
          <h1 className="text-3xl font-bold text-white mb-2">{displayTitle}</h1>
          {participants.length > 0 && (
            <p className="text-sm text-yellow-600/80 mb-4">{participants.join(', ')}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-zinc-400">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-yellow-600" />
              <span>{formatDate(meeting.meetingDate)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              <span>{formatTime(meeting.meetingDate)}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-yellow-600" />
              <span>Lead: {meeting.primaryLead}</span>
            </div>
            <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs">
              {meeting.sourceType.toUpperCase()}
            </Badge>
          </div>
        </div>

        {/* Categories / Tags */}
        <div className="px-8 pb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="h-4 w-4 text-zinc-500" />
            {categories.map((cat: any) => (
              <Badge
                key={cat.id}
                className="bg-yellow-600/15 text-yellow-500 border border-yellow-600/30 gap-1 pr-1.5"
              >
                {cat.category}
                <button
                  onClick={() => removeCategoryMutation.mutate({ meetingId: meeting.id, category: cat.category })}
                  className="ml-1 hover:text-red-400 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {/* Quick-add preset categories */}
            {!showCategoryInput && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCategoryInput(true)}
                className="text-zinc-500 hover:text-yellow-500 h-6 px-2 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Tag
              </Button>
            )}
            {showCategoryInput && (
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Category name..."
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(newCategory); }
                    if (e.key === 'Escape') { setShowCategoryInput(false); setNewCategory(""); }
                  }}
                  className="h-7 w-36 bg-zinc-800 border-zinc-700 text-white text-xs"
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setShowCategoryInput(false); setNewCategory(""); }}
                  className="text-zinc-500 h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          {/* Preset suggestions */}
          {showCategoryInput && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {PRESET_CATEGORIES
                .filter(p => !categories.some((c: any) => c.category === p))
                .map(preset => (
                  <button
                    key={preset}
                    onClick={() => handleAddCategory(preset)}
                    className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-yellow-500 hover:bg-zinc-700 transition-colors border border-zinc-700/50"
                  >
                    {preset}
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="px-8 pb-6 flex items-center gap-3">
          <Button
            onClick={handleDownloadReport}
            disabled={isDownloading}
            className="bg-yellow-600 hover:bg-yellow-500 text-black font-medium"
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download PDF
          </Button>
          <Button
            onClick={() => setSendRecapOpen(true)}
            variant="outline"
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
          >
            <Mail className="h-4 w-4 mr-2" />
            Send via Email
          </Button>
          <div className="flex-1" />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="border-red-900/50 text-red-400 hover:bg-red-900/20 hover:text-red-300">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-zinc-900 border-zinc-800">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">Delete Meeting</AlertDialogTitle>
                <AlertDialogDescription className="text-zinc-400">
                  This will permanently delete this meeting and all associated tasks. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate({ id: meeting.id })}
                  className="bg-red-600 hover:bg-red-700 text-white"
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete Meeting'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Report Body */}
      <div className="space-y-6">
        {/* Participants & Organizations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                <User className="h-4 w-4" />
                Participants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(meetingContacts && meetingContacts.length > 0) ? (() => {
              // Deduplicate by contact ID
              const seen = new Set<number>();
              const uniqueContacts = meetingContacts.filter((mc: any) => {
                if (seen.has(mc.contact.id)) return false;
                seen.add(mc.contact.id);
                return true;
              });
              return uniqueContacts;
            })().map((mc: any) => {
                  const c = mc.contact;
                  const lastMeetingDate = mc.lastMeetingDate;
                  const daysSince = lastMeetingDate ? Math.floor((Date.now() - new Date(lastMeetingDate).getTime()) / 86400000) : null;
                  return (
                    <Link key={c.id} href={`/contact/${c.id}`}>
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-800/40 border border-zinc-800 hover:border-yellow-600/30 transition-colors cursor-pointer group">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-yellow-600/20 flex items-center justify-center">
                            <span className="text-xs font-bold text-yellow-500">{c.name?.charAt(0)?.toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white group-hover:text-yellow-500 transition-colors">{c.name}</p>
                            {c.organization && <p className="text-xs text-zinc-500">{c.organization}</p>}
                          </div>
                        </div>
                        <div className="text-right">
                          {daysSince !== null && (
                            <p className={`text-xs ${daysSince > 14 ? 'text-red-400' : daysSince > 7 ? 'text-yellow-500' : 'text-zinc-500'}`}>
                              {daysSince === 0 ? 'Today' : daysSince === 1 ? 'Yesterday' : `${daysSince}d ago`}
                            </p>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                }) : participants.map((p: string, i: number) => (
                  <Badge key={i} variant="outline" className="border-zinc-700 bg-zinc-800/50 text-zinc-200">{p}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Organizations & Jurisdictions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {organizations.map((org: string, i: number) => (
                  <Badge key={`org-${i}`} className="bg-yellow-600/10 text-yellow-600 border-yellow-600/20">{org}</Badge>
                ))}
                {jurisdictions.map((j: string, i: number) => (
                  <Badge key={`jur-${i}`} variant="outline" className="border-zinc-700 text-zinc-400">
                    <MapPin className="h-3 w-3 mr-1" />
                    {j}
                  </Badge>
                ))}
                {organizations.length === 0 && jurisdictions.length === 0 && (
                  <span className="text-zinc-500 text-sm">No organizations or jurisdictions identified</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Executive Summary */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-white">Executive Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-zinc-300 leading-relaxed text-[15px]">{meeting.executiveSummary}</p>
          </CardContent>
        </Card>

        {/* Strategic Highlights */}
        {strategicHighlights.length > 0 && (
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                <Target className="h-5 w-5 text-yellow-600" />
                Strategic Highlights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {strategicHighlights.map((highlight: string, i: number) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-yellow-600 flex-shrink-0" />
                    <span className="text-zinc-300 text-[15px]">{highlight}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Opportunities & Risks */}
        {(opportunities.length > 0 || risks.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {opportunities.length > 0 && (
              <Card className="bg-zinc-900/50 border-zinc-800 border-l-2 border-l-green-600">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold text-green-500 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Opportunities
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {opportunities.map((opp: string, i: number) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-green-500 flex-shrink-0" />
                        <span className="text-zinc-300 text-sm">{opp}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {risks.length > 0 && (
              <Card className="bg-zinc-900/50 border-zinc-800 border-l-2 border-l-red-600">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold text-red-400 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Risks & Red Flags
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {risks.map((risk: string, i: number) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0" />
                        <span className="text-zinc-300 text-sm">{risk}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Key Quotes */}
        {keyQuotes.length > 0 && (
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                <Quote className="h-5 w-5 text-yellow-600" />
                Key Quotes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {keyQuotes.map((quote: string, i: number) => (
                  <blockquote key={i} className="border-l-2 border-l-yellow-600 pl-4 py-2 bg-zinc-800/30 rounded-r-lg">
                    <p className="text-zinc-300 italic text-[15px]">&ldquo;{quote}&rdquo;</p>
                  </blockquote>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Items */}
        {tasks && tasks.length > 0 && (
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-yellow-600" />
                Action Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-start gap-4 p-4 rounded-lg bg-zinc-800/30 border border-zinc-800">
                    <div className={`mt-1 h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                      task.priority === 'high' ? 'bg-red-500' :
                      task.priority === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`} />
                    <div className="flex-1">
                      <p className="font-medium text-white text-[15px]">{task.title}</p>
                      {task.description && (
                        <p className="text-sm text-zinc-400 mt-1">{task.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <Badge variant={task.status === 'completed' ? 'default' : 'outline'}
                          className={task.status === 'completed'
                            ? 'bg-green-600/20 text-green-400 border-green-600/30'
                            : 'border-zinc-700 text-zinc-400'
                          }
                        >
                          {task.status.replace('_', ' ')}
                        </Badge>
                        <Badge variant="outline" className={
                          task.priority === 'high' ? 'border-red-600/30 text-red-400' :
                          task.priority === 'medium' ? 'border-yellow-600/30 text-yellow-400' :
                          'border-blue-600/30 text-blue-400'
                        }>
                          {task.priority}
                        </Badge>
                        {task.dueDate && (
                          <span className="text-xs text-zinc-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Due {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Full Transcript */}
        {meeting.fullTranscript && (
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-yellow-600" />
                Full Transcript
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-zinc-800/30 rounded-lg p-6 max-h-96 overflow-y-auto">
                <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{meeting.fullTranscript}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* OmniScope Footer */}
        <div className="text-center py-10 border-t border-zinc-800 mt-8">
          <img src="/omniscope-only.png" alt="OmniScope" className="h-5 mx-auto mb-3 opacity-40" />
          <p className="text-zinc-500 text-sm mb-1">omniscopex.ae</p>
          <p className="text-zinc-600 text-xs">Confidential & Proprietary</p>
        </div>
      </div>

      {/* Send Recap Dialog */}
      <SendRecapDialog
        open={sendRecapOpen}
        onOpenChange={setSendRecapOpen}
        meetingId={meeting.id}
        meetingTitle={displayTitle}
      />
    </div>
  );
}
