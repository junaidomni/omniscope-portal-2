import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Users, Building2 } from "lucide-react";
import { Link } from "wouter";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, isSameDay } from "date-fns";

export default function CalendarView() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  // Get all meetings
  const { data: allMeetings = [] } = trpc.meetings.list.useQuery({});

  // Filter meetings for selected date
  const meetingsForSelectedDate = allMeetings.filter(meeting => 
    isSameDay(new Date(meeting.meetingDate), selectedDate)
  );

  // Get meetings count for each date in current month
  const getMeetingCountForDate = (date: Date) => {
    return allMeetings.filter(meeting => 
      isSameDay(new Date(meeting.meetingDate), date)
    ).length;
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Calendar View</h1>
        <p className="text-zinc-400">View and filter meetings by date</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2 bg-zinc-900 border-zinc-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousMonth}
                className="border-zinc-700 hover:bg-zinc-800"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextMonth}
                className="border-zinc-700 hover:bg-zinc-800"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && setSelectedDate(date)}
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            className="rounded-md border-zinc-800"
          />

          {/* Meeting count indicators */}
          <div className="mt-4 text-sm text-zinc-400">
            <p>Click on a date to view meetings for that day</p>
          </div>
        </Card>

        {/* Selected Date Summary */}
        <Card className="bg-zinc-900 border-zinc-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CalendarIcon className="h-5 w-5 text-yellow-600" />
            <h3 className="text-lg font-semibold text-white">
              {format(selectedDate, 'MMMM d, yyyy')}
            </h3>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-zinc-800 rounded-lg">
              <p className="text-sm text-zinc-400">Meetings</p>
              <p className="text-2xl font-bold text-white">{meetingsForSelectedDate.length}</p>
            </div>

            <div className="p-4 bg-zinc-800 rounded-lg">
              <p className="text-sm text-zinc-400">Unique Participants</p>
              <p className="text-2xl font-bold text-white">
                {new Set(meetingsForSelectedDate.flatMap(m => m.participants?.split(',').map(p => p.trim()) || [])).size}
              </p>
            </div>

            <div className="p-4 bg-zinc-800 rounded-lg">
              <p className="text-sm text-zinc-400">Organizations</p>
              <p className="text-2xl font-bold text-white">
                {new Set(meetingsForSelectedDate.flatMap(m => m.organizations?.split(',').map(o => o.trim()) || [])).size}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Meetings for Selected Date */}
      <Card className="bg-zinc-900 border-zinc-800 p-6">
        <h3 className="text-xl font-semibold text-white mb-4">
          Meetings on {format(selectedDate, 'MMMM d, yyyy')}
        </h3>

        {meetingsForSelectedDate.length === 0 ? (
          <div className="text-center py-12">
            <CalendarIcon className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-400">No meetings on this date</p>
          </div>
        ) : (
          <div className="space-y-4">
            {meetingsForSelectedDate.map((meeting) => (
              <Link key={meeting.id} href={`/meeting/${meeting.id}`}>
                <Card className="bg-zinc-800 border-zinc-700 p-4 hover:bg-zinc-750 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-white">
                          {meeting.participants || 'Unnamed Meeting'}
                        </h4>
                        {meeting.sourceId && (
                          <span className="px-2 py-0.5 bg-zinc-700 text-zinc-300 text-xs rounded">
                            {meeting.sourceId}
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-zinc-400 line-clamp-2 mb-3">
                        {meeting.executiveSummary}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-zinc-500">
                        {meeting.participants && (
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <span>{meeting.participants.split(',').length} participants</span>
                          </div>
                        )}
                        {meeting.organizations && (
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            <span>{meeting.organizations}</span>
                          </div>
                        )}
                        <span>{format(new Date(meeting.meetingDate), 'h:mm a')}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
