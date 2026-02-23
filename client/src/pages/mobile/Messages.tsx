import { useState } from "react";
import { Search, Plus, MessageSquare, Users, Hash, Trash2, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { NewDMDialog } from "@/components/mobile/NewDMDialog";
import { NewGroupDialog } from "@/components/mobile/NewGroupDialog";
import { NewChannelDialog } from "@/components/mobile/NewChannelDialog";

type TabType = "dms" | "groups" | "channels";

export default function MobileMessages() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("dms");
  const [showNewDM, setShowNewDM] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [, setLocation] = useLocation();
  const { data: user } = trpc.auth.me.useQuery();
  
  // Debug: Log current user
  console.log('[Mobile Messages] Current user:', user?.id, user?.name, user?.email);
  
  const utils = trpc.useUtils();
  const { data: channelsData, isLoading } = trpc.communications.listChannels.useQuery();
  
  // Debug: Log channels data
  console.log('[Mobile Messages] Channels loaded:', channelsData?.length || 0, 'channels');
  
  const channels = channelsData || [];
  
  // Filter channels by type
  const dmChannels = channels.filter(c => c.type === "dm");
  const groupChannels = channels.filter(c => c.type === "group");
  const publicChannels = channels.filter(c => c.type === "public" || c.type === "private");
  
  // Get active list based on tab
  const activeChannels = activeTab === "dms" ? dmChannels :
                         activeTab === "groups" ? groupChannels :
                         publicChannels;
  
  // Filter by search query
  const filteredChannels = activeChannels.filter(channel =>
    channel.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const deleteChannelMutation = trpc.communications.deleteChannel.useMutation({
    onSuccess: () => {
      toast.success("Channel deleted");
      utils.communications.listChannels.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete channel");
    },
  });
  
  const handleDelete = (channelId: number, channelName: string) => {
    if (confirm(`Delete "${channelName}"?`)) {
      deleteChannelMutation.mutate({ channelId });
    }
  };
  
  const handleNewChannel = () => {
    if (activeTab === "dms") {
      setShowNewDM(true);
    } else if (activeTab === "groups") {
      setShowNewGroup(true);
    } else {
      setShowNewChannel(true);
    }
  };
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await utils.communications.listChannels.invalidate();
    setTimeout(() => setIsRefreshing(false), 500);
  };
  
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-400">Loading messages...</div>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col bg-black">
      {/* Dialogs */}
      <NewDMDialog open={showNewDM} onOpenChange={setShowNewDM} />
      <NewGroupDialog open={showNewGroup} onOpenChange={setShowNewGroup} />
      <NewChannelDialog open={showNewChannel} onOpenChange={setShowNewChannel} />
      
      {/* Header */}
      <div className="flex-none border-b border-[#D4AF37]/30 bg-black/95 backdrop-blur-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-semibold text-[#D4AF37]">Messages</h1>
            <div className="flex gap-2">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-2 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] hover:bg-[#D4AF37]/30 active:bg-[#D4AF37]/40 transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleNewChannel}
                className="p-2 rounded-full bg-[#D4AF37] text-black hover:bg-[#F4D03F] active:bg-[#C9A428] transition-colors"
                title="New message"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-1 mb-3 bg-[#1a1a1a] rounded-lg p-1">
            <button
              onClick={() => setActiveTab("dms")}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md transition-colors ${
                activeTab === "dms"
                  ? "bg-[#D4AF37] text-black"
                  : "text-gray-400 hover:text-[#D4AF37]"
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              <span className="text-sm font-medium">DMs</span>
              {dmChannels.length > 0 && (
                <span className={`text-xs ${activeTab === "dms" ? "text-black/70" : "text-gray-500"}`}>
                  {dmChannels.length}
                </span>
              )}
            </button>
            
            <button
              onClick={() => setActiveTab("groups")}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md transition-colors ${
                activeTab === "groups"
                  ? "bg-[#D4AF37] text-black"
                  : "text-gray-400 hover:text-[#D4AF37]"
              }`}
            >
              <Users className="h-4 w-4" />
              <span className="text-sm font-medium">Groups</span>
              {groupChannels.length > 0 && (
                <span className={`text-xs ${activeTab === "groups" ? "text-black/70" : "text-gray-500"}`}>
                  {groupChannels.length}
                </span>
              )}
            </button>
            
            <button
              onClick={() => setActiveTab("channels")}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md transition-colors ${
                activeTab === "channels"
                  ? "bg-[#D4AF37] text-black"
                  : "text-gray-400 hover:text-[#D4AF37]"
              }`}
            >
              <Hash className="h-4 w-4" />
              <span className="text-sm font-medium">Channels</span>
              {publicChannels.length > 0 && (
                <span className={`text-xs ${activeTab === "channels" ? "text-black/70" : "text-gray-500"}`}>
                  {publicChannels.length}
                </span>
              )}
            </button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-2 bg-[#1a1a1a] border border-[#D4AF37]/30 rounded-lg text-sm text-foreground placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50"
            />
          </div>
        </div>
      </div>
      
      {/* Channels list */}
      <div className="flex-1 overflow-y-auto">
        {filteredChannels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <MessageSquare className="h-16 w-16 text-gray-600 mb-4" />
            <p className="text-gray-400 mb-2">
              {searchQuery ? "No results found" : `No ${activeTab} yet`}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              {activeTab === "dms" && "Start a conversation with someone"}
              {activeTab === "groups" && "Create a group to get started"}
              {activeTab === "channels" && "Join or create a channel"}
            </p>
            <button
              onClick={handleNewChannel}
              className="px-4 py-2 bg-[#D4AF37] text-black rounded-lg font-medium hover:bg-[#F4D03F] transition-colors"
            >
              {activeTab === "dms" && "New DM"}
              {activeTab === "groups" && "New Group"}
              {activeTab === "channels" && "New Channel"}
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#D4AF37]/10">
            {filteredChannels.map((channel) => {
              const unreadCount = channel.unreadCount || 0;
              
              return (
                <div
                  key={channel.id}
                  className="flex items-center hover:bg-[#D4AF37]/5 active:bg-[#D4AF37]/10 transition-colors"
                >
                  <button
                    onClick={() => setLocation(`/mobile/chat/${channel.id}`)}
                    className="flex-1 px-4 py-3 flex items-center gap-3 min-w-0"
                  >
                    {/* Avatar */}
                    <div className="flex-none w-12 h-12 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#F4D03F] flex items-center justify-center text-black font-semibold">
                      {channel.type === "dm" ? (
                        <MessageSquare className="h-6 w-6" />
                      ) : channel.type === "group" ? (
                        <Users className="h-6 w-6" />
                      ) : (
                        <Hash className="h-6 w-6" />
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground truncate">
                          {channel.name}
                        </span>
                        {unreadCount > 0 && (
                          <span className="flex-none px-2 py-0.5 bg-[#D4AF37] text-black text-xs font-semibold rounded-full">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                      {channel.lastMessage && (
                        <p className="text-sm text-gray-400 truncate">
                          {channel.lastMessage.content}
                        </p>
                      )}
                    </div>
                  </button>
                  
                  {/* Delete button */}
                  <button
                    onClick={() => handleDelete(channel.id, channel.name)}
                    className="flex-none p-3 text-red-500 hover:bg-red-500/10 active:bg-red-500/20 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
