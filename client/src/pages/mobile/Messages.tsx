import { useState } from "react";
import { Search, Plus, MessageSquare } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

export default function MobileMessages() {
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();
  const { data: user } = trpc.auth.me.useQuery();
  
  const { data: channelsData, isLoading } = trpc.communications.listChannels.useQuery();
  
  const channels = channelsData?.channels || [];
  
  // Filter channels based on search
  const filteredChannels = channels.filter((ch) =>
    ch.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Separate DMs and groups
  const dms = filteredChannels.filter((ch) => ch.type === "dm");
  const groups = filteredChannels.filter((ch) => ch.type === "group");
  
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-400">Loading messages...</div>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col bg-black">
      {/* Header */}
      <div className="flex-none border-b border-[#D4AF37]/30 bg-black/95 backdrop-blur-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-semibold text-[#D4AF37]">Messages</h1>
            <button
              onClick={() => setLocation("/mobile/new-message")}
              className="p-2 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] hover:bg-[#D4AF37]/30 transition-colors"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#1a1a1a] border border-[#D4AF37]/30 rounded-lg text-sm text-foreground placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50"
            />
          </div>
        </div>
      </div>
      
      {/* Messages list */}
      <div className="flex-1 overflow-y-auto">
        {filteredChannels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <MessageSquare className="h-16 w-16 text-gray-600 mb-4" />
            <p className="text-gray-400 mb-2">No messages yet</p>
            <p className="text-sm text-gray-500">Start a conversation to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-[#D4AF37]/10">
            {/* Direct Messages */}
            {dms.length > 0 && (
              <div>
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-black/50">
                  Direct Messages
                </div>
                {dms.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => setLocation(`/mobile/chat/${channel.id}`)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#D4AF37]/5 active:bg-[#D4AF37]/10 transition-colors"
                  >
                    {/* Avatar */}
                    <div className="flex-none w-12 h-12 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#F4D03F] flex items-center justify-center text-black font-semibold">
                      {channel.name.charAt(0).toUpperCase()}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-foreground truncate">
                          {channel.name}
                        </span>
                        {channel.lastMessageAt && (
                          <span className="text-xs text-gray-500">
                            {new Date(channel.lastMessageAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 truncate">
                        {channel.lastMessage || "No messages yet"}
                      </p>
                    </div>
                    
                    {/* Unread badge */}
                    {channel.unreadCount > 0 && (
                      <div className="flex-none w-6 h-6 rounded-full bg-[#D4AF37] flex items-center justify-center">
                        <span className="text-xs font-bold text-black">
                          {channel.unreadCount > 99 ? "99+" : channel.unreadCount}
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
            
            {/* Groups */}
            {groups.length > 0 && (
              <div>
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-black/50">
                  Groups
                </div>
                {groups.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => setLocation(`/mobile/chat/${channel.id}`)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#D4AF37]/5 active:bg-[#D4AF37]/10 transition-colors"
                  >
                    {/* Avatar */}
                    <div className="flex-none w-12 h-12 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#F4D03F] flex items-center justify-center text-black font-semibold">
                      {channel.name.charAt(0).toUpperCase()}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-foreground truncate">
                          {channel.name}
                        </span>
                        {channel.lastMessageAt && (
                          <span className="text-xs text-gray-500">
                            {new Date(channel.lastMessageAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 truncate">
                        {channel.lastMessage || "No messages yet"}
                      </p>
                    </div>
                    
                    {/* Unread badge */}
                    {channel.unreadCount > 0 && (
                      <div className="flex-none w-6 h-6 rounded-full bg-[#D4AF37] flex items-center justify-center">
                        <span className="text-xs font-bold text-black">
                          {channel.unreadCount > 99 ? "99+" : channel.unreadCount}
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


