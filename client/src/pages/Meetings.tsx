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
      const participants = JSON.parse(m.participants || '[]').join(' ').toLowerCase();
      const orgs = JSON.parse(m.organizations || '[]').join(' ').toLowerCase();
      return (
        participants.includes(lower) ||
        orgs.includes(lower) ||
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
          placeholder="Search meetings by name, org, or keyword..."
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
  const participants = JSON.parse(meeting.participants || '[]');
  const organizations = JSON.parse(meeting.organizations || '[]');
  const tags = trpc.meetings.getTags.useQuery({ meetingId: meeting.id });

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
            <p className="text-sm font-medium text-white truncate">
              {participants.join(', ') || 'Unknown Participants'}
            </p>
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

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  const selectedMeetings = selectedDate ? (meetingsByDate[selectedDate] || []) : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar Grid */}
      <div className="lg:col-span-2">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={prevMonth} className="text-zinc-400 hover:text-white">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-lg text-white">
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={nextMonth} className="text-zinc-400 hover:text-white">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="text-center text-xs font-medium text-zinc-500 py-2">{d}</div>
              ))}
            </div>
            {/* Calendar cells */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayMeetings = meetingsByDate[dateKey] || [];
                const isSelected = selectedDate === dateKey;
                const isToday = dateKey === new Date().toISOString().split('T')[0];

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDate(isSelected ? null : dateKey)}
                    className={`aspect-square rounded-lg flex flex-col items-center justify-center relative transition-all text-sm
                      ${isSelected ? 'bg-yellow-600/20 border border-yellow-600/50 text-yellow-500' :
                        isToday ? 'bg-zinc-800 text-white border border-zinc-700' :
                        dayMeetings.length > 0 ? 'bg-zinc-800/50 text-white hover:bg-zinc-800' :
                        'text-zinc-500 hover:bg-zinc-800/30'}
                    `}
                  >
                    <span className="font-medium">{day}</span>
                    {dayMeetings.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5">
                        {dayMeetings.slice(0, 3).map((_, idx) => (
                          <div key={idx} className="h-1 w-1 rounded-full bg-yellow-500" />
                        ))}
                        {dayMeetings.length > 3 && (
                          <span className="text-[8px] text-yellow-500 ml-0.5">+{dayMeetings.length - 3}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Selected Date Meetings */}
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
                  const participants = JSON.parse(m.participants || '[]');
                  return (
                    <Link key={m.id} href={`/meeting/${m.id}`}>
                      <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-800 hover:border-yellow-600/30 cursor-pointer transition-all">
                        <p className="text-sm font-medium text-white">{participants.join(', ')}</p>
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
  const [selectedContact, setSelectedContact] = useState<number | null>(null);

  const isLoading = contactsLoading || meetingsLoading;

  // Build a people list from meetings (since contacts table may be empty initially)
  const people = useMemo(() => {
    if (contacts && contacts.length > 0) {
      // Enrich contacts with meeting counts
      return contacts.map(c => {
        const meetingCount = meetings?.filter(m => {
          const participants = JSON.parse(m.participants || '[]') as string[];
          return participants.some(p => p.toLowerCase() === c.name.toLowerCase());
        }).length || 0;
        return { ...c, meetingCount };
      }).sort((a, b) => b.meetingCount - a.meetingCount);
    }
    // Fallback: extract from meeting participants
    if (!meetings) return [];
    const nameMap = new Map<string, { name: string; orgs: Set<string>; meetingCount: number; lastMeeting: string }>();
    for (const m of meetings) {
      const participants = JSON.parse(m.participants || '[]') as string[];
      const orgs = JSON.parse(m.organizations || '[]') as string[];
      for (const p of participants) {
        const trimmed = p.trim();
        if (!trimmed) continue;
        const existing = nameMap.get(trimmed);
        if (existing) {
          existing.meetingCount++;
          orgs.forEach(o => existing.orgs.add(o));
          if (new Date(m.meetingDate) > new Date(existing.lastMeeting)) {
            existing.lastMeeting = m.meetingDate as any;
          }
        } else {
          nameMap.set(trimmed, {
            name: trimmed,
            orgs: new Set(orgs),
            meetingCount: 1,
            lastMeeting: m.meetingDate as any,
          });
        }
      }
    }
    return Array.from(nameMap.values())
      .sort((a, b) => b.meetingCount - a.meetingCount)
      .map((p, idx) => ({
        id: idx + 1,
        name: p.name,
        organization: Array.from(p.orgs).join(', ') || null,
        email: null as string | null,
        phone: null as string | null,
        title: null as string | null,
        notes: null as string | null,
        meetingCount: p.meetingCount,
        lastMeeting: p.lastMeeting,
      }));
  }, [contacts, meetings]);

  const filteredPeople = useMemo(() => {
    if (!searchTerm) return people;
    const lower = searchTerm.toLowerCase();
    return people.filter(p =>
      p.name.toLowerCase().includes(lower) ||
      (p.organization && p.organization.toLowerCase().includes(lower)) ||
      (p.email && p.email.toLowerCase().includes(lower))
    );
  }, [people, searchTerm]);

  // Get meetings for selected contact
  const contactMeetings = useMemo(() => {
    if (selectedContact === null || !meetings || !people) return [];
    const person = people.find(p => p.id === selectedContact);
    if (!person) return [];
    return meetings.filter(m => {
      const participants = JSON.parse(m.participants || '[]') as string[];
      return participants.some(p => p.toLowerCase() === person.name.toLowerCase());
    });
  }, [selectedContact, meetings, people]);

  const selectedPerson = people.find(p => p.id === selectedContact);

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
                key={person.id}
                onClick={() => setSelectedContact(selectedContact === person.id ? null : person.id)}
                className={`w-full flex items-center gap-4 p-3 rounded-lg transition-all text-left
                  ${selectedContact === person.id
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
                  {person.organization && (
                    <p className="text-xs text-zinc-500 truncate">{person.organization}</p>
                  )}
                </div>

                {/* Meta */}
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-zinc-500">
                    {person.meetingCount} meeting{person.meetingCount !== 1 ? 's' : ''}
                  </p>
                  {person.email && (
                    <p className="text-xs text-zinc-600 truncate max-w-32">{person.email}</p>
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
              {selectedPerson ? selectedPerson.name : 'Select a person'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedPerson ? (
              <p className="text-sm text-zinc-500">Click a name to see their profile and meeting history</p>
            ) : (
              <div className="space-y-4">
                {/* Contact Info */}
                <div className="space-y-2">
                  {selectedPerson.organization && (
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <Building2 className="h-4 w-4 text-zinc-600" />
                      <span>{selectedPerson.organization}</span>
                    </div>
                  )}
                  {selectedPerson.title && (
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <Briefcase className="h-4 w-4 text-zinc-600" />
                      <span>{selectedPerson.title}</span>
                    </div>
                  )}
                  {selectedPerson.email && (
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <Mail className="h-4 w-4 text-zinc-600" />
                      <a href={`mailto:${selectedPerson.email}`} className="hover:text-yellow-500 transition-colors">
                        {selectedPerson.email}
                      </a>
                    </div>
                  )}
                  {selectedPerson.phone && (
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <Phone className="h-4 w-4 text-zinc-600" />
                      <span>{selectedPerson.phone}</span>
                    </div>
                  )}
                </div>

                {selectedPerson.notes && (
                  <>
                    <Separator className="bg-zinc-800" />
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Summary</h4>
                      <p className="text-sm text-zinc-400 leading-relaxed">{selectedPerson.notes}</p>
                    </div>
                  </>
                )}

                <Separator className="bg-zinc-800" />

                {/* Meetings with this person */}
                <div>
                  <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                    Meetings ({contactMeetings.length})
                  </h4>
                  {contactMeetings.length === 0 ? (
                    <p className="text-sm text-zinc-600">No meetings found</p>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {contactMeetings.map(m => (
                        <Link key={m.id} href={`/meeting/${m.id}`}>
                          <div className="p-2.5 rounded-lg bg-zinc-800/50 border border-zinc-800 hover:border-yellow-600/30 cursor-pointer transition-all">
                            <p className="text-xs text-zinc-500">
                              {new Date(m.meetingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                            <p className="text-sm text-zinc-300 line-clamp-2 mt-0.5">{m.executiveSummary}</p>
                          </div>
                        </Link>
                      ))}
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
