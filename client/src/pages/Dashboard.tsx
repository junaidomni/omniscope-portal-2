import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar, TrendingUp, Users, CheckSquare, FileText,
  Building2, Download, Clock, ArrowRight, Sparkles,
  AlertCircle, Globe, ChevronRight, Video, ExternalLink,
  BarChart3, GripVertical, RotateCcw, Move, X,
  Briefcase, Activity, Target, Zap, Shield,
  ArrowUpRight, Layers, Inbox, Star, Eye
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

// TIMEZONE CLOCKS — Premium minimal design

const TIMEZONES = [
  { label: "EST", zone: "America/New_York", city: "New York" },
  { label: "PST", zone: "America/Los_Angeles", city: "LA" },
  { label: "GMT", zone: "Europe/London", city: "London" },
  { label: "GST", zone: "Asia/Dubai", city: "Dubai" },
  { label: "PKT", zone: "Asia/Karachi", city: "Islamabad" },
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
      <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium">{city}</p>
      <p className="text-sm font-semibold text-zinc-200 tabular-nums">{time}</p>
    </div>
  );
}

function LocalClock() {
  const [time, setTime] = useState("");
  const [info, setInfo] = useState({ city: "Local", tz: "" });

  useEffect(() => {
    const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const city = userTz.split("/").pop()?.replace(/_/g, " ") || "Local";
    const abbr = new Date().toLocaleTimeString("en-US", { timeZoneName: "short" }).split(" ").pop() || "";
    setInfo({ city, tz: abbr });

    const update = () => {
      setTime(new Date().toLocaleTimeString("en-US", {
        hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true,
      }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="text-center flex-shrink-0 pl-2">
      <p className="text-[10px] text-yellow-600/80 font-semibold uppercase tracking-widest">
        {info.city} ({info.tz})
      </p>
      <p className="text-base font-bold text-yellow-500 tabular-nums">{time}</p>
    </div>
  );
}

// LAYOUT SYSTEM - Widget ordering with drag-and-drop

const DEFAULT_WIDGET_ORDER = [
  "daily-report",
  "weekly-report",
  "upcoming-schedule",
  "recent-intelligence",
  "priority-tasks",
  "active-verticals",
  "quick-actions",
];

const WIDGET_LABELS: Record<string, string> = {
  "daily-report": "Daily Report",
  "weekly-report": "Weekly Report",
  "upcoming-schedule": "Upcoming Schedule",
  "recent-intelligence": "Recent Intelligence",
  "priority-tasks": "Priority Tasks",
  "active-verticals": "Active Verticals",
  "quick-actions": "Quick Actions",
};

const STORAGE_KEY = "omniscope-dashboard-layout-v3";

function useDashboardLayout() {
  const [widgetOrder, setWidgetOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const allWidgets = [...parsed.filter((id: string) => DEFAULT_WIDGET_ORDER.includes(id))];
        DEFAULT_WIDGET_ORDER.forEach(id => {
          if (!allWidgets.includes(id)) allWidgets.push(id);
        });
        return allWidgets;
      }
    } catch {}
    return DEFAULT_WIDGET_ORDER;
  });

  const saveOrder = useCallback((order: string[]) => {
    setWidgetOrder(order);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  }, []);

  const resetOrder = useCallback(() => {
    setWidgetOrder(DEFAULT_WIDGET_ORDER);
    localStorage.removeItem(STORAGE_KEY);
    toast.success("Dashboard layout reset to default");
  }, []);

  return { widgetOrder, saveOrder, resetOrder };
}

// METRIC CARD — Premium glassmorphism

function MetricCard({ title, value, sub, icon, accent, href }: {
  title: string; value: number; sub: string; icon: React.ReactNode; accent?: string; href?: string;
}) {
  const [, setLocation] = useLocation();

  return (
    <div
      className={`group relative bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/40 rounded-2xl p-4 transition-all duration-300 hover:border-zinc-700/50 hover:bg-zinc-900/50 hover:shadow-xl hover:shadow-black/20 hover:-translate-y-0.5 ${href ? 'cursor-pointer' : ''}`}
      onClick={href ? () => setLocation(href) : undefined}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">{title}</span>
        <div className={`p-1.5 rounded-xl ${accent === "red" ? "bg-red-950/40 text-red-400" : "bg-yellow-500/10 text-yellow-500"}`}>
          {icon}
        </div>
      </div>
      <p className={`text-3xl font-bold font-mono tracking-tight ${accent === "red" ? "text-red-400" : "text-white"}`}>
        {value.toLocaleString()}
      </p>
      <p className="text-[11px] text-zinc-600 mt-1">{sub}</p>
      {href && (
        <ArrowUpRight className="absolute top-4 right-4 h-3 w-3 text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  );
}

// DRAGGABLE WIDGET WRAPPER — Premium

function DraggableWidget({
  widgetId,
  isCustomizing,
  isDragging,
  isDragOver,
  onDragStart,
  onDragEnter,
  onDragEnd,
  children,
}: {
  widgetId: string;
  isCustomizing: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: (id: string) => void;
  onDragEnter: (id: string) => void;
  onDragEnd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      draggable={isCustomizing}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", widgetId);
        onDragStart(widgetId);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        onDragEnter(widgetId);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDragEnd();
      }}
      onDragEnd={onDragEnd}
      className={`relative transition-all duration-300 ${
        isCustomizing ? "cursor-grab active:cursor-grabbing" : ""
      } ${isDragging ? "opacity-30 scale-95" : ""} ${
        isDragOver ? "ring-2 ring-yellow-500/50 ring-offset-2 ring-offset-black rounded-2xl scale-[1.02]" : ""
      }`}
    >
      {isCustomizing && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-600 text-black text-[10px] font-bold shadow-lg shadow-yellow-600/20 uppercase tracking-wider">
          <GripVertical className="h-3 w-3" />
          {WIDGET_LABELS[widgetId] || widgetId}
        </div>
      )}
      {children}
    </div>
  );
}

// SECTION WRAPPER — Premium

function WidgetSection({
  icon,
  title,
  linkTo,
  linkLabel,
  children,
  accentColor,
}: {
  icon: React.ReactNode;
  title: string;
  linkTo?: string;
  linkLabel?: string;
  children: React.ReactNode;
  accentColor?: string;
}) {
  return (
    <div className="bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/40 rounded-2xl overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-lg ${accentColor || "bg-zinc-800/60"}`}>
            {icon}
          </div>
          <h3 className="text-sm font-semibold text-zinc-200 tracking-tight">{title}</h3>
        </div>
        {linkTo && (
          <Link href={linkTo}>
            <span className="text-[11px] text-zinc-500 hover:text-yellow-500 cursor-pointer flex items-center gap-1 font-medium transition-colors">
              {linkLabel || "View all"} <ChevronRight className="h-3 w-3" />
            </span>
          </Link>
        )}
      </div>
      <div className="px-5 pb-4 flex-1">
        {children}
      </div>
    </div>
  );
}

// DAILY REPORT WIDGET — Premium

function DailyReportWidget() {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const { data: summary } = trpc.analytics.dailySummary.useQuery({ date: todayStr });

  return (
    <Link href="/reports/daily">
      <div className="group relative bg-gradient-to-br from-yellow-500/5 to-zinc-900/30 backdrop-blur-sm border border-yellow-600/15 rounded-2xl p-5 transition-all duration-300 hover:border-yellow-600/30 hover:shadow-xl hover:shadow-yellow-600/5 hover:-translate-y-0.5 cursor-pointer h-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-base font-semibold text-white tracking-tight">Daily Report</p>
              <p className="text-[11px] text-zinc-500">Today's intelligence summary</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-zinc-700 group-hover:text-yellow-500 transition-colors" />
        </div>
        {summary && (
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/30">
              <p className="text-xl font-bold text-white font-mono">{summary.meetingCount}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Meetings</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/30">
              <p className="text-xl font-bold text-white font-mono">{summary.tasksCreated}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Tasks</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/30">
              <p className="text-xl font-bold text-white font-mono">{summary.meetings?.reduce((acc: number, m: any) => acc + (m.participants?.length || 0), 0) ?? 0}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Contacts</p>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

// WEEKLY REPORT WIDGET — Premium

function WeeklyReportWidget() {
  const { data: summary } = trpc.analytics.weeklySummary.useQuery({});

  return (
    <Link href="/reports/weekly">
      <div className="group relative bg-gradient-to-br from-yellow-500/5 to-zinc-900/30 backdrop-blur-sm border border-yellow-600/15 rounded-2xl p-5 transition-all duration-300 hover:border-yellow-600/30 hover:shadow-xl hover:shadow-yellow-600/5 hover:-translate-y-0.5 cursor-pointer h-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-base font-semibold text-white tracking-tight">Weekly Report</p>
              <p className="text-[11px] text-zinc-500">Full week intelligence</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-zinc-700 group-hover:text-yellow-500 transition-colors" />
        </div>
        {summary && (
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/30">
              <p className="text-xl font-bold text-white font-mono">{summary.meetingCount}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Meetings</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/30">
              <p className="text-xl font-bold text-white font-mono">{summary.tasksCreated}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Tasks</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/30">
              <p className="text-xl font-bold text-white font-mono">{summary.uniqueParticipants}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Contacts</p>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

// UPCOMING SCHEDULE WIDGET — Premium

interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  attendees: string[];
  hangoutLink?: string;
  isAllDay: boolean;
}

function UpcomingScheduleWidget({ events, loading }: { events: CalendarEvent[]; loading: boolean }) {
  return (
    <WidgetSection
      icon={<Calendar className="h-3.5 w-3.5 text-emerald-400" />}
      title="Upcoming Schedule"
      linkTo="/calendar"
      linkLabel="Calendar"
      accentColor="bg-emerald-950/40"
    >
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-zinc-800/30 rounded-xl animate-pulse" />)}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-8">
          <div className="p-3 rounded-2xl bg-zinc-800/20 inline-block mb-3">
            <Calendar className="h-6 w-6 text-zinc-700" />
          </div>
          <p className="text-sm text-zinc-500">No upcoming events</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.slice(0, 5).map(event => {
            const startDate = new Date(event.start);
            const isToday = startDate.toDateString() === new Date().toDateString();
            const isTomorrow = startDate.toDateString() === new Date(Date.now() + 86400000).toDateString();
            const dayLabel = isToday ? "Today" : isTomorrow ? "Tomorrow" : startDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

            return (
              <div key={event.id} className={`group p-3 rounded-xl border transition-all duration-200 ${
                isToday
                  ? 'bg-yellow-500/5 border-yellow-600/15 hover:border-yellow-600/30'
                  : 'bg-zinc-900/30 border-zinc-800/30 hover:border-zinc-700/40'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate group-hover:text-white transition-colors">{event.summary}</p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-500">
                      <Clock className="h-3 w-3" />
                      <span>{dayLabel}</span>
                      {!event.isAllDay && (
                        <span>{startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                      )}
                    </div>
                  </div>
                  {event.hangoutLink && (
                    <a href={event.hangoutLink} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-yellow-950/30 text-zinc-600 hover:text-yellow-500 transition-all ml-2" onClick={e => e.stopPropagation()}>
                      <Video className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
                {event.attendees.length > 0 && (
                  <p className="text-[10px] text-zinc-600 mt-1.5 truncate">
                    {event.attendees.slice(0, 3).join(", ")}{event.attendees.length > 3 ? ` +${event.attendees.length - 3}` : ""}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </WidgetSection>
  );
}

// RECENT INTELLIGENCE WIDGET — Premium

function RecentIntelligenceWidget({ meetings, parseMeetingParticipants }: { meetings: any[]; parseMeetingParticipants: (m: any) => string[] }) {
  return (
    <WidgetSection
      icon={<FileText className="h-3.5 w-3.5 text-blue-400" />}
      title="Recent Intelligence"
      linkTo="/meetings"
      linkLabel="All Meetings"
      accentColor="bg-blue-950/40"
    >
      {meetings.length === 0 ? (
        <div className="text-center py-8">
          <div className="p-3 rounded-2xl bg-zinc-800/20 inline-block mb-3">
            <FileText className="h-6 w-6 text-zinc-700" />
          </div>
          <p className="text-sm text-zinc-500">No meetings yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {meetings.slice(0, 5).map((meeting: any) => {
            const participants = parseMeetingParticipants(meeting);
            return (
              <Link key={meeting.id} href={`/meeting/${meeting.id}`}>
                <div className="group p-3 rounded-xl bg-zinc-900/30 border border-zinc-800/30 hover:border-zinc-700/40 transition-all duration-200 cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
                        {meeting.meetingTitle || (participants.length > 0 ? participants.join(", ") : "Unnamed Meeting")}
                      </p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        {new Date(meeting.meetingDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        {participants.length > 0 && ` · ${participants.join(", ")}`}
                      </p>
                    </div>
                    <span className="text-[10px] text-zinc-600 bg-zinc-800/50 px-2 py-0.5 rounded-full ml-2 flex-shrink-0 border border-zinc-700/30">
                      {meeting.sourceType}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 line-clamp-1 mt-1.5">{meeting.executiveSummary}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </WidgetSection>
  );
}

// ACTIVE VERTICALS WIDGET — Premium

function ActiveVerticalsWidget({ metrics }: { metrics: any }) {
  return (
    <WidgetSection
      icon={<Layers className="h-3.5 w-3.5 text-purple-400" />}
      title="Active Verticals"
      accentColor="bg-purple-950/40"
    >
      <div className="space-y-3">
        {metrics?.topSectors?.slice(0, 5).map((item: any, idx: number) => {
          const percentage = Math.min((item.count / (metrics?.totalMeetings || 1)) * 100, 100);
          return (
            <div key={idx} className="group">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-zinc-300 font-medium group-hover:text-white transition-colors">{item.sector}</span>
                <span className="text-xs font-mono text-zinc-500 tabular-nums">{item.count}</span>
              </div>
              <div className="h-1.5 bg-zinc-800/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-yellow-600 to-yellow-500 rounded-full transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
        {(!metrics?.topSectors || metrics.topSectors.length === 0) && (
          <p className="text-xs text-zinc-600 text-center py-4">No sector data yet</p>
        )}
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-zinc-700/30 to-transparent my-4" />

      <div>
        <p className="text-[10px] font-semibold text-zinc-400 mb-2.5 uppercase tracking-widest">Jurisdictions</p>
        <div className="flex flex-wrap gap-1.5">
          {metrics?.topJurisdictions?.slice(0, 8).map((item: any, idx: number) => (
            <span key={idx} className="text-[10px] text-zinc-400 bg-zinc-800/40 border border-zinc-700/30 px-2.5 py-1 rounded-full font-medium">
              {item.jurisdiction} <span className="text-zinc-600">({item.count})</span>
            </span>
          ))}
          {(!metrics?.topJurisdictions || metrics.topJurisdictions.length === 0) && (
            <p className="text-xs text-zinc-600">No jurisdiction data yet</p>
          )}
        </div>
      </div>
    </WidgetSection>
  );
}

// PRIORITY TASKS WIDGET — Premium

function PriorityTasksWidget({ tasks }: { tasks: any[] }) {
  return (
    <WidgetSection
      icon={<AlertCircle className="h-3.5 w-3.5 text-red-400" />}
      title="Priority Tasks"
      linkTo="/tasks"
      linkLabel="All Tasks"
      accentColor="bg-red-950/40"
    >
      {tasks.length === 0 ? (
        <div className="text-center py-8">
          <div className="p-3 rounded-2xl bg-emerald-950/20 inline-block mb-3">
            <CheckSquare className="h-6 w-6 text-emerald-500/50" />
          </div>
          <p className="text-sm text-zinc-500">No priority tasks</p>
          <p className="text-[11px] text-zinc-600 mt-0.5">You're on track</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task: any) => (
            <div key={task.id} className="group p-3 rounded-xl bg-zinc-900/30 border border-zinc-800/30 hover:border-zinc-700/40 transition-all duration-200">
              <p className="text-sm text-zinc-200 truncate group-hover:text-white transition-colors">{task.title}</p>
              <div className="flex items-center gap-2 mt-1.5">
                {task.category && (
                  <span className="text-[10px] text-yellow-500/80 bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/15">{task.category}</span>
                )}
                {task.assignedName && (
                  <span className="text-[10px] text-zinc-500">{task.assignedName}</span>
                )}
                {task.dueDate && new Date(task.dueDate) < new Date() && (
                  <span className="text-[10px] text-red-400 font-semibold flex items-center gap-0.5">
                    <AlertCircle className="h-2.5 w-2.5" /> Overdue
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetSection>
  );
}

// QUICK ACTIONS WIDGET — Premium

function QuickActionsWidget() {
  const actions = [
    { icon: <Sparkles className="h-4 w-4 text-yellow-500" />, label: "Ask OmniScope", href: "/ask", desc: "AI-powered intelligence" },
    { icon: <FileText className="h-4 w-4 text-blue-400" />, label: "Browse Meetings", href: "/meetings", desc: "View all intelligence" },
    { icon: <CheckSquare className="h-4 w-4 text-emerald-400" />, label: "Manage Tasks", href: "/tasks", desc: "Operations pipeline" },
    { icon: <Calendar className="h-4 w-4 text-purple-400" />, label: "View Calendar", href: "/calendar", desc: "Schedule overview" },
  ];

  return (
    <WidgetSection
      icon={<Zap className="h-3.5 w-3.5 text-yellow-500" />}
      title="Quick Actions"
      accentColor="bg-yellow-950/40"
    >
      <div className="space-y-2">
        {actions.map((action, idx) => (
          <Link key={idx} href={action.href}>
            <div className="group flex items-center gap-3 p-3 rounded-xl bg-zinc-900/20 border border-zinc-800/30 hover:border-zinc-700/40 hover:bg-zinc-900/40 transition-all duration-200 cursor-pointer">
              <div className="p-2 rounded-xl bg-zinc-800/40 group-hover:bg-zinc-800/60 transition-colors">
                {action.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">{action.label}</p>
                <p className="text-[10px] text-zinc-600">{action.desc}</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </WidgetSection>
  );
}

// DASHBOARD — Main Component

export default function Dashboard() {
  const { data: metrics, isLoading: metricsLoading } = trpc.analytics.dashboard.useQuery();
  const { data: allMeetings = [] } = trpc.meetings.list.useQuery({ limit: 10 });
  const { data: allTasks = [] } = trpc.tasks.list.useQuery({ status: "open" });
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const { widgetOrder, saveOrder, resetOrder } = useDashboardLayout();

  // Drag state for widget reordering
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [dragOverWidget, setDragOverWidget] = useState<string | null>(null);

  const handleExportDailyBrief = async () => {
    setIsExporting(true);
    try {
      const n = new Date();
      const today = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
      const response = await fetch(`/api/daily-brief/pdf?date=${today}`);
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `omniscope-daily-brief-${today}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Daily brief exported as PDF");
    } catch {
      toast.error("Failed to export daily brief");
    } finally {
      setIsExporting(false);
    }
  };

  // Auto-sync: Fathom meetings + Google Calendar on page load
  const fathomSync = trpc.ingestion.syncFathom.useMutation();
  const utils = trpc.useUtils();
  const fathomSyncedRef = useRef(false);

  useEffect(() => {
    if (!fathomSyncedRef.current) {
      fathomSyncedRef.current = true;
      fathomSync.mutateAsync().then((result) => {
        if (result.imported > 0) {
          toast.success(`${result.imported} new meeting(s) synced from Fathom`);
          utils.meetings.list.invalidate();
          utils.analytics.dashboard.invalidate();
        }
      }).catch(() => {});
    }
  }, []);

  const calSyncedRef = useRef(false);
  useEffect(() => {
    if (calSyncedRef.current) return;
    calSyncedRef.current = true;
    const syncAndFetch = async () => {
      try {
        await fetch('/api/calendar/sync', { method: 'POST' }).catch(() => {});
      } catch {}
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
    syncAndFetch();
  }, []);

  const parseMeetingParticipants = (m: any) => {
    try { return JSON.parse(m.participants || "[]"); } catch { return []; }
  };

  const urgentTasks = useMemo(() => {
    if (!Array.isArray(allTasks)) return [];
    return allTasks
      .filter((t: any) => t.priority === "high" || (t.dueDate && new Date(t.dueDate) < new Date()))
      .slice(0, 5);
  }, [allTasks]);

  // ========== DRAG AND DROP HANDLERS ==========
  const onDragStart = (widgetId: string) => {
    setDraggedWidget(widgetId);
  };

  const onDragEnter = (widgetId: string) => {
    if (draggedWidget && draggedWidget !== widgetId) {
      setDragOverWidget(widgetId);
    }
  };

  const onDragEnd = () => {
    if (draggedWidget && dragOverWidget && draggedWidget !== dragOverWidget) {
      const newOrder = [...widgetOrder];
      const fromIdx = newOrder.indexOf(draggedWidget);
      const toIdx = newOrder.indexOf(dragOverWidget);
      if (fromIdx !== -1 && toIdx !== -1) {
        newOrder.splice(fromIdx, 1);
        newOrder.splice(toIdx, 0, draggedWidget);
        saveOrder(newOrder);
        toast.success("Widget moved");
      }
    }
    setDraggedWidget(null);
    setDragOverWidget(null);
  };

  // Widget content renderer
  const getWidgetContent = (widgetId: string) => {
    switch (widgetId) {
      case "daily-report":
        return <DailyReportWidget />;
      case "weekly-report":
        return <WeeklyReportWidget />;
      case "upcoming-schedule":
        return <UpcomingScheduleWidget events={upcomingEvents} loading={eventsLoading} />;
      case "recent-intelligence":
        return <RecentIntelligenceWidget meetings={allMeetings} parseMeetingParticipants={parseMeetingParticipants} />;
      case "priority-tasks":
        return <PriorityTasksWidget tasks={urgentTasks} />;
      case "active-verticals":
        return <ActiveVerticalsWidget metrics={metrics} />;
      case "quick-actions":
        return <QuickActionsWidget />;
      default:
        return null;
    }
  };

  if (metricsLoading) {
    return (
      <div className="p-5 lg:p-6 max-w-[1400px] mx-auto space-y-5">
        {/* Skeleton header */}
        <div className="h-12 bg-zinc-900/30 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-zinc-900/30 border border-zinc-800/40 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2].map(i => (
            <div key={i} className="h-44 bg-zinc-900/30 border border-zinc-800/40 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Split widgets into report row and main grid
  const reportWidgets = widgetOrder.filter(id => id === "daily-report" || id === "weekly-report");
  const mainWidgets = widgetOrder.filter(id => id !== "daily-report" && id !== "weekly-report");

  return (
    <div className="p-5 lg:p-6 max-w-[1400px] mx-auto space-y-5">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Command Center</h1>
            <p className="text-[11px] text-zinc-500 font-medium mt-0.5">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <div className="flex gap-2">
            {isCustomizing ? (
              <>
                <Button variant="outline" size="sm" className="border-zinc-700/50 text-zinc-400 hover:text-white rounded-xl h-9 text-xs" onClick={resetOrder}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset
                </Button>
                <Button size="sm" className="bg-yellow-600 hover:bg-yellow-500 text-black font-semibold rounded-xl h-9 text-xs" onClick={() => { setIsCustomizing(false); toast.success("Layout saved"); }}>
                  Done
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" className="border-zinc-700/50 text-zinc-400 hover:text-white rounded-xl h-9 text-xs" onClick={() => setIsCustomizing(true)}>
                  <GripVertical className="h-3.5 w-3.5 mr-1.5" /> Customize
                </Button>
                <Button variant="outline" size="sm" className="border-zinc-700/50 text-zinc-400 hover:text-white rounded-xl h-9 text-xs" onClick={handleExportDailyBrief} disabled={isExporting}>
                  <Download className="h-3.5 w-3.5 mr-1.5" /> {isExporting ? "Exporting..." : "Export Brief"}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Timezone Strip */}
        <div className="flex items-center gap-4 px-5 py-3 bg-zinc-900/20 rounded-2xl border border-zinc-800/30 overflow-x-auto backdrop-blur-sm">
          <Globe className="h-3.5 w-3.5 text-zinc-600 flex-shrink-0" />
          {TIMEZONES.map((tz, idx) => (
            <div key={tz.zone} className="flex items-center gap-4">
              <MiniClock zone={tz.zone} city={tz.city} />
              {idx < TIMEZONES.length - 1 && <div className="h-6 w-px bg-zinc-800/50" />}
            </div>
          ))}
          <div className="flex-1" />
          <div className="h-6 w-px bg-zinc-700/50" />
          <LocalClock />
        </div>
      </div>

      {/* Customization Banner */}
      {isCustomizing && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-yellow-500/5 border border-yellow-500/15">
          <div className="p-2 rounded-xl bg-yellow-500/10">
            <Move className="h-4 w-4 text-yellow-500" />
          </div>
          <p className="text-sm text-yellow-400 font-medium">Drag widgets to rearrange your dashboard layout</p>
        </div>
      )}

      {/* ── Metric Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard title="Today" value={metrics?.meetingsToday || 0} sub={`${metrics?.meetingsThisWeek || 0} this week`} icon={<Calendar className="h-3.5 w-3.5" />} href="/calendar" />
        <MetricCard title="Contacts" value={metrics?.uniqueParticipants || 0} sub={`${metrics?.uniqueOrganizations || 0} orgs`} icon={<Users className="h-3.5 w-3.5" />} href="/meetings?tab=people" />
        <MetricCard title="Open Tasks" value={metrics?.openTasks || 0} sub={`${metrics?.completedTasksToday || 0} done today`} icon={<CheckSquare className="h-3.5 w-3.5" />} accent={metrics?.openTasks && metrics.openTasks > 10 ? "red" : undefined} href="/tasks" />
        <MetricCard title="Total Intel" value={metrics?.totalMeetings || 0} sub={`${metrics?.meetingsThisMonth || 0} this month`} icon={<TrendingUp className="h-3.5 w-3.5" />} href="/meetings" />
      </div>

      {/* ── Report Cards Row ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {reportWidgets.map(id => (
          <DraggableWidget
            key={id}
            widgetId={id}
            isCustomizing={isCustomizing}
            isDragging={draggedWidget === id}
            isDragOver={dragOverWidget === id}
            onDragStart={onDragStart}
            onDragEnter={onDragEnter}
            onDragEnd={onDragEnd}
          >
            {getWidgetContent(id)}
          </DraggableWidget>
        ))}
      </div>

      {/* ── Main Widget Grid ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {mainWidgets.map(id => (
          <DraggableWidget
            key={id}
            widgetId={id}
            isCustomizing={isCustomizing}
            isDragging={draggedWidget === id}
            isDragOver={dragOverWidget === id}
            onDragStart={onDragStart}
            onDragEnter={onDragEnter}
            onDragEnd={onDragEnd}
          >
            {getWidgetContent(id)}
          </DraggableWidget>
        ))}
      </div>
    </div>
  );
}
