import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Plus,
  MessageSquare,
  Users,
  Hash,
  Briefcase,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { trpc } from "@/lib/trpc";

interface ChannelSidebarProps {
  selectedChannelId: number | null;
  onChannelSelect: (channelId: number) => void;
  onCreateChannel: () => void;
}

type FilterType = "all" | "messages" | "deal_rooms";

export function ChannelSidebar({
  selectedChannelId,
  onChannelSelect,
  onCreateChannel,
}: ChannelSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedDealRooms, setExpandedDealRooms] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<FilterType>("all");

  // Fetch all channels
  const { data: channels, isLoading: channelsLoading } = trpc.communications.listChannels.useQuery();
  
  // Fetch deal rooms
  const { data: dealRooms } = trpc.communications.listDealRooms.useQuery();

  // Toggle deal room expansion
  const toggleDealRoom = (dealRoomId: number) => {
    setExpandedDealRooms((prev) => {
      const next = new Set(prev);
      if (next.has(dealRoomId)) {
        next.delete(dealRoomId);
      } else {
        next.add(dealRoomId);
      }
      return next;
    });
  };

  // Group channels
  const regularChannels = channels?.filter(
    (c) => c.type === "group" && !c.parentChannelId
  ) || [];
  
  const dmChannels = channels?.filter((c) => c.type === "dm") || [];
  
  // Get sub-channels for each deal room
  const getSubChannels = (dealRoomId: number) => {
    return channels?.filter((c) => c.parentChannelId === dealRoomId) || [];
  };

  // Filter channels by search
  const filteredRegularChannels = regularChannels.filter((c) =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const filteredDMs = dmChannels.filter((c) =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const filteredDealRooms = dealRooms?.filter((dr) =>
    dr.name?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const renderChannel = (channel: any, indent = false) => (
    <button
      key={channel.id}
      onClick={() => onChannelSelect(channel.id)}
      className={`w-full p-3 rounded-lg text-left hover:bg-accent transition-colors ${
        selectedChannelId === channel.id ? "bg-accent" : ""
      } ${indent ? "ml-6" : ""}`}
    >
      <div className="flex items-start gap-3">
        {!indent && (
          <Avatar className="h-10 w-10 flex-shrink-0">
            <AvatarImage src={channel.avatar || undefined} />
            <AvatarFallback>
              {channel.type === "dm" ? (
                <MessageSquare className="h-5 w-5" />
              ) : channel.type === "group" ? (
                <Users className="h-5 w-5" />
              ) : (
                <Hash className="h-5 w-5" />
              )}
            </AvatarFallback>
          </Avatar>
        )}
        {indent && <Hash className="h-4 w-4 text-muted-foreground mt-1" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`font-medium truncate ${indent ? "text-sm" : ""}`}>
              {channel.name || "Unnamed Channel"}
            </span>
            {channel.unreadCount > 0 && (
              <Badge variant="default" className="h-5 min-w-[20px] flex items-center justify-center">
                {channel.unreadCount}
              </Badge>
            )}
          </div>
          {!indent && (
            <p className="text-sm text-muted-foreground truncate">
              {channel.lastMessageAt
                ? formatDistanceToNow(new Date(channel.lastMessageAt), { addSuffix: true })
                : "No messages"}
            </p>
          )}
        </div>
      </div>
    </button>
  );

  return (
    <Card className="w-80 flex flex-col">
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Messages</h2>
          <Button size="sm" variant="ghost" onClick={onCreateChannel}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
            className="flex-1"
          >
            All
          </Button>
          <Button
            size="sm"
            variant={filter === "messages" ? "default" : "outline"}
            onClick={() => setFilter("messages")}
            className="flex-1"
          >
            Messages
          </Button>
          <Button
            size="sm"
            variant={filter === "deal_rooms" ? "default" : "outline"}
            onClick={() => setFilter("deal_rooms")}
            className="flex-1"
          >
            Deal Rooms
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {channelsLoading ? (
          <div className="p-4 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="p-2 space-y-4">
            {/* Regular Channels */}
            {(filter === "all" || filter === "messages") && filteredRegularChannels.length > 0 && (
              <div>
                <h3 className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Channels
                </h3>
                <div className="space-y-1">
                  {filteredRegularChannels.map((channel) => renderChannel(channel))}
                </div>
              </div>
            )}

            {/* Deal Rooms */}
            {(filter === "all" || filter === "deal_rooms") && filteredDealRooms.length > 0 && (
              <div>
                <h3 className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Deal Rooms
                </h3>
                <div className="space-y-1">
                  {filteredDealRooms.map((dealRoom) => {
                    const subChannels = getSubChannels(dealRoom.id);
                    const isExpanded = expandedDealRooms.has(dealRoom.id);
                    
                    return (
                      <div key={dealRoom.id}>
                        {/* Deal Room Header */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggleDealRoom(dealRoom.id)}
                            className="p-1 hover:bg-accent rounded"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => onChannelSelect(dealRoom.id)}
                            className={`flex-1 p-2 rounded-lg text-left hover:bg-accent transition-colors ${
                              selectedChannelId === dealRoom.id ? "bg-accent" : ""
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Briefcase className="h-4 w-4 text-amber-500" />
                              <span className="font-medium text-sm truncate">
                                {dealRoom.name}
                              </span>
                              <Badge variant="outline" className="text-xs border-amber-500 text-amber-500">
                                {dealRoom.subChannelCount || 0}
                              </Badge>
                            </div>
                          </button>
                        </div>
                        
                        {/* Sub-channels */}
                        {isExpanded && subChannels.length > 0 && (
                          <div className="ml-4 mt-1 space-y-1">
                            {subChannels.map((subChannel) => renderChannel(subChannel, true))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Direct Messages */}
            {(filter === "all" || filter === "messages") && filteredDMs.length > 0 && (
              <div>
                <h3 className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Direct Messages
                </h3>
                <div className="space-y-1">
                  {filteredDMs.map((channel) => renderChannel(channel))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {filteredRegularChannels.length === 0 &&
              filteredDealRooms.length === 0 &&
              filteredDMs.length === 0 && (
                <div className="p-4 text-center text-muted-foreground">
                  {searchQuery ? "No channels found" : "No channels yet. Start a conversation!"}
                </div>
              )}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
}
