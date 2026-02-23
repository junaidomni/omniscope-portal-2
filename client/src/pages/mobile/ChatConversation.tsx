import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Send, Paperclip, Mic } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";

export default function MobileChatConversation() {
  const { channelId } = useParams<{ channelId: string }>();
  const [, setLocation] = useLocation();
  const { data: user } = trpc.auth.me.useQuery();
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { data: channelData } = trpc.communications.getChannel.useQuery(
    { channelId: parseInt(channelId!) },
    { enabled: !!channelId }
  );
  
  const { data: messagesData } = trpc.communications.listMessages.useQuery(
    { channelId: parseInt(channelId!), limit: 50 },
    { enabled: !!channelId, refetchInterval: 2000 }
  );
  
  const sendMessageMutation = trpc.communications.sendMessage.useMutation({
    onSuccess: () => {
      setMessage("");
    },
  });
  
  const messages = messagesData?.messages || [];
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  const handleSend = () => {
    if (!message.trim() || !channelId) return;
    
    sendMessageMutation.mutate({
      channelId: parseInt(channelId),
      content: message.trim(),
    });
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  return (
    <div className="h-full flex flex-col bg-black">
      {/* Header */}
      <div className="flex-none border-b border-[#D4AF37]/30 bg-black/95 backdrop-blur-sm">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setLocation("/mobile/messages")}
            className="p-2 -ml-2 rounded-full hover:bg-[#D4AF37]/10 active:bg-[#D4AF37]/20 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-[#D4AF37]" />
          </button>
          
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-[#D4AF37] truncate">
              {channelData?.name || "Chat"}
            </h1>
            {channelData?.type === "dm" && (
              <p className="text-xs text-gray-500">Direct Message</p>
            )}
          </div>
        </div>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-sm">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.senderId === user?.id;
            
            return (
              <div
                key={msg.id}
                className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  {!isOwn && (
                    <span className="text-xs text-gray-500 px-2">
                      {msg.senderName}
                    </span>
                  )}
                  
                  <div
                    className={`px-4 py-2 rounded-2xl ${
                      isOwn
                        ? "bg-[#D4AF37] text-black rounded-br-sm"
                        : "bg-[#1a1a1a] text-foreground rounded-bl-sm"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                  </div>
                  
                  <span className="text-xs text-gray-500 px-2">
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Message input */}
      <div className="flex-none border-t border-[#D4AF37]/30 bg-black/95 backdrop-blur-sm">
        <div className="px-4 py-3 flex items-end gap-2">
          <button
            className="p-2 rounded-full text-gray-400 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-colors"
            title="Attach file"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          
          <div className="flex-1 relative">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              rows={1}
              className="w-full px-4 py-2 bg-[#1a1a1a] border border-[#D4AF37]/30 rounded-full text-sm text-foreground placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 resize-none max-h-32"
              style={{ minHeight: "40px" }}
            />
          </div>
          
          {message.trim() ? (
            <button
              onClick={handleSend}
              disabled={sendMessageMutation.isPending}
              className="p-2 rounded-full bg-[#D4AF37] text-black hover:bg-[#F4D03F] active:bg-[#C9A428] transition-colors disabled:opacity-50"
            >
              <Send className="h-5 w-5" />
            </button>
          ) : (
            <button
              className="p-2 rounded-full text-gray-400 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-colors"
              title="Voice message"
            >
              <Mic className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
