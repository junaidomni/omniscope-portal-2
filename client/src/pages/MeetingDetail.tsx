import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Calendar, User, Building2, MapPin, ArrowLeft, AlertTriangle, TrendingUp, Target, Mail } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Link, useParams } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { SendRecapDialog } from "@/components/SendRecapDialog";
import { useState } from "react";

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

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!meeting) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Meeting not found.</p>
            <Link href="/">
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </DashboardLayout>
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
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* OmniScope Branded Header */}
        <div className="bg-gradient-to-r from-zinc-900/50 to-transparent border-b border-zinc-800 -mx-6 px-6 py-6 mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          
          {/* OmniScope Branding */}
          <div className="flex items-center gap-3 mb-6">
            <img src="/omniscope-only.png" alt="OmniScope" className="h-6" />
            <span className="text-zinc-500 text-xs tracking-widest">ALL MARKETS. ONE SCOPE.</span>
          </div>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-sm font-semibold text-yellow-600 mb-2 tracking-wide">INTELLIGENCE REPORT</h1>
              <h2 className="text-3xl font-bold text-foreground mb-3">
                {organizations.length > 0 ? organizations.join(', ') : 'Meeting Report'}
              </h2>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(meeting.meetingDate)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  <span>{meeting.primaryLead}</span>
                </div>
                <Badge variant="outline" className="bg-yellow-600/10 text-yellow-600 border-yellow-600/30">
                  {meeting.sourceType}
                </Badge>
              </div>
            </div>
            <Button 
              onClick={() => setSendRecapOpen(true)}
              className="bg-yellow-600 text-black hover:bg-yellow-500"
            >
              <Mail className="h-4 w-4 mr-2" />
              Send Recap
            </Button>
          </div>

          {/* Send Recap Dialog */}
          <SendRecapDialog
            open={sendRecapOpen}
            onOpenChange={setSendRecapOpen}
            meetingId={meeting.id}
            meetingTitle={organizations.length > 0 ? organizations.join(', ') : 'Meeting Report'}
          />
        </div>

        {/* Executive Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Executive Strategic Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground leading-relaxed">{meeting.executiveSummary}</p>
          </CardContent>
        </Card>

        {/* Participants & Organizations */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Participants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {participants.map((p: string, i: number) => (
                  <Badge key={i} variant="secondary">{p}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {organizations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Organizations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {organizations.map((org: string, i: number) => (
                    <Badge key={i} variant="secondary">{org}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Strategic Highlights */}
        {strategicHighlights.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Strategic Highlights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {strategicHighlights.map((highlight: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span className="text-foreground">{highlight}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Opportunities & Risks */}
        <div className="grid md:grid-cols-2 gap-4">
          {opportunities.length > 0 && (
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <TrendingUp className="h-5 w-5" />
                  Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {opportunities.map((opp: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span className="text-foreground text-sm">{opp}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {risks.length > 0 && (
            <Card className="border-destructive/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Risks & Red Flags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {risks.map((risk: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-destructive mt-1">•</span>
                      <span className="text-foreground text-sm">{risk}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Key Quotes */}
        {keyQuotes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Key Quotes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {keyQuotes.map((quote: string, i: number) => (
                  <blockquote key={i} className="border-l-4 border-primary pl-4 italic text-foreground">
                    "{quote}"
                  </blockquote>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Items */}
        {tasks && tasks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Action Items</CardTitle>
              <CardDescription>Tasks generated from this meeting</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{task.title}</p>
                      {task.description && (
                        <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant={task.status === 'completed' ? 'default' : 'outline'}>
                          {task.status}
                        </Badge>
                        <Badge variant="secondary">{task.priority}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* OmniScope Footer */}
        <div className="text-center py-8 border-t border-zinc-800 mt-12">
          <p className="text-zinc-500 text-sm mb-1">omniscopex.ae</p>
          <p className="text-zinc-600 text-xs">Confidential & Proprietary</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
