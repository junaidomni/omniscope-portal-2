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
  UserPlus,
  Edit2,
  Trash2,
  Phone,
  Video,
  History
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { MentionAutocomplete } from "@/components/MentionAutocomplete";
import { useMentions, renderMentions } from "@/hooks/useMentions";
import { useChannelSocket } from "@/hooks/useSocket";
import { useCallNotifications } from "@/hooks/useCallNotifications";
import { EmojiPicker } from "@/components/EmojiPicker";
import { CreateChannelDialog } from "@/components/CreateChannelDialog";
import { InviteLinkDialog } from "@/components/InviteLinkDialog";
import { ChannelSidebar } from "@/components/ChannelSidebar";
import { AddSubChannelDialog } from "@/components/AddSubChannelDialog";
import { ThreadView } from "@/components/ThreadView";
import { PinnedMessagesBanner } from "@/components/PinnedMessagesBanner";
import { DirectInviteDialog } from "@/components/DirectInviteDialog";
import { MemberManagementDialog } from "@/components/MemberManagementDialog";
import { NotificationListener } from "@/components/NotificationListener";
import { DeleteChannelDialog } from "@/components/DeleteChannelDialog";
import { MessageSearch } from "@/components/MessageSearch";
import { InstallBanner } from "@/components/InstallBanner";
import { MessageReactions } from "@/components/MessageReactions";
import { CallInterface } from "@/components/CallInterface";
import { CallHistoryPanel } from "@/components/CallHistoryPanel";
import { CallNotificationBanner } from "@/components/communications/CallNotificationBanner";

