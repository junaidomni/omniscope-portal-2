import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Phone, Video, Clock, Users, X, FileText, Sparkles } from "lucide-react";
import { CallTranscriptView } from "@/components/CallTranscriptView";
import { formatDistanceToNow, format, isToday, isYesterday, isThisWeek } from "date-fns";

interface CallHistoryPanelProps {
  channelId: number;
  onClose: () => void;
}

export function CallHistoryPanel({ channelId, onClose }: CallHistoryPanelProps) {
  const { data: calls, isLoading } = trpc.communications.getCallHistory.useQuery({ channelId });
  const [selectedCall, setSelectedCall] = useState<{ id: number; transcriptUrl?: string | null; summaryUrl?: string | null } | null>(null);

  // Group calls by date
  const groupedCalls = calls?.reduce((groups, call) => {
    const callDate = new Date(call.startedAt);
    let groupKey: string;

    if (isToday(callDate)) {
      groupKey = "Today";
    } else if (isYesterday(callDate)) {
      groupKey = "Yesterday";
    } else if (isThisWeek(callDate)) {
      groupKey = "This Week";
    } else {
      groupKey = format(callDate, "MMMM yyyy");
    }

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(call);
    return groups;
  }, {} as Record<string, typeof calls>);

  const formatDuration = (ms: number | null) => {
    if (!ms) return "0:00";
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-background border-l border-border shadow-lg z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-lg">Call History</h2>
          <p className="text-sm text-muted-foreground">
            {calls?.length || 0} total calls
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Call List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            Loading call history...
          </div>
        ) : !calls || calls.length === 0 ? (
          <div className="p-8 text-center">
            <Phone className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No calls yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Start a call to see it here
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-6">
            {Object.entries(groupedCalls || {}).map(([dateGroup, groupCalls]) => (
              <div key={dateGroup}>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  {dateGroup}
                </h3>
                <div className="space-y-2">
                  {groupCalls.map((call) => (
                    <Card key={call.id} className="p-4 hover:bg-accent/50 transition-colors cursor-pointer">
                      <div className="flex items-start gap-3">
                        {/* Call Type Icon */}
                        <div className={`p-2 rounded-lg ${
                          call.type === "video" 
                            ? "bg-blue-500/10 text-blue-500" 
                            : "bg-green-500/10 text-green-500"
                        }`}>
                          {call.type === "video" ? (
                            <Video className="h-4 w-4" />
                          ) : (
                            <Phone className="h-4 w-4" />
                          )}
                        </div>

                        {/* Call Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              {call.type === "video" ? "Video Call" : "Voice Call"}
                            </Badge>
                            <Badge 
                              variant={call.status === "completed" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {call.status}
                            </Badge>
                          </div>

                          {/* Time and Duration */}
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{formatDistanceToNow(new Date(call.startedAt), { addSuffix: true })}</span>
                            </div>
                            {call.duration && (
                              <div className="flex items-center gap-1">
                                <span>{formatDuration(call.duration)}</span>
                              </div>
                            )}
                          </div>

                          {/* Participants */}
                          {call.participants && call.participants.length > 0 && (
                            <div className="flex items-center gap-2">
                              <Users className="h-3 w-3 text-muted-foreground" />
                              <div className="flex -space-x-2">
                                {call.participants.slice(0, 3).map((participant: any) => (
                                  <Avatar key={participant.userId} className="h-6 w-6 border-2 border-background">
                                    <AvatarImage src={participant.user?.avatar} />
                                    <AvatarFallback className="text-xs">
                                      {participant.user?.name?.charAt(0) || "?"}
                                    </AvatarFallback>
                                  </Avatar>
                                ))}
                                {call.participants.length > 3 && (
                                  <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                                    <span className="text-xs text-muted-foreground">
                                      +{call.participants.length - 3}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {call.participants.length} {call.participants.length === 1 ? "participant" : "participants"}
                              </span>
                            </div>
                          )}

                          {/* Transcript/Summary Indicators */}
                          <div className="flex items-center gap-2 mt-3">
                            {call.transcriptUrl && (
                              <Badge variant="outline" className="text-xs flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                Transcript
                              </Badge>
                            )}
                            {call.summaryUrl && (
                              <Badge variant="outline" className="text-xs flex items-center gap-1">
                                <Sparkles className="h-3 w-3" />
                                Summary
                              </Badge>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="ml-auto h-7 text-xs"
                              onClick={() => setSelectedCall({ id: call.id, transcriptUrl: call.transcriptUrl, summaryUrl: call.summaryUrl })}
                            >
                              View Details
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Call Transcript View */}
      {selectedCall && (
        <CallTranscriptView
          callId={selectedCall.id}
          transcriptUrl={selectedCall.transcriptUrl}
          summaryUrl={selectedCall.summaryUrl}
          onClose={() => setSelectedCall(null)}
        />
      )}
    </div>
  );
}
