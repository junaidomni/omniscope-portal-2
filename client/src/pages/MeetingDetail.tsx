import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Calendar, User, Building2, MapPin, ArrowLeft, AlertTriangle, TrendingUp, Target, Mail, Download, FileText, Quote, CheckSquare, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Link, useParams } from "wouter";
import { SendRecapDialog } from "@/components/SendRecapDialog";
import { useState } from "react";
import { toast } from "sonner";

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated } = useAuth();
  const [sendRecapOpen, setSendRecapOpen] = useState(false);
  
  const { data: meeting, isLoading } = trpc.meetings.getById.useQuery(
    { id: Number(id) },
    { enabled: isAuthenticated && !!id }
  );

  const { data: tasks } = trpc.meetings.getTasks.useQuery(
    { meetingId: Number(id) },
    { enabled: isAuthenticated && !!id }
  );

  // Generate recap for download
  const generateRecapMutation = trpc.recap.generate.useMutation();

  const handleDownloadReport = async () => {
    if (!meeting) return;

    // If branded report URL exists, open it directly
    if (meeting.brandedReportUrl) {
      window.open(meeting.brandedReportUrl, '_blank');
      return;
    }

    // Otherwise generate and download HTML recap
    try {
      const recap = await generateRecapMutation.mutateAsync({ meetingId: meeting.id });
      const blob = new Blob([recap.htmlBody], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `omniscope-report-${meeting.id}.html`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Report downloaded');
    } catch {
      toast.error('Failed to generate report');
    }
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
        <Link href="/">
          <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  const participants = JSON.parse(meeting.participants || '[]');
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

  const reportTitle = organizations.length > 0 ? organizations.join(', ') : 'Meeting Report';

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Back Button */}
      <Link href="/">
        <Button variant="ghost" size="sm" className="mb-6 text-zinc-400 hover:text-white hover:bg-zinc-800">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </Link>

      {/* OmniScope Branded Report Header */}
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 border border-zinc-800 rounded-xl overflow-hidden mb-8">
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
          <h1 className="text-3xl font-bold text-white mb-4">{reportTitle}</h1>
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

        {/* Action Buttons */}
        <div className="px-8 pb-6 flex items-center gap-3">
          <Button
            onClick={handleDownloadReport}
            disabled={generateRecapMutation.isPending}
            className="bg-yellow-600 hover:bg-yellow-500 text-black font-medium"
          >
            {generateRecapMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download Report
          </Button>
          <Button
            onClick={() => setSendRecapOpen(true)}
            variant="outline"
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
          >
            <Mail className="h-4 w-4 mr-2" />
            Send via Email
          </Button>
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
              <div className="flex flex-wrap gap-2">
                {participants.map((p: string, i: number) => (
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
                  <span className="text-zinc-500 text-sm">No organizations or jurisdictions recorded</span>
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

        {/* Opportunities & Risks - Side by Side */}
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
        meetingTitle={reportTitle}
      />
    </div>
  );
}
