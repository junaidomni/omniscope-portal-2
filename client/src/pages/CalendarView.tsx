import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  Calendar, ChevronLeft, ChevronRight, Clock, Plus,
  Users, MapPin, Video, ExternalLink, Globe, Trash2, X,
  RefreshCw, CheckCircle2, AlertCircle
} from "lucide-react";
import { toast } from "sonner";

// ============================================================================
// TIMEZONE CLOCKS
// ============================================================================

const TIMEZONES = [
  { label: "EST", zone: "America/New_York", city: "New York" },
  { label: "PST", zone: "America/Los_Angeles", city: "LA" },
  { label: "GMT", zone: "Europe/London", city: "London" },
  { label: "GST", zone: "Asia/Dubai", city: "Dubai" },
  { label: "PKT", zone: "Asia/Karachi", city: "Islamabad" },
  { label: "JST", zone: "Asia/Tokyo", city: "Tokyo" },
];

function TimezoneClock({ zone, city }: { zone: string; label: string; city: string }) {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit", hour12: true }));
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [zone]);

  return (
    <div className="text-center px-3 py-1.5">
      <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">{city}</p>
      <p className="text-base font-bold text-white tabular-nums">{time}</p>
    </div>
  );
}

// ============================================================================
// CALENDAR PAGE
// ============================================================================

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  location?: string;
  attendees: string[];
  hangoutLink?: string;
  isAllDay: boolean;
  source?: string;
}