export default function ChatModule() {
  // Get current user
  const { data: user } = trpc.auth.me.useQuery();
  
  // Global notification listener
  NotificationListener();
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [attachments, setAttachments] = useState<Array<{ id: number; url: string; fileName: string; mimeType: string; fileSize: number }>>([]);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showCreateChannelDialog, setShowCreateChannelDialog] = useState(false);
  const [showInviteLinkDialog, setShowInviteLinkDialog] = useState(false);
  const [showAddSubChannelDialog, setShowAddSubChannelDialog] = useState(false);
  const [showDirectInviteDialog, setShowDirectInviteDialog] = useState(false);
  const [showMemberManagementDialog, setShowMemberManagementDialog] = useState(false);
  const [showDeleteChannelDialog, setShowDeleteChannelDialog] = useState(false);
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [showCallHistory, setShowCallHistory] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [threadParentMessageId, setThreadParentMessageId] = useState<number | null>(null);
  const [activeCallId, setActiveCallId] = useState<number | null>(null);
  const [inCall, setInCall] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // WebSocket for real-time updates
  const { isConnected, newMessage, userTyping, emitTyping } = useChannelSocket(selectedChannelId);
  
  // Call notifications
  const { showCallNotification } = useCallNotifications();
  
  // tRPC utils for invalidation
  const utils = trpc.useUtils();

  // Edit/delete mutations
  const editMessageMutation = trpc.communications.editMessage.useMutation({
    onSuccess: () => {
      utils.communications.listMessages.invalidate();
      setEditingMessageId(null);
      setEditContent("");
      toast.success("Message updated");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to edit message");
    },
  });

  const deleteMessageMutation = trpc.communications.deleteMessage.useMutation({
    onSuccess: () => {
      utils.communications.listMessages.invalidate();
      toast.success("Message deleted");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete message");
    },
  });
  
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

  // Fetch active call in channel
  const { data: activeCallData } = trpc.communications.getActiveCall.useQuery(
    { channelId: selectedChannelId! },
    { enabled: !!selectedChannelId, refetchInterval: 3000 }
  );
  
  // Listen for call-started events
  useEffect(() => {
    if (activeCallData && !inCall) {
      // Show notification when a new call starts
      const channelName = channels?.find(c => c.id === selectedChannelId)?.name || "Unknown Channel";
      showCallNotification({
        channelId: activeCallData.channelId,
        channelName,
        callType: activeCallData.callType,
        startedBy: user?.name || "Someone",
      });
    }
  }, [activeCallData?.id, inCall, selectedChannelId, channels, showCallNotification, user?.name]);
  
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

  // Pin/unpin message mutations
  const pinMessageMutation = trpc.communications.pinMessage.useMutation({
    onSuccess: () => {
      utils.communications.listMessages.invalidate();
      utils.communications.getPinnedMessages.invalidate();
    },
  });

  const unpinMessageMutation = trpc.communications.unpinMessage.useMutation({
    onSuccess: () => {
      utils.communications.listMessages.invalidate();
      utils.communications.getPinnedMessages.invalidate();
    },
  });

  const startCallMutation = trpc.communications.startCall.useMutation({
    onSuccess: (data) => {
      setActiveCallId(data.call.id);
      setInCall(true);
      toast.success("Call started");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const joinCallMutation = trpc.communications.joinCall.useMutation({
    onSuccess: () => {
      setInCall(true);
      toast.success("Joined call");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleStartCall = (type: "voice" | "video") => {
    if (!selectedChannelId) return;
    startCallMutation.mutate({ channelId: selectedChannelId, type });
  };

  const handleLeaveCall = () => {
    setInCall(false);
    setActiveCallId(null);
  };

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

  const handlePinMessage = (messageId: number, isPinned: boolean) => {
    if (isPinned) {
      unpinMessageMutation.mutate({ messageId });
    } else {
      pinMessageMutation.mutate({ messageId });
    }
  };

  const filteredChannels = channels?.filter((channel) =>
    channel.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedChannel = channels?.find((c) => c.id === selectedChannelId);
  
  // Find parent deal room if viewing a sub-channel
  const parentDealRoom = selectedChannel?.parentChannelId
    ? channels?.find((c) => c.id === selectedChannel.parentChannelId)
    : null;

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4">
      {/* Left Column: Channel List */}
      <ChannelSidebar
        selectedChannelId={selectedChannelId}
        onChannelSelect={handleChannelSelect}
        onCreateChannel={() => setShowCreateChannelDialog(true)}
        onSearchMessages={() => setShowMessageSearch(true)}
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
                    {/* Breadcrumb if viewing sub-channel */}
                    {parentDealRoom ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSelectedChannelId(parentDealRoom.id)}
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {parentDealRoom.name}
                        </button>
                        <span className="text-muted-foreground">/</span>
                        <h3 className="font-semibold">#{selectedChannel?.name || "Unnamed Channel"}</h3>
                      </div>
                    ) : (
                      <h3 className="font-semibold">{selectedChannel?.name || "Unnamed Channel"}</h3>
                    )}
                    {selectedChannel?.type === "deal_room" && (
                      <Badge variant="outline" className="text-xs border-amber-500 text-amber-500">
                        Channel
                      </Badge>
                    )}
                    {selectedChannel?.type === "group" && (
                      <Badge variant="outline" className="text-xs border-blue-500 text-blue-500">
                        Group
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
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => handleStartCall("voice")}
                  title="Start Voice Call"
                >
                  <Phone className="h-4 w-4" />
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => handleStartCall("video")}
                  title="Start Video Call"
                >
                  <Video className="h-4 w-4" />
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => setShowCallHistory(true)}
                  title="Call History"
                >
                  <History className="h-4 w-4" />
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => setShowMemberManagementDialog(true)}
                  title="Manage Members"
                >
                  <Users className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost">
                  <Pin className="h-4 w-4" />
                </Button>
                {(user?.role === "admin" || (channelDetails && (channelDetails.members.find(m => m.userId === user?.id)?.role === "owner" || channelDetails.members.find(m => m.userId === user?.id)?.role === "admin"))) && (
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => setShowDeleteChannelDialog(true)}
                    title="Delete Channel"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Install Banner */}
            <div className="px-4 pt-2">
              <InstallBanner />
              {/* Debug: Clear dismissal flag */}
              {process.env.NODE_ENV === 'development' && (
                <button
                  onClick={() => {
                    localStorage.removeItem('omniscope-install-banner-dismissed');
                    window.location.reload();
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground mt-1"
                >
                  [Dev] Reset Install Banner
                </button>
              )}
            </div>
            
            {/* Pinned Messages Banner */}
            <PinnedMessagesBanner channelId={selectedChannelId} />

            {/* Call Notification Banner */}
            {activeCallData && !inCall && (
              <div className="px-4 pt-2">
                <CallNotificationBanner
                  callType={activeCallData.callType}
                  participantCount={activeCallData.participants?.length || 0}
                  onJoin={() => {
                    setActiveCallId(activeCallData.id);
                    joinCallMutation.mutate({ callId: activeCallData.id });
                  }}
                />
              </div>
            )}

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {!messagesData?.messages.length ? (
                <div className="text-center text-muted-foreground py-8">
                  No messages yet. Start the conversation!
                </div>
              ) : (
                <div className="space-y-4">
                  {messagesData.messages.map((message) => (
                    <div key={message.id} className="flex gap-3 group">
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
                          {/* Pin button (owner/admin only) */}
                          {(currentUserRole === "owner" || currentUserRole === "admin" || user?.role === "admin") && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handlePinMessage(message.id, message.isPinned)}
                            >
                              <Pin className={`h-3 w-3 ${message.isPinned ? 'fill-amber-500 text-amber-500' : ''}`} />
                            </Button>
                          )}
                          {/* Edit/Delete buttons (own messages only, within 15 minutes) */}
                          {message.userId === user?.id && (() => {
                            const now = new Date();
                            const createdAt = new Date(message.createdAt);
                            const diffMinutes = (now.getTime() - createdAt.getTime()) / 1000 / 60;
                            return diffMinutes <= 15;
                          })() && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => {
                                  setEditingMessageId(message.id);
                                  setEditContent(message.content);
                                }}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                                onClick={() => {
                                  if (confirm("Delete this message?")) {
                                    deleteMessageMutation.mutate({ messageId: message.id });
                                  }
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                          {message.isEdited && (
                            <span className="text-xs text-muted-foreground italic">(edited)</span>
                          )}
                        </div>
                        {editingMessageId === message.id ? (
                          <div className="flex gap-2 items-start mt-1">
                            <Input
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="flex-1"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  if (editContent.trim()) {
                                    editMessageMutation.mutate({
                                      messageId: message.id,
                                      content: editContent.trim(),
                                    });
                                  }
                                } else if (e.key === "Escape") {
                                  setEditingMessageId(null);
                                  setEditContent("");
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              onClick={() => {
                                if (editContent.trim()) {
                                  editMessageMutation.mutate({
                                    messageId: message.id,
                                    content: editContent.trim(),
                                  });
                                }
                              }}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingMessageId(null);
                                setEditContent("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="text-sm mt-1 whitespace-pre-wrap break-words">
                            {renderMentions(message.content)}
                          </div>
                        )}
                        {/* Thread Indicator & Reply Button */}
                        <div className="flex items-center gap-2 mt-2">
                          {message.replyCount > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => setThreadParentMessageId(message.id)}
                            >
                              <MessageSquare className="h-3 w-3 mr-1" />
                              {message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setThreadParentMessageId(message.id)}
                          >
                            Reply
                          </Button>
                        </div>
                        {/* Message Reactions */}
                        <MessageReactions messageId={message.id} currentUserId={user?.id} />
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Typing Indicator */}
            {userTyping.length > 0 && (
              <div className="px-4 py-2 text-xs text-muted-foreground italic flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="inline-block w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="inline-block w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="inline-block w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                {(() => {
                  const typingUsers = channelDetails?.members?.filter(m => userTyping.includes(m.userId)) || [];
                  const names = typingUsers.map(u => u.user.name).filter(Boolean);
                  if (names.length === 0) return "Someone is typing...";
                  if (names.length === 1) return `${names[0]} is typing...`;
                  if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
                  return `${names[0]} and ${names.length - 1} others are typing...`;
                })()}
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

      {/* Member Management Dialog */}
      {selectedChannelId && channelDetails && (
        <MemberManagementDialog
          open={showMemberManagementDialog}
          onOpenChange={setShowMemberManagementDialog}
          channelId={selectedChannelId}
          channelName={selectedChannel?.name || "Unnamed Channel"}
          members={channelDetails.members}
          currentUserRole={channelDetails.members.find((m) => m.userId === user?.id)?.role || "member"}
        />
      )}

      {/* Delete Channel Dialog */}
      {selectedChannelId && selectedChannel && (
        <DeleteChannelDialog
          open={showDeleteChannelDialog}
          onOpenChange={setShowDeleteChannelDialog}
          channelId={selectedChannelId}
          channelName={selectedChannel.name || "Unnamed Channel"}
          onDeleted={() => setSelectedChannelId(null)}
        />
      )}

      {/* Message Search Dialog */}
      <MessageSearch
        open={showMessageSearch}
        onOpenChange={setShowMessageSearch}
        onMessageClick={(channelId, messageId) => {
          setSelectedChannelId(channelId);
          // TODO: Scroll to message
        }}
      />
      {/* Thread View Dialog */}
      {selectedChannelId && (
        <ThreadView
          parentMessageId={threadParentMessageId}
          channelId={selectedChannelId}
          onClose={() => setThreadParentMessageId(null)}
        />
      )}

      {/* Call Interface */}
      {inCall && activeCallId && selectedChannelId && (
        <CallInterface
          channelId={selectedChannelId}
          callId={activeCallId}
          onLeave={handleLeaveCall}
        />
      )}

      {/* Call History Panel */}
      {showCallHistory && selectedChannelId && (
        <CallHistoryPanel
          channelId={selectedChannelId}
          onClose={() => setShowCallHistory(false)}
        />
      )}
    </div>
  );
}
