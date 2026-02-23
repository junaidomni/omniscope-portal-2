import { Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function MobileCalls() {
  const { data: callsData, isLoading } = trpc.communications.getCallLogs.useQuery();
  
  const calls = callsData?.calls || [];
  
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
      <div className="flex-none border-b border-[#D4AF37]/30 bg-black/95 backdrop-blur-sm px-4 py-3">
        <h1 className="text-xl font-semibold text-[#D4AF37]">Calls</h1>
      </div>
      
      {/* Calls list */}
      <div className="flex-1 overflow-y-auto">
        {calls.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Phone className="h-16 w-16 text-gray-600 mb-4" />
            <p className="text-gray-400 mb-2">No call history</p>
            <p className="text-sm text-gray-500">Your calls will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-[#D4AF37]/10">
            {calls.map((call) => {
              const isIncoming = call.direction === "incoming";
              const isMissed = call.status === "missed";
              
              let Icon = PhoneOutgoing;
              let iconColor = "text-green-500";
              
              if (isMissed) {
                Icon = PhoneMissed;
                iconColor = "text-red-500";
              } else if (isIncoming) {
                Icon = PhoneIncoming;
                iconColor = "text-blue-500";
              }
              
              return (
                <div
                  key={call.id}
                  className="px-4 py-3 flex items-center gap-3 hover:bg-[#D4AF37]/5 active:bg-[#D4AF37]/10 transition-colors"
                >
                  {/* Call type icon */}
                  <div className={`flex-none ${iconColor}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  
                  {/* Avatar */}
                  <div className="flex-none w-10 h-10 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#F4D03F] flex items-center justify-center text-black font-semibold text-sm">
                    {call.participantName?.charAt(0).toUpperCase() || "?"}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate">
                      {call.participantName || "Unknown"}
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
                    className="flex-none p-2 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] hover:bg-[#D4AF37]/30 active:bg-[#D4AF37]/40 transition-colors"
                    title="Call back"
                  >
                    {call.type === "video" ? (
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
    </div>
  );
}
