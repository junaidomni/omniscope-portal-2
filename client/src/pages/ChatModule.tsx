import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Search, 
  Plus, 
  MessageSquare, 
  Users, 
  Hash, 
  Send,
  Paperclip,
  Smile,
  MoreVertical,
  Pin,
  Archive,
  X,
  Link,
  Briefcase,
  Shield,
  UserPlus
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { MentionAutocomplete } from "@/components/MentionAutocomplete";
import { useMentions, renderMentions } from "@/hooks/useMentions";
import { useChannelSocket } from "@/hooks/useSocket";
import { EmojiPicker } from "@/components/EmojiPicker";
import { CreateChannelDialog } from "@/components/CreateChannelDialog";
import { InviteLinkDialog } from "@/components/InviteLinkDialog";
import { ChannelSidebar } from "@/components/ChannelSidebar";
import { AddSubChannelDialog } from "@/components/AddSubChannelDialog";
import { DirectInviteDialog } from "@/components/DirectInviteDialog";

export default function ChatModule() {
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [attachments, setAttachments] = useState<Array<{ id: number; url: string; fileName: string; mimeType: string; fileSize: number }>>([]);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showCreateChannelDialog, setShowCreateChannelDialog] = useState(false);
  const [showInviteLinkDialog, setShowInviteLinkDialog] = useState(false);
  const [showAddSubChannelDialog, setShowAddSubChannelDialog] = useState(false);
  const [showDirectInviteDialog, setShowDirectInviteDialog] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // WebSocket for real-time updates
  const { isConnected, newMessage, userTyping, emitTyping } = useChannelSocket(selectedChannelId);
  
  // tRPC utils for invalidation
  const utils = trpc.useUtils();
  
  // Mentions autocomplete
  const {
    mentionQuery,
    mentionPosition,
    handleMentionSelect,
    closeMentionAutocomplete,
  } = useMentions({
    textareaRef,
    value: messageInput,
    onChange: setMessageInput,
  });

  // Fetch channels
  const { data: channels, isLoading: channelsLoading } = trpc.communications.listChannels.useQuery();

  // Fetch messages for selected channel
  const { data: messagesData } = trpc.communications.listMessages.useQuery(
    { channelId: selectedChannelId!, limit: 50 },
    { enabled: !!selectedChannelId }
  );

  // Fetch channel details
  const { data: channelDetails } = trpc.communications.getChannel.useQuery(
    { channelId: selectedChannelId! },
    { enabled: !!selectedChannelId }
  );
  
  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesData?.messages]);

  // Send message mutation
  const sendMessageMutation = trpc.communications.sendMessage.useMutation({
    onSuccess: () => {
      setMessageInput("");
      // Refetch messages
      utils.communications.listMessages.invalidate();
      utils.communications.listChannels.invalidate();
    },
  });

  // Mark as read mutation
  const markReadMutation = trpc.communications.markRead.useMutation({
    onSuccess: () => {
      utils.communications.listChannels.invalidate();
    },
  });

  const handleSendMessage = () => {
    if ((!messageInput.trim() && attachments.length === 0) || !selectedChannelId) return;

    sendMessageMutation.mutate({
      channelId: selectedChannelId,
      content: messageInput || "[File attachment]",
    });
    
    // Clear attachments after sending
    setAttachments([]);
  };

  const handleChannelSelect = (channelId: number) => {
    setSelectedChannelId(channelId);
    // Mark as read
    markReadMutation.mutate({ channelId });
  };

  const filteredChannels = channels?.filter((channel) =>
    channel.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedChannel = channels?.find((c) => c.id === selectedChannelId);

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4">
      {/* Left Column: Channel List */}
      <ChannelSidebar
        selectedChannelId={selectedChannelId}
        onChannelSelect={handleChannelSelect}
        onCreateChannel={() => setShowCreateChannelDialog(true)}
      />

      {/* Center Column: Message Thread */}
      <Card className="flex-1 flex flex-col">
        {!selectedChannelId ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <MessageSquare className="h-12 w-12 mx-auto opacity-50" />
              <p>Select a channel to start messaging</p>
            </div>
          </div>
        ) : (
          <>
            {/* Channel Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedChannel?.avatar || undefined} />
                  <AvatarFallback>
                    {selectedChannel?.type === "dm" ? (
                      <MessageSquare className="h-5 w-5" />
                    ) : selectedChannel?.type === "group" ? (
                      <Users className="h-5 w-5" />
                    ) : selectedChannel?.type === "deal_room" ? (
                      <Briefcase className="h-5 w-5 text-amber-500" />
                    ) : (
                      <Hash className="h-5 w-5" />
                    )}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{selectedChannel?.name || "Unnamed Channel"}</h3>
                    {selectedChannel?.type === "deal_room" && (
                      <Badge variant="outline" className="text-xs border-amber-500 text-amber-500">
                        Deal Room
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {channelDetails?.members.length || 0} members
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedChannel?.type === "deal_room" && (
                  <>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => setShowAddSubChannelDialog(true)}
                      title="Add Channel"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => setShowDirectInviteDialog(true)}
                      title="Invite Users"
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => setShowInviteLinkDialog(true)}
                      title="Generate Invite Link"
                    >
                      <Link className="h-4 w-4" />
                    </Button>
                  </>
                )}
                <Button size="sm" variant="ghost">
                  <Pin className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {!messagesData?.messages.length ? (
                <div className="text-center text-muted-foreground py-8">
                  No messages yet. Start the conversation!
                </div>
              ) : (
                <div className="space-y-4">
                  {messagesData.messages.map((message) => (
                    <div key={message.id} className="flex gap-3">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={message.user.profilePhotoUrl || undefined} />
                        <AvatarFallback>
                          {message.user.name?.[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="font-medium text-sm">{message.user.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <div className="text-sm mt-1 whitespace-pre-wrap break-words">
                          {renderMentions(message.content)}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Typing Indicator */}
            {userTyping.length > 0 && (
              <div className="px-4 py-2 text-xs text-muted-foreground">
                {userTyping.length === 1 ? "Someone is" : `${userTyping.length} people are`} typing...
              </div>
            )}

            {/* Attachment Preview */}
            {attachments.length > 0 && (
              <div className="px-4 py-2 border-t bg-muted/30">
                <div className="flex flex-wrap gap-2">
                  {attachments.map((attachment, index) => (
                    <div key={index} className="flex items-center gap-2 px-3 py-2 bg-background border rounded-lg">
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm truncate max-w-[200px]">{attachment.fileName}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => setAttachments(attachments.filter((_, i) => i !== index))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Message Input */}
            <div className="p-4 border-t">
              <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    value={messageInput}
                    onChange={(e) => {
                      setMessageInput(e.target.value);
                      emitTyping(e.target.value.length > 0);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                        emitTyping(false);
                      }
                    }}
                    onBlur={() => emitTyping(false)}
                    placeholder="Type a message..."
                    className="w-full min-h-[44px] max-h-32 px-4 py-3 pr-20 rounded-lg border resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    rows={1}
                  />
                  <div className="absolute right-2 bottom-2 flex items-center gap-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        
                        // Convert to base64 and upload
                        const reader = new FileReader();
                        reader.onload = async () => {
                          const base64 = (reader.result as string).split(",")[1];
                          try {
                            const result = await trpc.fileUpload.uploadMessageAttachment.mutate({
                              channelId: selectedChannelId!,
                              fileName: file.name,
                              fileData: base64,
                              mimeType: file.type,
                              fileSize: file.size,
                            });
                            setAttachments([...attachments, result]);
                          } catch (error) {
                            console.error("Upload failed:", error);
                          }
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-8 w-8 p-0"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <EmojiPicker onEmojiSelect={(emoji) => setMessageInput(messageInput + emoji)} />
                  </div>
                </div>
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || sendMessageMutation.isPending}
                  size="icon"
                  className="h-11 w-11"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Right Column: Context Sidebar */}
      {selectedChannelId && (
        <Card className="w-80 flex flex-col">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Channel Details</h3>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              {/* Channel Info */}
              <div>
                <h4 className="text-sm font-medium mb-2">About</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedChannel?.description || "No description"}
                </p>
              </div>

              <Separator />

              {/* Members */}
              <div>
                <h4 className="text-sm font-medium mb-3">
                  Members ({channelDetails?.members.length || 0})
                </h4>
                <div className="space-y-2">
                  {channelDetails?.members.map((member) => (
                    <div key={member.userId} className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.user.profilePhotoUrl || undefined} />
                        <AvatarFallback>
                          {member.user.name?.[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{member.user.name}</p>
                        <p className="text-xs text-muted-foreground">{member.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </Card>
      )}

      {/* Mention Autocomplete Popup */}
      {mentionQuery !== null && mentionPosition && (
        <MentionAutocomplete
          query={mentionQuery}
          position={mentionPosition}
          onSelect={handleMentionSelect}
          onClose={closeMentionAutocomplete}
          channelId={selectedChannelId}
        />
      )}

      {/* Create Channel Dialog */}
      <CreateChannelDialog
        open={showCreateChannelDialog}
        onOpenChange={setShowCreateChannelDialog}
        onChannelCreated={(channelId) => {
          setSelectedChannelId(channelId);
        }}
      />

      {/* Invite Link Dialog */}
      {selectedChannelId && selectedChannel && (
        <InviteLinkDialog
          open={showInviteLinkDialog}
          onOpenChange={setShowInviteLinkDialog}
          channelId={selectedChannelId}
          channelName={selectedChannel.name || "Unnamed Channel"}
        />
      )}

      {/* Add Sub-Channel Dialog */}
      {selectedChannelId && selectedChannel?.type === "deal_room" && (
        <AddSubChannelDialog
          open={showAddSubChannelDialog}
          onOpenChange={setShowAddSubChannelDialog}
          dealRoomId={selectedChannelId}
          dealRoomName={selectedChannel.name || "Unnamed Deal Room"}
          onChannelCreated={(channelId) => {
            setSelectedChannelId(channelId);
          }}
        />
      )}

      {/* Direct Invite Dialog */}
      {selectedChannelId && selectedChannel && (
        <DirectInviteDialog
          open={showDirectInviteDialog}
          onOpenChange={setShowDirectInviteDialog}
          channelId={selectedChannelId}
          channelName={selectedChannel.name || "Unnamed Channel"}
        />
      )}
    </div>
  );
}
