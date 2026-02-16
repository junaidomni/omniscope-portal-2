import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft, TrendingUp, Download, Loader2, Send, Eye,
  ArrowUp, ArrowRight, ArrowDown, CheckCircle2,
  AlertTriangle, Lightbulb, Quote, Building2, Flag,
  Calendar, FileText, Clock
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

// ============================================================================
// PRIORITY BADGE
// ============================================================================

function PriorityBadge({ priority }: { priority: string }) {
  const config: Record<string, { icon: any; color: string; bg: string }> = {
    high: { icon: ArrowUp, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
    medium: { icon: ArrowRight, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
    low: { icon: ArrowDown, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  };
  const c = config[priority] || config.medium;
  const Icon = c.icon;
  return (
    <Badge variant="outline" className={`${c.bg} ${c.color} text-xs py-0 gap-1`}>
      <Icon className="h-3 w-3" />
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </Badge>
  );
}

// ============================================================================
// STAT BOX
// ============================================================================

function StatBox({ label, value, accent }: { label: string; value: number; accent?: "red" | "yellow" | "green" }) {
  return (
    <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
      <p className={`text-3xl font-bold ${
        accent === "red" ? "text-red-400" :
        accent === "yellow" ? "text-yellow-400" :
        accent === "green" ? "text-emerald-400" : "text-white"
      }`}>{value}</p>
      <p className="text-xs text-zinc-500 mt-1">{label}</p>
    </div>
  );
}

// ============================================================================
// TASK ROW FOR REPORTS
// ============================================================================

function TaskReportRow({ task }: { task: any }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
      <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
        task.status === "in_progress" ? "bg-yellow-500" : "bg-zinc-600"
      }`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white">{task.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {task.assignedName && (
            <span className="text-xs text-zinc-500">{task.assignedName}</span>
          )}
          {task.category && (
            <span className="text-xs text-zinc-600">· {task.category}</span>
          )}
          {task.dueDate && (
            <span className={`text-xs ${
              new Date(task.dueDate) < new Date() ? "text-red-400" : "text-zinc-600"
            }`}>
              · Due {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>
      <PriorityBadge priority={task.priority} />
      <Badge variant="outline" className={`text-xs py-0 ${
        task.status === "in_progress" ? "border-yellow-600/30 text-yellow-500" : "border-zinc-700 text-zinc-500"
      }`}>
        {task.status === "in_progress" ? "In Progress" : "Open"}
      </Badge>
    </div>
  );
}

// ============================================================================
// EMAIL REPORT BUTTON
// ============================================================================

function EmailReportButton({ reportContent }: { reportContent: string }) {
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSendEmail = async () => {
    if (!emailTo.trim()) {
      toast.error("Please enter an email address");
      return;
    }
    setIsSending(true);
    try {
      await navigator.clipboard.writeText(reportContent);
      toast.success("Report copied to clipboard. Paste into your email client.", { duration: 5000 });
      setShowEmailDialog(false);
    } catch {
      toast.error("Failed to prepare email");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowEmailDialog(true)}
        className="border-zinc-700 text-zinc-400 hover:text-white hover:border-yellow-600/30"
      >
        <Send className="h-3.5 w-3.5 mr-1.5" />
        Email Report
      </Button>

      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Send className="h-4 w-4 text-yellow-500" />
              Email Weekly Report
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Send to</label>
              <Input
                placeholder="email@example.com"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <p className="text-xs text-zinc-500">
              The full intelligence report will be copied to your clipboard for pasting into your email client.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowEmailDialog(false)} className="text-zinc-400">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSendEmail}
                disabled={isSending}
                className="bg-yellow-600 hover:bg-yellow-500 text-black"
              >
                {isSending ? "Preparing..." : "Copy & Send"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================================
// WEEKLY REPORT PAGE
// ============================================================================

export default function WeeklyReport() {
  const { data: summary, isLoading } = trpc.analytics.weeklySummary.useQuery({});
  const [view, setView] = useState<"overview" | "breakdown">("overview");
  const [isExporting, setIsExporting] = useState(false);
  const exportMutation = trpc.export.weeklySummary.useMutation();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportMutation.mutateAsync({});
      const blob = new Blob([result.content], { type: 'text/markdown' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Weekly report exported');
    } catch {
      toast.error('Failed to export report');
    } finally {
      setIsExporting(false);
    }
  };

  const buildReportText = () => {
    if (!summary) return "";
    let text = `OMNISCOPE WEEKLY INTELLIGENCE REPORT\n`;
    text += `${new Date(summary.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(summary.weekEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}\n\n`;
    text += `═══════════════════════════════════════\n\n`;
    text += `OVERVIEW\n`;
    text += `• Meetings: ${summary.meetingCount}\n`;
    text += `• Unique Contacts: ${summary.uniqueParticipants}\n`;
    text += `• Organizations: ${summary.uniqueOrganizations}\n`;
    text += `• Tasks Created: ${summary.tasksCreated}\n`;
    text += `• Tasks Completed: ${summary.tasksCompleted}\n`;
    text += `• Open Tasks: ${summary.openTasksCount}\n\n`;

    if (summary.meetings && summary.meetings.length > 0) {
      text += `MEETING SUMMARIES\n`;
      text += `─────────────────\n`;
      summary.meetings.forEach(m => {
        text += `\n▸ ${m.title} — ${new Date(m.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}\n`;
        text += `  Participants: ${m.participants.join(', ')}\n`;
        text += `  Summary: ${m.summary}\n`;
      });
      text += `\n`;
    }

    if (summary.allTasks && summary.allTasks.length > 0) {
      text += `ACTIVE TASKS\n`;
      text += `─────────────\n`;
      const high = summary.allTasks.filter(t => t.priority === "high");
      const med = summary.allTasks.filter(t => t.priority === "medium");
      const low = summary.allTasks.filter(t => t.priority === "low");
      if (high.length > 0) {
        text += `\nHIGH PRIORITY (${high.length})\n`;
        high.forEach(t => { text += `  • ${t.title}${t.assignedName ? ` → ${t.assignedName}` : ''}\n`; });
      }
      if (med.length > 0) {
        text += `\nMEDIUM PRIORITY (${med.length})\n`;
        med.forEach(t => { text += `  • ${t.title}${t.assignedName ? ` → ${t.assignedName}` : ''}\n`; });
      }
      if (low.length > 0) {
        text += `\nLOW PRIORITY (${low.length})\n`;
        low.forEach(t => { text += `  • ${t.title}${t.assignedName ? ` → ${t.assignedName}` : ''}\n`; });
      }
    }

    text += `\n═══════════════════════════════════════\n`;
    text += `Generated by OmniScope Intelligence Portal\n`;
    return text;
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Skeleton className="h-8 w-8 bg-zinc-800/50 rounded" />
          <Skeleton className="h-8 w-64 bg-zinc-800/50" />
        </div>
        <div className="grid grid-cols-5 gap-3 mb-6">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20 bg-zinc-800/50 rounded-xl" />)}
        </div>
        <div className="space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-24 bg-zinc-800/50 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <Link href="/meetings">
          <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Meetings
          </Button>
        </Link>
        <div className="text-center py-20">
          <TrendingUp className="h-12 w-12 mx-auto mb-3 text-zinc-700" />
          <p className="text-zinc-500">No data available for this week</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Back Navigation */}
      <Link href="/meetings">
        <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Meetings
        </Button>
      </Link>

      {/* Page Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-yellow-600/20 flex items-center justify-center">
            <TrendingUp className="h-6 w-6 text-yellow-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Weekly Intelligence Report</h1>
            <p className="text-sm text-zinc-500 mt-1">
              {new Date(summary.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {' – '}
              {new Date(summary.weekEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <EmailReportButton reportContent={buildReportText()} />
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
            className="border-zinc-700 text-zinc-400 hover:text-white"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2 mb-8">
        <button
          onClick={() => setView("overview")}
          className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
            view === "overview"
              ? "bg-yellow-600/20 text-yellow-500 border border-yellow-600/30"
              : "text-zinc-500 border border-zinc-800 hover:border-zinc-700"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setView("breakdown")}
          className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
            view === "breakdown"
              ? "bg-yellow-600/20 text-yellow-500 border border-yellow-600/30"
              : "text-zinc-500 border border-zinc-800 hover:border-zinc-700"
          }`}
        >
          <Eye className="h-3.5 w-3.5 inline mr-1.5" />
          Full Breakdown
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        <StatBox label="Meetings" value={summary.meetingCount} />
        <StatBox label="Contacts" value={summary.uniqueParticipants} />
        <StatBox label="Tasks Created" value={summary.tasksCreated} />
        <StatBox label="Tasks Done" value={summary.tasksCompleted} accent="green" />
        <StatBox label="Open Tasks" value={summary.openTasksCount} accent={summary.openTasksCount > 0 ? "red" : undefined} />
      </div>

      {/* Daily Breakdown Bar Chart */}
      <div className="mb-8">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Daily Breakdown</h2>
        <div className="flex items-end gap-3 h-28 p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/50">
          {summary.dailyBreakdown.map((day, i) => {
            const maxCount = Math.max(...summary.dailyBreakdown.map(d => d.meetingCount), 1);
            const height = (day.meetingCount / maxCount) * 100;
            const dayLabel = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' });
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-zinc-400 font-medium">{day.meetingCount}</span>
                <div className="w-full rounded-t bg-zinc-800 relative" style={{ height: '70px' }}>
                  <div
                    className="absolute bottom-0 w-full rounded-t bg-gradient-to-t from-yellow-600/80 to-yellow-500/60"
                    style={{ height: `${height}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-600">{dayLabel}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Verticals */}
      {(summary.topSectors.length > 0 || summary.topJurisdictions.length > 0) && (
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Active Verticals</h2>
          <div className="space-y-3">
            {summary.topSectors.map(s => (
              <div key={s.sector} className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">{s.sector}</span>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-24 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-600 rounded-full" style={{ width: `${Math.min((s.count / summary.meetingCount) * 100, 100)}%` }} />
                  </div>
                  <span className="text-xs text-zinc-500 w-6 text-right">{s.count}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {summary.topJurisdictions.map(j => (
              <Badge key={j.jurisdiction} variant="outline" className="border-zinc-700 text-zinc-400 text-xs px-3 py-1">
                {j.jurisdiction} ({j.count})
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Key Opportunities */}
      {summary.keyOpportunities.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5 mb-4">
            <Lightbulb className="h-3.5 w-3.5 text-green-500" /> Key Opportunities
          </h2>
          <div className="space-y-2">
            {summary.keyOpportunities.slice(0, view === "breakdown" ? 20 : 5).map((opp, i) => (
              <p key={i} className="text-sm text-zinc-400 flex items-start gap-2 p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                <span className="text-green-500 mt-0.5 flex-shrink-0">▲</span>
                {opp}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Key Risks */}
      {summary.keyRisks.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5 mb-4">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500" /> Key Risks
          </h2>
          <div className="space-y-2">
            {summary.keyRisks.slice(0, view === "breakdown" ? 20 : 5).map((risk, i) => (
              <p key={i} className="text-sm text-zinc-400 flex items-start gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                <span className="text-red-500 mt-0.5 flex-shrink-0">▼</span>
                {risk}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Full Breakdown: All Meetings + Tasks */}
      {view === "breakdown" && (
        <>
          {summary.meetings && summary.meetings.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
                All Meetings This Week ({summary.meetings.length})
              </h2>
              <div className="space-y-3">
                {summary.meetings.map(m => (
                  <Link key={m.id} href={`/meeting/${m.id}`}>
                    <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-yellow-600/30 cursor-pointer transition-all">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white">{m.title}</p>
                          <p className="text-xs text-yellow-600/80 mt-1">{m.participants.join(', ')}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                          <span className="text-xs text-zinc-500">
                            {new Date(m.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                          <Badge variant="outline" className="border-zinc-800 text-zinc-500 text-xs">{m.sourceType}</Badge>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-400 mt-2 line-clamp-2">{m.summary}</p>
                      {m.keyHighlights.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {m.keyHighlights.slice(0, 3).map((h, i) => (
                            <p key={i} className="text-xs text-zinc-500 flex items-start gap-1.5">
                              <span className="text-yellow-600 mt-0.5">•</span>
                              {h}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Tasks by Priority */}
          {summary.allTasks && summary.allTasks.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Active Tasks ({summary.allTasks.length})</h2>
              <div className="space-y-4">
                {summary.allTasks.filter(t => t.priority === "high").length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-red-400 flex items-center gap-1.5">
                      <Flag className="h-3 w-3" /> High Priority ({summary.allTasks.filter(t => t.priority === "high").length})
                    </p>
                    {summary.allTasks.filter(t => t.priority === "high").map(t => (
                      <TaskReportRow key={t.id} task={t} />
                    ))}
                  </div>
                )}
                {summary.allTasks.filter(t => t.priority === "medium").length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-yellow-400 flex items-center gap-1.5">
                      <ArrowRight className="h-3 w-3" /> Medium Priority ({summary.allTasks.filter(t => t.priority === "medium").length})
                    </p>
                    {summary.allTasks.filter(t => t.priority === "medium").map(t => (
                      <TaskReportRow key={t.id} task={t} />
                    ))}
                  </div>
                )}
                {summary.allTasks.filter(t => t.priority === "low").length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-blue-400 flex items-center gap-1.5">
                      <ArrowDown className="h-3 w-3" /> Low Priority ({summary.allTasks.filter(t => t.priority === "low").length})
                    </p>
                    {summary.allTasks.filter(t => t.priority === "low").map(t => (
                      <TaskReportRow key={t.id} task={t} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Overview Mode: Meeting Summaries */}
      {view === "overview" && summary.meetings && summary.meetings.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Meeting Summaries ({summary.meetings.length})</h2>
          <div className="space-y-3">
            {summary.meetings.map(m => (
              <Link key={m.id} href={`/meeting/${m.id}`}>
                <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-yellow-600/30 cursor-pointer transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{m.title}</p>
                      <p className="text-xs text-yellow-600/80 mt-1">{m.participants.join(', ')}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <span className="text-xs text-zinc-500">
                        {new Date(m.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                      <Badge variant="outline" className="border-zinc-800 text-zinc-500 text-xs">{m.sourceType}</Badge>
                    </div>
                  </div>
                  {m.organizations && m.organizations.length > 0 && (
                    <p className="text-xs text-zinc-500 mt-1">
                      <Building2 className="h-3 w-3 inline mr-1" />
                      {m.organizations.join(', ')}
                    </p>
                  )}
                  <p className="text-xs text-zinc-400 mt-2 line-clamp-2">{m.summary}</p>
                  {m.keyHighlights && m.keyHighlights.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {m.keyHighlights.slice(0, 2).map((h, i) => (
                        <p key={i} className="text-xs text-zinc-500 flex items-start gap-1.5">
                          <span className="text-yellow-600 mt-0.5">•</span>
                          {h}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Overview Mode: Task Count Summary */}
      {view === "overview" && summary.allTasks && summary.allTasks.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Task Summary</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 text-center">
              <p className="text-2xl font-bold text-red-400">{summary.allTasks.filter(t => t.priority === "high").length}</p>
              <p className="text-xs text-zinc-500 mt-1">High Priority</p>
            </div>
            <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/10 text-center">
              <p className="text-2xl font-bold text-yellow-400">{summary.allTasks.filter(t => t.priority === "medium").length}</p>
              <p className="text-xs text-zinc-500 mt-1">Medium Priority</p>
            </div>
            <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 text-center">
              <p className="text-2xl font-bold text-blue-400">{summary.allTasks.filter(t => t.priority === "low").length}</p>
              <p className="text-xs text-zinc-500 mt-1">Low Priority</p>
            </div>
          </div>
          <button
            onClick={() => setView("breakdown")}
            className="w-full text-center text-sm text-yellow-600 hover:text-yellow-500 py-3 mt-3 transition-colors"
          >
            View Full Breakdown →
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-zinc-800 pt-6 mt-8 text-center">
        <p className="text-xs text-zinc-600">Generated by OmniScope Intelligence Portal</p>
      </div>
    </div>
  );
}
