import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar, Users, Search, ChevronLeft, ChevronRight,
  FileText, Building2, Clock, User, Mail, Phone, Briefcase,
  Trash2
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

// ============================================================================
// MEETINGS PAGE - Main Container with Tabs
// ============================================================================

export default function Meetings() {
  const [activeTab, setActiveTab] = useState("recent");

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Meetings</h1>
            <p className="text-sm text-zinc-500 mt-1">Intelligence reports, calendar, and contacts</p>
          </div>
          <TabsList className="bg-zinc-900 border border-zinc-800">
            <TabsTrigger value="recent" className="data-[state=active]:bg-yellow-600/20 data-[state=active]:text-yellow-500">
              <Clock className="h-4 w-4 mr-2" />
              Recent
            </TabsTrigger>
            <TabsTrigger value="calendar" className="data-[state=active]:bg-yellow-600/20 data-[state=active]:text-yellow-500">
              <Calendar className="h-4 w-4 mr-2" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="people" className="data-[state=active]:bg-yellow-600/20 data-[state=active]:text-yellow-500">
              <Users className="h-4 w-4 mr-2" />
              People
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="recent" className="mt-0">
          <RecentMeetings />
        </TabsContent>
        <TabsContent value="calendar" className="mt-0">
          <MeetingsCalendar />
        </TabsContent>
        <TabsContent value="people" className="mt-0">
          <PeopleDirectory />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// RECENT MEETINGS - Compact list, newest first, grouped by week
// ============================================================================

function RecentMeetings() {
  const { data: meetings, isLoading } = trpc.meetings.list.useQuery({ limit: 100, offset: 0 });
  const [searchTerm, setSearchTerm] = useState("");
  const utils = trpc.useUtils();
  const deleteMutation = trpc.meetings.delete.useMutation({
    onSuccess: () => {
      toast.success("Meeting deleted");
      utils.meetings.list.invalidate();
      utils.analytics.dashboard.invalidate();
    },
    onError: () => toast.error("Failed to delete meeting"),
  });

  const filteredMeetings = useMemo(() => {
    if (!meetings) return [];
    if (!searchTerm) return meetings;
    const lower = searchTerm.toLowerCase();
    return meetings.filter(m => {
      const participants = (() => { try { return JSON.parse(m.participants || '[]'); } catch { return []; } })();
      const orgs = (() => { try { return JSON.parse(m.organizations || '[]'); } catch { return []; } })();
      const title = m.meetingTitle || '';
      return (
        title.toLowerCase().includes(lower) ||
        participants.join(' ').toLowerCase().includes(lower) ||
        orgs.join(' ').toLowerCase().includes(lower) ||
        m.executiveSummary?.toLowerCase().includes(lower) ||
        m.primaryLead?.toLowerCase().includes(lower)
      );
    });
  }, [meetings, searchTerm]);

  // Group meetings by week
  const grouped = useMemo(() => {
    const groups: Record<string, typeof filteredMeetings> = {};
    for (const m of filteredMeetings) {
      const d = new Date(m.meetingDate);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().split('T')[0];
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredMeetings]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-16 bg-zinc-800/50 rounded-lg" />
        ))}
      </div>
    );
  }

  const formatWeekLabel = (weekStartStr: string) => {
    const ws = new Date(weekStartStr + 'T00:00:00');
    const we = new Date(ws);
    we.setDate(we.getDate() + 6);
    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);

    if (ws.toDateString() === thisWeekStart.toDateString()) return "This Week";
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    if (ws.toDateString() === lastWeekStart.toDateString()) return "Last Week";

    return `${ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${we.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <Input
          placeholder="Search meetings by title, name, org, or keyword..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600"
        />
      </div>

      {grouped.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="h-12 w-12 mx-auto mb-3 text-zinc-700" />
          <p className="text-zinc-500">No meetings found</p>
        </div>
      ) : (
        grouped.map(([weekKey, weekMeetings]) => (
          <div key={weekKey}>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              {formatWeekLabel(weekKey)}
            </h3>
            <div className="space-y-2">
              {weekMeetings.map(meeting => (
                <MeetingRow
                  key={meeting.id}
                  meeting={meeting}
                  onDelete={() => {
                    if (confirm("Delete this meeting and all associated data?")) {
                      deleteMutation.mutate({ id: meeting.id });
                    }
                  }}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function MeetingRow({ meeting, onDelete }: { meeting: any; onDelete: () => void }) {
  const participants = (() => { try { return JSON.parse(meeting.participants || '[]'); } catch { return []; } })();
  const organizations = (() => { try { return JSON.parse(meeting.organizations || '[]'); } catch { return []; } })();
  const tags = trpc.meetings.getTags.useQuery({ meetingId: meeting.id });

  // Meeting title: use meetingTitle field, fallback to generating from participants
  const displayTitle = meeting.meetingTitle || participants.join(', ') || 'Untitled Meeting';

  return (
    <div className="group flex items-center gap-4 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/60 hover:border-yellow-600/30 transition-all">
      {/* Date column */}
      <div className="w-14 text-center flex-shrink-0">
        <p className="text-xs text-zinc-500">
          {new Date(meeting.meetingDate).toLocaleDateString('en-US', { month: 'short' })}
        </p>
        <p className="text-lg font-bold text-white leading-tight">
          {new Date(meeting.meetingDate).getDate()}
        </p>
        <p className="text-xs text-zinc-600">
          {new Date(meeting.meetingDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </p>
      </div>

      <Separator orientation="vertical" className="h-10 bg-zinc-800" />

      {/* Content */}
      <Link href={`/meeting/${meeting.id}`} className="flex-1 min-w-0 cursor-pointer">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Meeting Title as primary heading */}
            <p className="text-sm font-semibold text-white truncate">
              {displayTitle}
            </p>
            {/* Participants below the title */}
            <p className="text-xs text-yellow-600/80 mt-0.5 truncate">
              {participants.join(', ')}
            </p>
            {/* Summary */}
            <p className="text-xs text-zinc-500 line-clamp-1 mt-0.5">
              {meeting.executiveSummary}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {organizations.length > 0 && (
              <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs hidden sm:flex">
                <Building2 className="h-3 w-3 mr-1" />
                {organizations[0]}
              </Badge>
            )}
            {tags.data && tags.data.length > 0 && (
              <Badge variant="outline" className="border-yellow-600/30 bg-yellow-600/10 text-yellow-600 text-xs hidden md:flex">
                {tags.data[0].tag.name}
              </Badge>
            )}
            <Badge variant="outline" className="border-zinc-800 text-zinc-500 text-xs">
              {meeting.sourceType}
            </Badge>
          </div>
        </div>
      </Link>

      {/* Delete button */}
      <Button
        variant="ghost"
        size="sm"
        className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 hover:bg-red-400/10 flex-shrink-0"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ============================================================================
// MEETINGS CALENDAR - Monthly view with meeting dots
// ============================================================================

function MeetingsCalendar() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data: meetings } = trpc.meetings.list.useQuery({ limit: 100, offset: 0 });

  // Build a map of date -> meetings
  const meetingsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    if (!meetings) return map;
    for (const m of meetings) {
      const dateKey = new Date(m.meetingDate).toISOString().split('T')[0];
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(m);
    }
    return map;
  }, [meetings]);

  const selectedMeetings = selectedDate ? (meetingsByDate[selectedDate] || []) : [];

  // Calendar grid
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarDays.push(dateStr);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar Grid */}
      <div className="lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} className="text-zinc-400 hover:text-white">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-lg font-semibold text-white">
            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
          <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} className="text-zinc-400 hover:text-white">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-center text-xs text-zinc-600 font-medium py-2">{d}</div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((dateStr, i) => {
            if (!dateStr) return <div key={`empty-${i}`} className="h-14" />;
            const dayNum = parseInt(dateStr.split('-')[2]);
            const hasMeetings = meetingsByDate[dateStr]?.length > 0;
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={`h-14 rounded-lg flex flex-col items-center justify-center transition-all relative
                  ${isSelected ? 'bg-yellow-600/20 border border-yellow-600/40' :
                    isToday ? 'bg-zinc-800 border border-zinc-700' :
                    'hover:bg-zinc-800/50 border border-transparent'}
                `}
              >
                <span className={`text-sm ${isToday ? 'text-yellow-500 font-bold' : isSelected ? 'text-white font-medium' : 'text-zinc-400'}`}>
                  {dayNum}
                </span>
                {hasMeetings && (
                  <div className="flex gap-0.5 mt-1">
                    {meetingsByDate[dateStr].slice(0, 3).map((_, idx) => (
                      <span key={idx} className="h-1 w-1 rounded-full bg-yellow-600" />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Date Detail */}
      <div>
        <Card className="bg-zinc-900/50 border-zinc-800 sticky top-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white">
              {selectedDate
                ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                : 'Select a date'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedDate ? (
              <p className="text-sm text-zinc-500">Click a date to see meetings</p>
            ) : selectedMeetings.length === 0 ? (
              <p className="text-sm text-zinc-500">No meetings on this date</p>
            ) : (
              <div className="space-y-3">
                {selectedMeetings.map((m: any) => {
                  const participants = (() => { try { return JSON.parse(m.participants || '[]'); } catch { return []; } })();
                  const displayTitle = m.meetingTitle || participants.join(', ') || 'Untitled Meeting';
                  return (
                    <Link key={m.id} href={`/meeting/${m.id}`}>
                      <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-800 hover:border-yellow-600/30 cursor-pointer transition-all">
                        <p className="text-sm font-medium text-white">{displayTitle}</p>
                        <p className="text-xs text-yellow-600/70 mt-0.5">{participants.join(', ')}</p>
                        <p className="text-xs text-zinc-500 mt-1">
                          {new Date(m.meetingDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          {' · '}{m.sourceType}
                        </p>
                        <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{m.executiveSummary}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// PEOPLE DIRECTORY - Contacts extracted from meetings
// ============================================================================

function PeopleDirectory() {
  const { data: contacts, isLoading: contactsLoading } = trpc.contacts.list.useQuery();
  const { data: meetings, isLoading: meetingsLoading } = trpc.meetings.list.useQuery({ limit: 100, offset: 0 });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);

  const isLoading = contactsLoading || meetingsLoading;

  // Build a unified people list from meeting participants
  const people = useMemo(() => {
    if (!meetings) return [];
    const nameMap = new Map<string, {
      name: string;
      orgs: Set<string>;
      emails: Set<string>;
      meetingCount: number;
      lastMeeting: string;
      meetingIds: number[];
    }>();

    for (const m of meetings) {
      const participants = (() => { try { return JSON.parse(m.participants || '[]') as string[]; } catch { return []; } })();
      const orgs = (() => { try { return JSON.parse(m.organizations || '[]') as string[]; } catch { return []; } })();

      for (const p of participants) {
        const trimmed = p.trim();
        if (!trimmed) continue;
        const key = trimmed.toLowerCase();
        const existing = nameMap.get(key);
        if (existing) {
          existing.meetingCount++;
          orgs.forEach(o => existing.orgs.add(o));
          existing.meetingIds.push(m.id);
          if (new Date(m.meetingDate) > new Date(existing.lastMeeting)) {
            existing.lastMeeting = m.meetingDate as any;
          }
        } else {
          nameMap.set(key, {
            name: trimmed,
            orgs: new Set(orgs),
            emails: new Set(),
            meetingCount: 1,
            lastMeeting: m.meetingDate as any,
            meetingIds: [m.id],
          });
        }
      }
    }

    // Enrich with contact data if available
    if (contacts) {
      for (const c of contacts) {
        const key = c.name.toLowerCase();
        const existing = nameMap.get(key);
        if (existing) {
          if (c.email) existing.emails.add(c.email);
          if (c.organization) existing.orgs.add(c.organization);
        }
      }
    }

    return Array.from(nameMap.values())
      .sort((a, b) => b.meetingCount - a.meetingCount);
  }, [contacts, meetings]);

  const filteredPeople = useMemo(() => {
    if (!searchTerm) return people;
    const lower = searchTerm.toLowerCase();
    return people.filter(p =>
      p.name.toLowerCase().includes(lower) ||
      Array.from(p.orgs).join(' ').toLowerCase().includes(lower) ||
      Array.from(p.emails).join(' ').toLowerCase().includes(lower)
    );
  }, [people, searchTerm]);

  // Get meetings for selected person
  const personMeetings = useMemo(() => {
    if (!selectedPerson || !meetings) return [];
    return meetings.filter(m => {
      const participants = (() => { try { return JSON.parse(m.participants || '[]') as string[]; } catch { return []; } })();
      return participants.some(p => p.toLowerCase() === selectedPerson.toLowerCase());
    }).sort((a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime());
  }, [selectedPerson, meetings]);

  const selectedPersonData = people.find(p => p.name.toLowerCase() === selectedPerson?.toLowerCase());

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-14 bg-zinc-800/50 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* People List */}
      <div className="lg:col-span-2 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Search people by name or organization..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600"
          />
        </div>

        <p className="text-xs text-zinc-600">{filteredPeople.length} contacts</p>

        {filteredPeople.length === 0 ? (
          <div className="text-center py-16">
            <Users className="h-12 w-12 mx-auto mb-3 text-zinc-700" />
            <p className="text-zinc-500">No contacts found</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredPeople.map(person => (
              <button
                key={person.name}
                onClick={() => setSelectedPerson(
                  selectedPerson?.toLowerCase() === person.name.toLowerCase() ? null : person.name
                )}
                className={`w-full flex items-center gap-4 p-3 rounded-lg transition-all text-left
                  ${selectedPerson?.toLowerCase() === person.name.toLowerCase()
                    ? 'bg-yellow-600/10 border border-yellow-600/30'
                    : 'bg-zinc-900/30 border border-transparent hover:bg-zinc-800/50 hover:border-zinc-800'}
                `}
              >
                {/* Avatar */}
                <div className="h-9 w-9 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-yellow-600">
                    {person.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{person.name}</p>
                  {person.orgs.size > 0 && (
                    <p className="text-xs text-zinc-500 truncate">{Array.from(person.orgs).join(', ')}</p>
                  )}
                </div>

                {/* Meta */}
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-zinc-500">
                    {person.meetingCount} meeting{person.meetingCount !== 1 ? 's' : ''}
                  </p>
                  {person.emails.size > 0 && (
                    <p className="text-xs text-zinc-600 truncate max-w-32">{Array.from(person.emails)[0]}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Person Detail Panel */}
      <div>
        <Card className="bg-zinc-900/50 border-zinc-800 sticky top-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white">
              {selectedPersonData ? selectedPersonData.name : 'Select a person'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedPersonData ? (
              <p className="text-sm text-zinc-500">Click a name to see their profile and meeting history</p>
            ) : (
              <div className="space-y-4">
                {/* Contact Info */}
                <div className="space-y-2">
                  {selectedPersonData.orgs.size > 0 && (
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <Building2 className="h-4 w-4 text-zinc-600" />
                      <span>{Array.from(selectedPersonData.orgs).join(', ')}</span>
                    </div>
                  )}
                  {selectedPersonData.emails.size > 0 && (
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <Mail className="h-4 w-4 text-zinc-600" />
                      {Array.from(selectedPersonData.emails).map(email => (
                        <a key={email} href={`mailto:${email}`} className="hover:text-yellow-500 transition-colors">
                          {email}
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <Calendar className="h-4 w-4 text-zinc-600" />
                    <span>Last seen: {new Date(selectedPersonData.lastMeeting).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>

                <Separator className="bg-zinc-800" />

                {/* Meetings with this person */}
                <div>
                  <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                    Meetings ({personMeetings.length})
                  </h4>
                  {personMeetings.length === 0 ? (
                    <p className="text-sm text-zinc-600">No meetings found</p>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {personMeetings.map(m => {
                        const participants = (() => { try { return JSON.parse(m.participants || '[]'); } catch { return []; } })();
                        const displayTitle = m.meetingTitle || participants.join(', ') || 'Untitled Meeting';
                        return (
                          <Link key={m.id} href={`/meeting/${m.id}`}>
                            <div className="p-2.5 rounded-lg bg-zinc-800/50 border border-zinc-800 hover:border-yellow-600/30 cursor-pointer transition-all">
                              <p className="text-sm font-medium text-white truncate">{displayTitle}</p>
                              <p className="text-xs text-zinc-500 mt-0.5">
                                {new Date(m.meetingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </p>
                              <p className="text-xs text-zinc-400 line-clamp-2 mt-0.5">{m.executiveSummary}</p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
