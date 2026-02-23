import { useEffect, useState, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Calendar, Users, CheckSquare } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface MentionAutocompleteProps {
  query: string;
  position: { top: number; left: number };
  onSelect: (mention: MentionItem) => void;
  onClose: () => void;
  channelId?: number | null;
}

export interface MentionItem {
  type: "user" | "meeting" | "contact" | "task";
  id: number;
  name: string;
  avatar?: string;
  subtitle?: string;
}

export function MentionAutocomplete({ query, position, onSelect, onClose, channelId }: MentionAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeFilter, setActiveFilter] = useState<"meeting" | "task" | "user">("user");
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch channel members (users in this channel)
  const { data: channelDetails } = trpc.communications.getChannel.useQuery(
    { channelId: channelId! },
    { enabled: !!channelId }
  );
  
  // Filter users to only show channel members
  const channelMemberIds = channelDetails?.members.map(m => m.userId) || [];
  const users = channelDetails?.members.filter(m => 
    !query || m.user.name?.toLowerCase().includes(query.toLowerCase()) || m.user.email?.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 5).map(m => m.user) || [];

  // Search for meetings (fetch more to allow smart filtering)
  const { data: meetings } = trpc.meetings.list.useQuery(
    { search: query, limit: 20 },
    { enabled: query.length > 0 }
  );

  // Search for tasks (fetch more to allow smart filtering)
  const { data: tasks } = trpc.tasks.list.useQuery(
    { search: query, limit: 20 },
    { enabled: query.length > 0 }
  );
  
  // Smart filter: Prioritize meetings involving channel members
  const sortedMeetings = meetings?.meetings.sort((a, b) => {
    const aHasChannelMember = channelMemberIds.some(id => 
      a.primaryLead?.toLowerCase().includes(channelDetails?.members.find(m => m.userId === id)?.user.name?.toLowerCase() || '')
    );
    const bHasChannelMember = channelMemberIds.some(id => 
      b.primaryLead?.toLowerCase().includes(channelDetails?.members.find(m => m.userId === id)?.user.name?.toLowerCase() || '')
    );
    if (aHasChannelMember && !bHasChannelMember) return -1;
    if (!aHasChannelMember && bHasChannelMember) return 1;
    return new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime(); // Recent first
  }).slice(0, 5) || [];
  
  // Smart filter: Prioritize tasks assigned to channel members
  const sortedTasks = tasks?.tasks.sort((a, b) => {
    const aHasChannelMember = channelMemberIds.includes(a.assignedToId || 0);
    const bHasChannelMember = channelMemberIds.includes(b.assignedToId || 0);
    if (aHasChannelMember && !bHasChannelMember) return -1;
    if (!aHasChannelMember && bHasChannelMember) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); // Recent first
  }).slice(0, 5) || [];

  // Combine all results
  const allResults: MentionItem[] = [
    ...(sortedMeetings.map((m) => {
      // Format date
      const date = new Date(m.meetingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      
      // Format participants
      const participants = m.participants ? m.participants.split(',').map(p => p.trim()) : [];
      let participantsText = '';
      if (participants.length === 0 && m.primaryLead) {
        participantsText = m.primaryLead;
      } else if (participants.length <= 3) {
        participantsText = participants.join(', ');
      } else {
        participantsText = `${participants.slice(0, 2).join(', ')}, +${participants.length - 2} others`;
      }
      
      // Truncate summary
      const summary = m.executiveSummary || m.summary || '';
      const truncatedSummary = summary.length > 80 ? summary.substring(0, 80) + '...' : summary;
      
      // Build subtitle
      const subtitleParts = [date];
      if (participantsText) subtitleParts.push(participantsText);
      if (truncatedSummary) subtitleParts.push(truncatedSummary);
      
      return {
        type: "meeting" as const,
        id: m.id,
        name: m.title,
        subtitle: subtitleParts.join(' • '),
      };
    }) || []),
    ...(sortedTasks.map((t) => ({
      type: "task" as const,
      id: t.id,
      name: t.title,
      subtitle: t.status,
    })) || []),
    ...(users?.map((u) => ({
      type: "user" as const,
      id: u.id,
      name: u.name || u.email,
      avatar: u.profilePhotoUrl || undefined,
      subtitle: u.email,
    })) || []),
  ];
  
  // Filter results based on active filter
  const filteredResults = activeFilter === "all" 
    ? allResults 
    : allResults.filter((item) => item.type === activeFilter);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, allResults.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (allResults[selectedIndex]) {
          onSelect(allResults[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, filteredResults, onSelect, onClose]);
  
  // Reset selected index when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [activeFilter]);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedElement?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const filterTabs = [
    { value: "user" as const, label: "Team", icon: User },
    { value: "meeting" as const, label: "Meetings", icon: Calendar },
    { value: "task" as const, label: "Tasks", icon: CheckSquare },
  ];

  const getIcon = (type: MentionItem["type"]) => {
    switch (type) {
      case "user":
        return <User className="h-4 w-4" />;
      case "meeting":
        return <Calendar className="h-4 w-4" />;
      case "task":
        return <CheckSquare className="h-4 w-4" />;
    }
  };

  return (
    <div
      className="absolute z-50 w-96 bg-popover border rounded-md shadow-lg"
      style={{ top: position.top, left: position.left }}
    >
      {/* Filter Tabs */}
      <div className="flex border-b">
        {filterTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${
                activeFilter === tab.value
                  ? "bg-accent text-accent-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>
      
      {/* Results */}
      {filteredResults.length === 0 ? (
        <div className="p-4 text-sm text-muted-foreground text-center">
          No {activeFilter}s found for "{query}"
        </div>
      ) : (
        <ScrollArea className="max-h-64">
          <div ref={listRef} className="p-1">
            {filteredResults.map((item, index) => (
              <div
              key={`${item.type}-${item.id}`}
              data-index={index}
              onClick={() => onSelect(item)}
              className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-accent ${
                index === selectedIndex ? "bg-accent" : ""
              }`}
            >
              {item.type === "user" && item.avatar ? (
                <Avatar className="h-8 w-8">
                  <AvatarImage src={item.avatar} />
                  <AvatarFallback>{item.name[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
              ) : (
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  {getIcon(item.type)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{item.name}</div>
                {item.subtitle && (
                  <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
                )}
              </div>
              <div className="text-xs text-muted-foreground capitalize">{item.type}</div>
            </div>
            ))}
        </div>
      </ScrollArea>
      )}
    </div>
  );
}
