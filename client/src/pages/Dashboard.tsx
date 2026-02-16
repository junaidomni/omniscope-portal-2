import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Calendar, TrendingUp, Users, CheckSquare, FileText,
  Building2, Download, Clock, ArrowRight, Sparkles,
  AlertCircle, Globe, ChevronRight, Video, ExternalLink
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

// ============================================================================
// TIMEZONE CLOCKS (compact strip)
// ============================================================================

const TIMEZONES = [
  { label: "EST", zone: "America/New_York", city: "New York" },
  { label: "PST", zone: "America/Los_Angeles", city: "LA" },
  { label: "GMT", zone: "Europe/London", city: "London" },
  { label: "GST", zone: "Asia/Dubai", city: "Dubai" },
  { label: "PKT", zone: "Asia/Karachi", city: "Karachi" },
  { label: "JST", zone: "Asia/Tokyo", city: "Tokyo" },
];

function MiniClock({ zone, city }: { zone: string; city: string }) {
  const [time, setTime] = useState("");
  useEffect(() => {
    const update = () => {
      setTime(new Date().toLocaleTimeString("en-US", {
        timeZone: zone, hour: "numeric", minute: "2-digit", hour12: true,
      }));
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [zone]);
  return (
    <div className="text-center">
      <p className="text-[10px] text-zinc-600 uppercase tracking-wider">{city}</p>
      <p className="text-sm font-semibold text-zinc-300 tabular-nums">{time}</p>
    </div>
  );
}

// ============================================================================
// DASHBOARD
// ============================================================================

interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  attendees: string[];
  hangoutLink?: string;
  isAllDay: boolean;
}

export default function Dashboard() {
  const { data: metrics, isLoading: metricsLoading } = trpc.analytics.dashboard.useQuery();
  const { data: allMeetings = [] } = trpc.meetings.list.useQuery({ limit: 10 });
  const { data: allTasks = [] } = trpc.tasks.list.useQuery({ status: "open" });
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  const exportMutation = trpc.export.dailySummary.useMutation({
    onSuccess: (data) => {
      const blob = new Blob([data.content], { type: "text/markdown" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Daily summary exported");
    },
    onError: () => toast.error("Failed to export summary"),
  });

  // Fetch upcoming Google Calendar events (today + next 7 days)
  useEffect(() => {
    const fetchUpcoming = async () => {
      try {
        const now = new Date();
        const weekLater = new Date(now);
        weekLater.setDate(weekLater.getDate() + 7);
        const response = await fetch(`/api/calendar/events?` + new URLSearchParams({
          timeMin: now.toISOString(),
          timeMax: weekLater.toISOString(),
          maxResults: "20",
        }));
        if (response.ok) {
          const data = await response.json();
          setUpcomingEvents(data.events || []);
        }
      } catch (err) {
        console.error("Failed to fetch upcoming events:", err);
      } finally {
        setEventsLoading(false);
      }
    };
    fetchUpcoming();
  }, []);

  // Parse meeting participants safely
  const parseMeetingParticipants = (m: any) => {
    try { return JSON.parse(m.participants || "[]"); } catch { return []; }
  };
  const parseMeetingOrgs = (m: any) => {
    try { return JSON.parse(m.organizations || "[]"); } catch { return []; }
  };

  // Urgent tasks (high priority or overdue)
  const urgentTasks = useMemo(() => {
    return allTasks
      .filter((t: any) => t.priority === "high" || (t.dueDate && new Date(t.dueDate) < new Date()))
      .slice(0, 5);
  }, [allTasks]);

  if (metricsLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="pt-5 pb-4">
                <Skeleton className="h-4 w-20 bg-zinc-800 mb-2" />
                <Skeleton className="h-8 w-12 bg-zinc-800" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header + Timezone Strip */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Command Center</h1>
            <p className="text-sm text-zinc-500">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-zinc-700 text-zinc-400 hover:text-white"
              onClick={() => exportMutation.mutate({ date: new Date().toISOString().split("T")[0] })}
              disabled={exportMutation.isPending}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {exportMutation.isPending ? "Exporting..." : "Export Daily Brief"}
            </Button>
          </div>
        </div>

        {/* Timezone Strip */}
        <div className="flex items-center gap-4 px-4 py-2 bg-zinc-900/30 rounded-lg border border-zinc-800/50 overflow-x-auto">
          <Globe className="h-3.5 w-3.5 text-zinc-600 flex-shrink-0" />
          {TIMEZONES.map((tz, idx) => (
            <div key={tz.zone} className="flex items-center gap-3">
              <MiniClock zone={tz.zone} city={tz.city} />
              {idx < TIMEZONES.length - 1 && <Separator orientation="vertical" className="h-6 bg-zinc-800" />}
            </div>
          ))}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard title="Today" value={metrics?.meetingsToday || 0} sub={`${metrics?.meetingsThisWeek || 0} this week`} icon={<Calendar className="h-4 w-4" />} />
        <MetricCard title="Contacts" value={metrics?.uniqueParticipants || 0} sub={`${metrics?.uniqueOrganizations || 0} orgs`} icon={<Users className="h-4 w-4" />} />
        <MetricCard title="Open Tasks" value={metrics?.openTasks || 0} sub={`${metrics?.completedTasksToday || 0} done today`} icon={<CheckSquare className="h-4 w-4" />} accent={metrics?.openTasks && metrics.openTasks > 10 ? "red" : undefined} />
        <MetricCard title="Total Intel" value={metrics?.totalMeetings || 0} sub={`${metrics?.meetingsThisMonth || 0} this month`} icon={<TrendingUp className="h-4 w-4" />} />
      </div>

      {/* Main Grid: 3 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Upcoming Schedule */}
        <div className="space-y-6">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-zinc-300">Upcoming Schedule</CardTitle>
                <Link href="/calendar">
                  <span className="text-xs text-yellow-600 hover:text-yellow-500 cursor-pointer flex items-center gap-1">
                    View Calendar <ChevronRight className="h-3 w-3" />
                  </span>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {eventsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 bg-zinc-800 rounded-lg" />)}
                </div>
              ) : upcomingEvents.length === 0 ? (
                <div className="text-center py-6">
                  <Calendar className="h-8 w-8 mx-auto mb-2 text-zinc-700" />
                  <p className="text-xs text-zinc-500">No upcoming events</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {upcomingEvents.slice(0, 8).map(event => {
                    const startDate = new Date(event.start);
                    const isToday = startDate.toDateString() === new Date().toDateString();
                    const isTomorrow = startDate.toDateString() === new Date(Date.now() + 86400000).toDateString();
                    const dayLabel = isToday ? "Today" : isTomorrow ? "Tomorrow" : startDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

                    return (
                      <div key={event.id} className={`p-2.5 rounded-lg border transition-all ${isToday ? 'bg-yellow-600/5 border-yellow-600/20' : 'bg-zinc-800/30 border-zinc-800 hover:border-zinc-700'}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{event.summary}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
                              <Clock className="h-3 w-3" />
                              <span>{dayLabel}</span>
                              {!event.isAllDay && (
                                <span>
                                  {startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                </span>
                              )}
                            </div>
                          </div>
                          {event.hangoutLink && (
                            <a href={event.hangoutLink} target="_blank" rel="noopener noreferrer" className="text-yellow-600 hover:text-yellow-500 ml-2" onClick={e => e.stopPropagation()}>
                              <Video className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                        {event.attendees.length > 0 && (
                          <p className="text-[11px] text-zinc-600 mt-1 truncate">{event.attendees.slice(0, 3).join(", ")}{event.attendees.length > 3 ? ` +${event.attendees.length - 3}` : ""}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Urgent Tasks */}
          {urgentTasks.length > 0 && (
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                    Priority Tasks
                  </CardTitle>
                  <Link href="/tasks">
                    <span className="text-xs text-yellow-600 hover:text-yellow-500 cursor-pointer flex items-center gap-1">
                      All Tasks <ChevronRight className="h-3 w-3" />
                    </span>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {urgentTasks.map((task: any) => (
                    <div key={task.id} className="p-2.5 rounded-lg bg-zinc-800/30 border border-zinc-800">
                      <p className="text-sm text-white truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {task.category && (
                          <Badge variant="outline" className="border-yellow-600/30 text-yellow-600 text-[10px] px-1.5 py-0">{task.category}</Badge>
                        )}
                        {task.assignedName && (
                          <span className="text-[10px] text-zinc-500">{task.assignedName}</span>
                        )}
                        {task.dueDate && new Date(task.dueDate) < new Date() && (
                          <span className="text-[10px] text-red-500">Overdue</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Column 2: Recent Intelligence */}
        <div>
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-zinc-300">Recent Intelligence</CardTitle>
                <Link href="/meetings">
                  <span className="text-xs text-yellow-600 hover:text-yellow-500 cursor-pointer flex items-center gap-1">
                    All Meetings <ChevronRight className="h-3 w-3" />
                  </span>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {allMeetings.length === 0 ? (
                <div className="text-center py-6">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-zinc-700" />
                  <p className="text-xs text-zinc-500">No meetings yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {allMeetings.slice(0, 8).map((meeting: any) => {
                    const participants = parseMeetingParticipants(meeting);
                    const orgs = parseMeetingOrgs(meeting);
                    return (
                      <Link key={meeting.id} href={`/meeting/${meeting.id}`}>
                        <div className="p-2.5 rounded-lg bg-zinc-800/30 border border-zinc-800 hover:border-yellow-600/20 transition-all cursor-pointer">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">
                                {participants.length > 0 ? participants.join(", ") : "Unnamed Meeting"}
                              </p>
                              <p className="text-xs text-zinc-500 mt-0.5">
                                {new Date(meeting.meetingDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                {orgs.length > 0 && ` · ${orgs[0]}`}
                              </p>
                            </div>
                            <Badge variant="outline" className="border-zinc-700 text-zinc-500 text-[10px] px-1.5 py-0 ml-2 flex-shrink-0">
                              {meeting.sourceType}
                            </Badge>
                          </div>
                          <p className="text-xs text-zinc-500 line-clamp-2 mt-1.5">{meeting.executiveSummary}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Column 3: Analytics + Quick Actions */}
        <div className="space-y-6">
          {/* Sectors & Jurisdictions */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-zinc-300">Active Verticals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics?.topSectors.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">{item.sector}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-600 rounded-full" style={{ width: `${Math.min((item.count / (metrics?.totalMeetings || 1)) * 100, 100)}%` }} />
                      </div>
                      <span className="text-xs font-medium text-zinc-400 w-5 text-right">{item.count}</span>
                    </div>
                  </div>
                ))}
                {(!metrics?.topSectors || metrics.topSectors.length === 0) && (
                  <p className="text-xs text-zinc-600 text-center py-2">No sector data yet</p>
                )}
              </div>

              <Separator className="my-4 bg-zinc-800" />

              <p className="text-xs font-medium text-zinc-400 mb-3">Jurisdictions</p>
              <div className="flex flex-wrap gap-1.5">
                {metrics?.topJurisdictions.slice(0, 8).map((item, idx) => (
                  <Badge key={idx} variant="outline" className="border-zinc-700 text-zinc-400 text-[10px]">
                    {item.jurisdiction} ({item.count})
                  </Badge>
                ))}
                {(!metrics?.topJurisdictions || metrics.topJurisdictions.length === 0) && (
                  <p className="text-xs text-zinc-600">No jurisdiction data yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-zinc-300">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Link href="/ask">
                  <Button variant="outline" className="w-full justify-start border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 hover:border-yellow-600/30">
                    <Sparkles className="h-4 w-4 mr-3 text-yellow-600" />
                    Ask OmniScope
                    <ArrowRight className="h-3 w-3 ml-auto text-zinc-600" />
                  </Button>
                </Link>
                <Link href="/meetings">
                  <Button variant="outline" className="w-full justify-start border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 hover:border-yellow-600/30">
                    <FileText className="h-4 w-4 mr-3 text-yellow-600" />
                    Browse Meetings
                    <ArrowRight className="h-3 w-3 ml-auto text-zinc-600" />
                  </Button>
                </Link>
                <Link href="/tasks">
                  <Button variant="outline" className="w-full justify-start border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 hover:border-yellow-600/30">
                    <CheckSquare className="h-4 w-4 mr-3 text-yellow-600" />
                    Manage Tasks
                    <ArrowRight className="h-3 w-3 ml-auto text-zinc-600" />
                  </Button>
                </Link>
                <Link href="/calendar">
                  <Button variant="outline" className="w-full justify-start border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 hover:border-yellow-600/30">
                    <Calendar className="h-4 w-4 mr-3 text-yellow-600" />
                    View Calendar
                    <ArrowRight className="h-3 w-3 ml-auto text-zinc-600" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// METRIC CARD
// ============================================================================

function MetricCard({ title, value, sub, icon, accent }: {
  title: string; value: number; sub: string; icon: React.ReactNode; accent?: string;
}) {
  return (
    <Card className="bg-zinc-900/50 border-zinc-800 hover:border-yellow-600/20 transition-colors">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{title}</span>
          <div className="text-yellow-600">{icon}</div>
        </div>
        <p className={`text-2xl font-bold ${accent === "red" ? "text-red-400" : "text-white"}`}>{value.toLocaleString()}</p>
        <p className="text-[11px] text-zinc-600 mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}
