import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Video, Clock, Users, Search, FileText, Sparkles, Filter } from "lucide-react";
import { formatDistanceToNow, format, isToday, isYesterday, isThisWeek } from "date-fns";
import { CallTranscriptView } from "@/components/CallTranscriptView";
import { ContactSearchCallInitiator } from "@/components/communications/ContactSearchCallInitiator";

type CallFilter = "all" | "voice" | "video" | "completed" | "missed";

export function AllCallsView() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<CallFilter>("all");
  const [selectedCall, setSelectedCall] = useState<{ id: number; transcriptUrl?: string | null; summaryUrl?: string | null } | null>(null);
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [showContactSearch, setShowContactSearch] = useState(false);

  // Fetch all calls across all channels (no channelId filter)
  const { data: allCalls, isLoading } = trpc.communications.getCallHistory.useQuery({});

  // Filter calls based on search and filter
  const filteredCalls = allCalls?.filter((call) => {
    // Search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const matchesChannel = call.channel?.name?.toLowerCase().includes(searchLower);
      const matchesParticipant = call.participants?.some((p: any) => 
        p.user?.name?.toLowerCase().includes(searchLower)
      );
      if (!matchesChannel && !matchesParticipant) return false;
    }

    // Type/Status filter
    if (filter === "voice" && call.type !== "voice") return false;
    if (filter === "video" && call.type !== "video") return false;
    if (filter === "completed" && call.status !== "completed") return false;
    if (filter === "missed" && call.status !== "missed") return false;

    return true;
  });

  // Group calls by date
  const groupedCalls = filteredCalls?.reduce((groups, call) => {
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
  }, {} as Record<string, typeof filteredCalls>);

  const formatDuration = (ms: number | null) => {
    if (!ms) return "0:00";
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-border space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Calls</h1>
          <Button
            onClick={() => setShowContactSearch(!showContactSearch)}
            variant="outline"
            className="gap-2"
          >
            <Phone className="h-4 w-4" />
            Start New Call
          </Button>
        </div>
        
        {/* Contact Search Section */}
        {showContactSearch && (
          <ContactSearchCallInitiator onClose={() => setShowContactSearch(false)} />
        )}
        
        {/* Search and Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search calls, channels, or participants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          {/* Filter Tabs */}
          <Tabs value={filter} onValueChange={(v) => setFilter(v as CallFilter)} className="w-auto">
            <TabsList>
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              <TabsTrigger value="voice" className="text-xs">Voice</TabsTrigger>
              <TabsTrigger value="video" className="text-xs">Video</TabsTrigger>
              <TabsTrigger value="completed" className="text-xs">Completed</TabsTrigger>
              <TabsTrigger value="missed" className="text-xs">Missed</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Calls List */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-12">
              Loading calls...
            </div>
          ) : !filteredCalls || filteredCalls.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <Phone className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">No calls found</p>
              <p className="text-sm mt-1">
                {searchQuery || filter !== "all" 
                  ? "Try adjusting your filters or search query" 
                  : "Start a call in any channel to see it here"}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedCalls || {}).map(([dateGroup, calls]) => (
                <div key={dateGroup}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    {dateGroup}
                  </h3>
                  <div className="space-y-2">
                    {calls.map((call: any) => (
                      <Card 
                        key={call.id} 
                        className="p-4 hover:bg-accent/50 transition-colors cursor-pointer"
                        onClick={() => setSelectedCall({ id: call.id, transcriptUrl: call.transcriptUrl, summaryUrl: call.summaryUrl })}
                      >
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
                            {/* Channel Name */}
                            <div className="font-medium mb-1">
                              {call.channel?.name || "Unknown Channel"}
                            </div>

                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="text-xs">
                                {call.type === "video" ? "Video Call" : "Voice Call"}
                              </Badge>
                              <Badge 
                                variant={call.status === "completed" ? "default" : call.status === "missed" ? "destructive" : "secondary"}
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
        </div>
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
