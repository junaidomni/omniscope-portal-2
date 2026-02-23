import { Phone, Video, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { NewCallDialog } from "@/components/mobile/NewCallDialog";

export default function MobileCalls() {
  const [, setLocation] = useLocation();
  const [showNewCallDialog, setShowNewCallDialog] = useState(false);
  
  // Get user's channels to find call history
  const { data: channelsData } = trpc.communications.listChannels.useQuery();
  const channels = channelsData?.channels || [];
  
  // Get call history from all channels
  const callHistoryQueries = channels.map(channel =>
    trpc.communications.getCallHistory.useQuery(
      { channelId: channel.id },
      { enabled: !!channel.id }
    )
  );
  
  // Flatten all call histories and add channel info
  const allCalls = callHistoryQueries
    .flatMap((query, index) => 
      (query.data || []).map(call => ({
        ...call,
        channelId: channels[index].id,
        channelName: channels[index].name,
      }))
    )
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  
  const isLoading = callHistoryQueries.some(q => q.isLoading);
  
  const startCallMutation = trpc.communications.startCall.useMutation({
    onSuccess: (data) => {
      toast.success("Call started");
      // Navigate to chat with active call
      setLocation(`/mobile/chat/${data.call.channelId}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to start call");
    },
  });
  
  const handleStartCall = (channelId: number, callType: "voice" | "video") => {
    startCallMutation.mutate({ channelId, type: callType });
  };
  
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-400">Loading calls...</div>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col bg-black">
      {/* Header */}
      <div className="flex-none border-b border-[#D4AF37]/30 bg-black/95 backdrop-blur-sm px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#D4AF37]">Calls</h1>
        <button
          onClick={() => setShowNewCallDialog(true)}
          className="p-2 rounded-full bg-[#D4AF37] text-black hover:bg-[#F4D03F] active:bg-[#C9A428] transition-colors"
          title="New call"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
      
      {/* Calls list */}
      <div className="flex-1 overflow-y-auto">
        {allCalls.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Phone className="h-16 w-16 text-gray-600 mb-4" />
            <p className="text-gray-400 mb-2">No call history</p>
            <p className="text-sm text-gray-500">Your calls will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-[#D4AF37]/10">
            {allCalls.map((call) => {
              const isVideo = call.callType === "video";
              const statusColor = call.status === "completed" ? "text-green-500" : 
                                 call.status === "missed" ? "text-red-500" : "text-gray-500";
              
              return (
                <div
                  key={call.id}
                  className="px-4 py-3 flex items-center gap-3 hover:bg-[#D4AF37]/5 active:bg-[#D4AF37]/10 transition-colors"
                >
                  {/* Call type icon */}
                  <div className={statusColor}>
                    {isVideo ? (
                      <Video className="h-5 w-5" />
                    ) : (
                      <Phone className="h-5 w-5" />
                    )}
                  </div>
                  
                  {/* Avatar */}
                  <div className="flex-none w-10 h-10 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#F4D03F] flex items-center justify-center text-black font-semibold text-sm">
                    {call.channelName?.charAt(0).toUpperCase() || "?"}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate">
                      {call.channelName || "Unknown Channel"}
                    </div>
                    <div className="text-sm text-gray-400">
                      {new Date(call.startedAt).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {call.duration && ` • ${Math.floor(call.duration / 60)}m ${call.duration % 60}s`}
                    </div>
                  </div>
                  
                  {/* Call back button */}
                  <button
                    onClick={() => handleStartCall(call.channelId, call.callType)}
                    disabled={startCallMutation.isPending}
                    className="flex-none p-2 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] hover:bg-[#D4AF37]/30 active:bg-[#D4AF37]/40 transition-colors disabled:opacity-50"
                    title="Call back"
                  >
                    {isVideo ? (
                      <Video className="h-5 w-5" />
                    ) : (
                      <Phone className="h-5 w-5" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* New Call Dialog */}
      <NewCallDialog
        open={showNewCallDialog}
        onOpenChange={setShowNewCallDialog}
      />
    </div>
  );
}