export default function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const syncFromGoogle = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/calendar/sync', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        toast.success(`Synced ${data.synced} new, ${data.updated} updated events from Google Calendar`);
        fetchEvents();
      } else {
        toast.error("Failed to sync from Google Calendar");
      }
    } catch {
      toast.error("Failed to sync from Google Calendar");
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchEvents = async () => {
    setIsLoadingEvents(true);
    try {
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);
      
      const response = await fetch(`/api/calendar/events?` + new URLSearchParams({
        timeMin: startOfMonth.toISOString(),
        timeMax: endOfMonth.toISOString(),
        maxResults: "250",
      }));
      
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error("Failed to fetch calendar events:", err);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  useEffect(() => { fetchEvents(); }, [currentMonth]);

  // Group events by LOCAL date (not UTC) so they appear on the correct calendar day
  const getLocalDateKey = (isoString: string): string => {
    const d = new Date(isoString);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const e of events) {
      const dateKey = getLocalDateKey(e.start);
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(e);
    }
    return map;
  }, [events]);

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  const goToToday = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      const response = await fetch(`/api/calendar/events/${eventId}`, { method: 'DELETE' });
      if (response.ok) {
        toast.success("Event deleted");
        fetchEvents();
      } else {
        toast.error("Failed to delete event");
      }
    } catch {
      toast.error("Failed to delete event");
    }
  };

  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] || []) : [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Calendar</h1>
            <p className="text-sm text-zinc-500 mt-1">Schedule and manage meetings across time zones</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={syncFromGoogle}
              disabled={isSyncing}
              className="border-zinc-700 text-zinc-400 hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync'}
            </Button>
            <Dialog open={showNewEvent} onOpenChange={setShowNewEvent}>
              <DialogTrigger asChild>
                <Button className="bg-yellow-600 hover:bg-yellow-500 text-black font-medium">
                  <Plus className="h-4 w-4 mr-2" />
                  New Event
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-white">Create Event</DialogTitle>
                </DialogHeader>
                <NewEventForm
                  defaultDate={selectedDate || undefined}
                  onSuccess={() => {
                    setShowNewEvent(false);
                    fetchEvents();
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Timezone Strip */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg px-4 py-2">
          <div className="flex items-center gap-1 overflow-x-auto">
            <Globe className="h-4 w-4 text-zinc-600 flex-shrink-0 mr-2" />
            {TIMEZONES.map((tz, idx) => (
              <div key={tz.zone} className="flex items-center">
                <TimezoneClock zone={tz.zone} label={tz.label} city={tz.city} />
                {idx < TIMEZONES.length - 1 && (
                  <Separator orientation="vertical" className="h-6 bg-zinc-800 mx-1" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar Grid + Day Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={prevMonth} className="text-zinc-400 hover:text-white">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <CardTitle className="text-lg text-white min-w-40 text-center">
                    {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={nextMonth} className="text-zinc-400 hover:text-white">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <Button variant="outline" size="sm" onClick={goToToday} className="border-zinc-700 text-zinc-400 hover:text-white">
                  Today
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
                  const dayEvents = eventsByDate[dateKey] || [];
                  const isSelected = selectedDate === dateKey;
                  const isToday = dateKey === new Date().toISOString().split('T')[0];

                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDate(isSelected ? null : dateKey)}
                      className={`aspect-square rounded-lg flex flex-col items-center justify-center relative transition-all text-sm
                        ${isSelected ? 'bg-yellow-600/20 border border-yellow-600/50 text-yellow-500' :
                          isToday ? 'bg-zinc-800 text-white border border-zinc-700' :
                          dayEvents.length > 0 ? 'bg-zinc-800/50 text-white hover:bg-zinc-800' :
                          'text-zinc-500 hover:bg-zinc-800/30'}
                      `}
                    >
                      <span className="font-medium">{day}</span>
                      {dayEvents.length > 0 && (
                        <div className="flex gap-0.5 mt-0.5">
                          {dayEvents.slice(0, 3).map((_, idx) => (
                            <div key={idx} className="h-1 w-1 rounded-full bg-yellow-600" />
                          ))}
                          {dayEvents.length > 3 && (
                            <span className="text-[8px] text-yellow-500 ml-0.5">+{dayEvents.length - 3}</span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {isLoadingEvents && (
                <div className="mt-4 flex items-center justify-center gap-2 text-zinc-500 text-sm">
                  <div className="h-3 w-3 border border-zinc-500 border-t-transparent rounded-full animate-spin" />
                  Loading events...
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Day Detail Panel */}
        <div>
          <Card className="bg-zinc-900/50 border-zinc-800 sticky top-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-white">
                  {selectedDate
                    ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                    : 'Select a date'}
                </CardTitle>
                {selectedDate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowNewEvent(true);
                    }}
                    className="text-yellow-600 hover:text-yellow-500 h-7 px-2"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add
                  </Button>
                )}
              </div>
              {selectedDate && selectedEvents.length > 0 && (
                <p className="text-xs text-zinc-500">{selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''}</p>
              )}
            </CardHeader>
            <CardContent>
              {!selectedDate ? (
                <p className="text-sm text-zinc-500">Click a date to see events</p>
              ) : selectedEvents.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-10 w-10 mx-auto mb-2 text-zinc-700" />
                  <p className="text-sm text-zinc-500">No events on this date</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowNewEvent(true)}
                    className="text-yellow-600 hover:text-yellow-500 mt-2"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Create Event
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                  {selectedEvents
                    .sort((a, b) => a.start.localeCompare(b.start))
                    .map(event => (
                    <div key={event.id} className="group p-3 rounded-lg bg-zinc-800/50 border border-zinc-800 hover:border-yellow-600/30 transition-all">
                      <div className="flex items-start justify-between">
                        <p className="text-sm font-medium text-white flex-1">{event.summary}</p>
                        {event.source === "local" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm("Delete this event?")) handleDeleteEvent(event.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 h-6 w-6 p-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
                        <Clock className="h-3 w-3" />
                        {event.isAllDay ? (
                          <span>All Day</span>
                        ) : (
                          <span>
                            {new Date(event.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            {' – '}
                            {new Date(event.end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        )}
                      </div>

                      {event.location && (
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-zinc-500">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{event.location}</span>
                        </div>
                      )}

                      {event.attendees.length > 0 && (
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-zinc-500">
                          <Users className="h-3 w-3" />
                          <span className="truncate">{event.attendees.join(', ')}</span>
                        </div>
                      )}

                      {event.hangoutLink && (
                        <a
                          href={event.hangoutLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 mt-2 text-xs text-yellow-600 hover:text-yellow-500"
                        >
                          <Video className="h-3 w-3" />
                          Join Google Meet
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// NEW EVENT FORM (Google Calendar-style)
// ============================================================================

function NewEventForm({
  defaultDate,
  onSuccess,
}: {
  defaultDate?: string;
  onSuccess: () => void;
}) {
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(defaultDate || new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [location, setLocation] = useState("");
  const [attendeesInput, setAttendeesInput] = useState("");
  const [attendeesList, setAttendeesList] = useState<string[]>([]);
  const [addGoogleMeet, setAddGoogleMeet] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addAttendee = () => {
    const email = attendeesInput.trim().toLowerCase();
    if (email && email.includes("@") && !attendeesList.includes(email)) {
      setAttendeesList([...attendeesList, email]);
      setAttendeesInput("");
    }
  };

  const removeAttendee = (email: string) => {
    setAttendeesList(attendeesList.filter(a => a !== email));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) {
      toast.error("Please enter an event title");
      return;
    }
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: summary.trim(),
          description: description.trim() || undefined,
          startTime: `${date}T${startTime}:00`,
          endTime: `${date}T${endTime}:00`,
          location: location.trim() || undefined,
          attendees: attendeesList,
          addGoogleMeet,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.syncedToGoogle) {
          const parts = [];
          parts.push("Event created in Google Calendar");
          if (attendeesList.length > 0) parts.push(`Invitations sent to ${attendeesList.length} guest${attendeesList.length > 1 ? 's' : ''}`);
          toast.success(parts.join(" · "), { duration: 5000 });
        } else {
          toast.success("Event saved locally (Google Calendar sync unavailable)");
        }
        onSuccess();
      } else {
        const err = await response.json();
        toast.error(err.error || "Failed to create event");
      }
    } catch {
      toast.error("Failed to create event");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Title */}
      <Input
        placeholder="Add title"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 text-lg h-12"
        autoFocus
      />

      {/* Date & Time */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-zinc-400">
          <Clock className="h-4 w-4" />
          <span className="text-sm">Date & Time</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-zinc-300"
          />
          <Input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-zinc-300"
          />
          <Input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-zinc-300"
          />
        </div>
      </div>

      {/* Guests */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-zinc-400">
          <Users className="h-4 w-4" />
          <span className="text-sm">Add guests</span>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Enter email address"
            value={attendeesInput}
            onChange={(e) => setAttendeesInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAttendee(); } }}
            className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
          />
          <Button type="button" onClick={addAttendee} variant="outline" className="border-zinc-700 text-zinc-300 hover:text-white">
            Add
          </Button>
        </div>
        {attendeesList.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {attendeesList.map(email => (
              <Badge key={email} variant="outline" className="border-zinc-700 text-zinc-300 gap-1 pr-1">
                {email}
                <button type="button" onClick={() => removeAttendee(email)} className="ml-1 hover:text-red-400">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Google Meet */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
        <div className="flex items-center gap-3">
          <Video className="h-4 w-4 text-yellow-600" />
          <div>
            <p className="text-sm text-white font-medium">Add Google Meet video conferencing</p>
            <p className="text-xs text-zinc-500">Include a Meet link for virtual attendance</p>
          </div>
        </div>
        <Switch
          checked={addGoogleMeet}
          onCheckedChange={setAddGoogleMeet}
        />
      </div>

      {/* Location */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-zinc-400">
          <MapPin className="h-4 w-4" />
          <span className="text-sm">Add location</span>
        </div>
        <Input
          placeholder="Add location or meeting room"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Textarea
          placeholder="Add description or notes..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 min-h-20"
        />
      </div>

      {/* Info notice */}
      {attendeesList.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-600/10 border border-yellow-600/20">
          <CheckCircle2 className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-yellow-600/80">
            This event will be created in Google Calendar and email invitations will be sent to all guests automatically.
          </p>
        </div>
      )}

      {/* Submit */}
      <DialogFooter>
        <Button
          type="submit"
          disabled={!summary.trim() || isSubmitting}
          className="bg-yellow-600 hover:bg-yellow-500 text-black font-medium px-8"
        >
          {isSubmitting ? "Creating..." : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}
