import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, TrendingUp, Users, CheckSquare, FileText, Building2, Download, ExternalLink, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function Dashboard() {
  const { data: metrics, isLoading: metricsLoading } = trpc.analytics.dashboard.useQuery();
  const { data: dailySummary, isLoading: dailyLoading } = trpc.analytics.dailySummary.useQuery({});
  
  const exportMutation = trpc.export.dailySummary.useMutation({
    onSuccess: (data) => {
      // Create download link
      const blob = new Blob([data.content], { type: 'text/markdown' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Daily summary exported');
    },
    onError: () => {
      toast.error('Failed to export summary');
    },
  });

  const handleExportDailySummary = () => {
    const today = new Date().toISOString().split('T')[0];
    exportMutation.mutate({ date: today });
  };

  if (metricsLoading || dailyLoading) {
    return (
      <div className="container mx-auto py-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-3">
                <Skeleton className="h-4 w-24 bg-zinc-800" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 bg-zinc-800" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Analytics & Summaries */}
        <div className="lg:col-span-2 space-y-8">
          {/* Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Today's Meetings"
              value={metrics?.meetingsToday || 0}
              icon={<Calendar className="h-4 w-4" />}
              trend={`${metrics?.meetingsThisWeek || 0} this week`}
            />
            <MetricCard
              title="People Contacted"
              value={metrics?.uniqueParticipants || 0}
              icon={<Users className="h-4 w-4" />}
              trend={`${metrics?.uniqueOrganizations || 0} organizations`}
            />
            <MetricCard
              title="Open Tasks"
              value={metrics?.openTasks || 0}
              icon={<AlertCircle className="h-4 w-4" />}
              trend={`${metrics?.completedTasksToday || 0} completed today`}
            />
            <MetricCard
              title="Total Meetings"
              value={metrics?.totalMeetings || 0}
              icon={<TrendingUp className="h-4 w-4" />}
              trend={`${metrics?.meetingsThisMonth || 0} this month`}
            />
          </div>

          {/* Today's Summary */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl text-white">Today's Intelligence Summary</CardTitle>
                  <CardDescription className="text-zinc-400">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  onClick={handleExportDailySummary}
                  disabled={exportMutation.isPending}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {exportMutation.isPending ? "Exporting..." : "Export"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {dailySummary && dailySummary.meetingCount > 0 ? (
                <>
                  <div className="grid grid-cols-3 gap-4 pb-4 border-b border-zinc-800">
                    <div>
                      <p className="text-sm text-zinc-400">Meetings</p>
                      <p className="text-2xl font-bold text-white">{dailySummary.meetingCount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-zinc-400">Tasks Created</p>
                      <p className="text-2xl font-bold text-yellow-500">{dailySummary.tasksCreated}</p>
                    </div>
                    <div>
                      <p className="text-sm text-zinc-400">Tasks Completed</p>
                      <p className="text-2xl font-bold text-green-500">{dailySummary.tasksCompleted}</p>
                    </div>
                  </div>

                  {/* Sectors & Jurisdictions */}
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-300 mb-2">Active Sectors</p>
                      <div className="flex flex-wrap gap-2">
                        {dailySummary.topSectors.map(sector => (
                          <Badge key={sector} variant="outline" className="border-yellow-600/30 bg-yellow-600/10 text-yellow-500">
                            {sector}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-300 mb-2">Jurisdictions</p>
                      <div className="flex flex-wrap gap-2">
                        {dailySummary.topJurisdictions.map(jurisdiction => (
                          <Badge key={jurisdiction} variant="outline" className="border-zinc-700 bg-zinc-800/50 text-zinc-300">
                            {jurisdiction}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Meeting Highlights */}
                  <div className="space-y-3 pt-4 border-t border-zinc-800">
                    <h4 className="text-sm font-medium text-zinc-300">Meeting Highlights</h4>
                    {dailySummary.meetings.slice(0, 3).map((meeting, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-zinc-800/30 border border-zinc-800">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="text-sm font-medium text-white">
                              {meeting.participants.join(', ')}
                            </p>
                            <p className="text-xs text-zinc-500">{meeting.time}</p>
                          </div>
                          {meeting.organizations.length > 0 && (
                            <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs">
                              <Building2 className="h-3 w-3 mr-1" />
                              {meeting.organizations[0]}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-zinc-400 line-clamp-2">{meeting.summary}</p>
                        {meeting.keyHighlights.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {meeting.keyHighlights.map((highlight, hIdx) => (
                              <li key={hIdx} className="text-xs text-zinc-500 flex items-start">
                                <span className="text-yellow-600 mr-2">•</span>
                                <span className="line-clamp-1">{highlight}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-zinc-500">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No meetings recorded today yet.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Sectors & Jurisdictions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-lg text-white">Top Sectors</CardTitle>
                <CardDescription className="text-zinc-400">Most active verticals</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {metrics?.topSectors.slice(0, 5).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm text-zinc-300">{item.sector}</span>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-yellow-600" 
                            style={{ width: `${(item.count / (metrics?.totalMeetings || 1)) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-white w-8 text-right">{item.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-lg text-white">Top Jurisdictions</CardTitle>
                <CardDescription className="text-zinc-400">Geographic distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {metrics?.topJurisdictions.slice(0, 5).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm text-zinc-300">{item.jurisdiction}</span>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-yellow-600" 
                            style={{ width: `${(item.count / (metrics?.totalMeetings || 1)) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-white w-8 text-right">{item.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Column - Recent Meetings */}
        <div className="lg:col-span-1">
          <Card className="bg-zinc-900/50 border-zinc-800 sticky top-8">
            <CardHeader>
              <CardTitle className="text-lg text-white">Recent Meetings</CardTitle>
              <CardDescription className="text-zinc-400">Latest intelligence reports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[calc(100vh-16rem)] overflow-y-auto">
                {metrics?.recentMeetings.map((meeting) => {
                  const participants = JSON.parse(meeting.participants || '[]');
                  const organizations = JSON.parse(meeting.organizations || '[]');
                  
                  return (
                  <div key={meeting.id} className="p-3 rounded-lg bg-zinc-800/30 border border-zinc-800 hover:border-yellow-600/30 transition-all">
                    <Link href={`/meetings/${meeting.id}`}>
                      <div className="cursor-pointer">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-white line-clamp-1">
                              {participants.join(', ')}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {new Date(meeting.meetingDate).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                          <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs">
                            {meeting.sourceType}
                          </Badge>
                        </div>
                        <p className="text-xs text-zinc-400 line-clamp-2 mb-2">{meeting.executiveSummary}</p>
                        
                        {/* Quick Stats */}
                        <div className="flex items-center gap-3 text-xs text-zinc-500">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {participants.length}
                          </span>
                          {organizations.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {organizations.length}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                    
                    {/* Download Button */}
                    {meeting.brandedReportUrl && (
                      <div className="mt-2 pt-2 border-t border-zinc-800">
                        <a 
                          href={meeting.brandedReportUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 text-xs text-yellow-600 hover:text-yellow-500 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Download className="h-3 w-3" />
                          Download Report
                        </a>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  trend: string;
}

function MetricCard({ title, value, icon, trend }: MetricCardProps) {
  return (
    <Card className="bg-zinc-900/50 border-zinc-800 hover:border-yellow-600/30 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-zinc-400">{title}</CardTitle>
          <div className="text-yellow-600">{icon}</div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-white mb-1">{value.toLocaleString()}</div>
        <p className="text-xs text-zinc-500">{trend}</p>
      </CardContent>
    </Card>
  );
}
