import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Calendar, ChevronLeft, ChevronRight, Clock, Plus,
  Users, MapPin, Video, ExternalLink, Globe
} from "lucide-react";
import { toast } from "sonner";

// ============================================================================
// TIMEZONE CLOCKS
// ============================================================================

const TIMEZONES = [
  { label: "EST", zone: "America/New_York", city: "New York" },
  { label: "PST", zone: "America/Los_Angeles", city: "Los Angeles" },
  { label: "GMT", zone: "Europe/London", city: "London" },
  { label: "GST", zone: "Asia/Dubai", city: "Dubai" },
  { label: "PKT", zone: "Asia/Karachi", city: "Pakistan" },
  { label: "JST", zone: "Asia/Tokyo", city: "Tokyo" },
];

function TimezoneClock({ zone, label, city }: { zone: string; label: string; city: string }) {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit", hour12: true }));
      setDate(now.toLocaleDateString("en-US", { timeZone: zone, weekday: "short", month: "short", day: "numeric" }));
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [zone]);

  return (
    <div className="text-center px-3 py-2">
      <p className="text-xs text-zinc-500 font-medium">{city}</p>
      <p className="text-lg font-bold text-white tabular-nums">{time}</p>
      <p className="text-xs text-zinc-600">{label}</p>
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
}

export default function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [showNewEvent, setShowNewEvent] = useState(false);

  // Fetch Google Calendar events for the current month view
  useEffect(() => {
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
    fetchEvents();
  }, [currentMonth]);

  // Build a map of date -> events
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const e of events) {
      const dateKey = e.start.split('T')[0];
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
    setSelectedDate(now.toISOString().split('T')[0]);
  };

  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] || []) : [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header with Timezone Clocks */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Calendar</h1>
            <p className="text-sm text-zinc-500 mt-1">Google Calendar integration with global timezone view</p>
          </div>
          <Dialog open={showNewEvent} onOpenChange={setShowNewEvent}>
            <DialogTrigger asChild>
              <Button className="bg-yellow-600 hover:bg-yellow-500 text-black font-medium">
                <Plus className="h-4 w-4 mr-2" />
                New Event
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-white">Create Calendar Event</DialogTitle>
              </DialogHeader>
              <NewEventForm
                defaultDate={selectedDate || undefined}
                onSuccess={() => {
                  setShowNewEvent(false);
                  // Refresh events
                  const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
                  const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);
                  fetch(`/api/calendar/events?` + new URLSearchParams({
                    timeMin: startOfMonth.toISOString(),
                    timeMax: endOfMonth.toISOString(),
                    maxResults: "250",
                  })).then(r => r.json()).then(data => setEvents(data.events || []));
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Timezone Clocks */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="py-3">
            <div className="flex items-center gap-1 overflow-x-auto">
              <Globe className="h-4 w-4 text-zinc-600 flex-shrink-0 mr-2" />
              {TIMEZONES.map((tz, idx) => (
                <div key={tz.zone} className="flex items-center">
                  <TimezoneClock zone={tz.zone} label={tz.label} city={tz.city} />
                  {idx < TIMEZONES.length - 1 && (
                    <Separator orientation="vertical" className="h-8 bg-zinc-800 mx-1" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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
                            <div key={idx} className="h-1 w-1 rounded-full bg-yellow-500" />
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
                  Loading calendar events...
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Day Detail Panel */}
        <div>
          <Card className="bg-zinc-900/50 border-zinc-800 sticky top-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-white">
                {selectedDate
                  ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                  : 'Select a date'}
              </CardTitle>
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
                </div>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                  {selectedEvents
                    .sort((a, b) => a.start.localeCompare(b.start))
                    .map(event => (
                    <div key={event.id} className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-800 hover:border-yellow-600/30 transition-all">
                      <p className="text-sm font-medium text-white">{event.summary}</p>
                      
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
// NEW EVENT FORM
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
  const [attendees, setAttendees] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) return;
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
          attendees: attendees.split(',').map(a => a.trim()).filter(Boolean),
        }),
      });

      if (response.ok) {
        toast.success("Event created");
        onSuccess();
      } else {
        toast.error("Failed to create event");
      }
    } catch {
      toast.error("Failed to create event");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        placeholder="Event title..."
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
        autoFocus
      />

      <Textarea
        placeholder="Description (optional)..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 min-h-16"
      />

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

      <Input
        placeholder="Location (optional)..."
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
      />

      <Input
        placeholder="Attendee emails (comma-separated)..."
        value={attendees}
        onChange={(e) => setAttendees(e.target.value)}
        className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
      />

      <div className="flex justify-end pt-2">
        <Button
          type="submit"
          disabled={!summary.trim() || isSubmitting}
          className="bg-yellow-600 hover:bg-yellow-500 text-black font-medium"
        >
          {isSubmitting ? "Creating..." : "Create Event"}
        </Button>
      </div>
    </form>
  );
}
