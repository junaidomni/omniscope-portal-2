import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { formatDistanceToNow } from "date-fns";
import { Send, X } from "lucide-react";

interface ThreadViewProps {
  parentMessageId: number | null;
  channelId: number;
  onClose: () => void;
}

export function ThreadView({ parentMessageId, channelId, onClose }: ThreadViewProps) {
  const [replyInput, setReplyInput] = useState("");
  
  const { data: threadData, isLoading } = trpc.communications.getThread.useQuery(
    { parentMessageId: parentMessageId! },
    { enabled: !!parentMessageId }
  );

  const utils = trpc.useUtils();
  const sendReplyMutation = trpc.communications.sendMessage.useMutation({
    onSuccess: () => {
      setReplyInput("");
      utils.communications.getThread.invalidate();
      utils.communications.listMessages.invalidate();
    },
  });

  const handleSendReply = () => {
    if (!replyInput.trim() || !parentMessageId) return;
    
    sendReplyMutation.mutate({
      channelId,
      content: replyInput.trim(),
      replyToId: parentMessageId,
    });
  };

  if (!parentMessageId) return null;

  return (
    <Dialog open={!!parentMessageId} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Thread</span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Loading thread...</p>
          </div>
        ) : (
          <>
            {/* Parent Message */}
            {threadData?.parentMessage && (
              <div className="border-b pb-4">
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={threadData.parentMessage.user?.profilePhotoUrl || undefined} />
                    <AvatarFallback>
                      {threadData.parentMessage.user?.name?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium text-sm">{threadData.parentMessage.user?.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(threadData.parentMessage.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="text-sm mt-1 whitespace-pre-wrap break-words">
                      {threadData.parentMessage.content}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Replies */}
            <ScrollArea className="flex-1 pr-4">
              {threadData?.replies && threadData.replies.length > 0 ? (
                <div className="space-y-4 py-4">
                  {threadData.replies.map((reply: any) => (
                    <div key={reply.id} className="flex gap-3">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={reply.user?.profilePhotoUrl || undefined} />
                        <AvatarFallback>
                          {reply.user?.name?.[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="font-medium text-sm">{reply.user?.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <div className="text-sm mt-1 whitespace-pre-wrap break-words">
                          {reply.content}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  No replies yet. Be the first to reply!
                </div>
              )}
            </ScrollArea>

            {/* Reply Input */}
            <div className="border-t pt-4 flex gap-2">
              <Input
                placeholder="Reply to thread..."
                value={replyInput}
                onChange={(e) => setReplyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendReply();
                  }
                }}
                className="flex-1"
              />
              <Button
                onClick={handleSendReply}
                disabled={!replyInput.trim() || sendReplyMutation.isPending}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
