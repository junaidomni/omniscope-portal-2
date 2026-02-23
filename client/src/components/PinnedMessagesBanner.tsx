import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { trpc } from "@/lib/trpc";
import { Pin, X, ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface PinnedMessagesBannerProps {
  channelId: number;
}

export function PinnedMessagesBanner({ channelId }: PinnedMessagesBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const { data: pinnedMessages, isLoading } = trpc.communications.getPinnedMessages.useQuery(
    { channelId },
    { enabled: !!channelId }
  );

  const utils = trpc.useUtils();
  const unpinMutation = trpc.communications.unpinMessage.useMutation({
    onSuccess: () => {
      utils.communications.getPinnedMessages.invalidate();
      utils.communications.listMessages.invalidate();
    },
  });

  if (isLoading || !pinnedMessages || pinnedMessages.length === 0) {
    return null;
  }

  const firstPinned = pinnedMessages[0];
  const hasMultiple = pinnedMessages.length > 1;

  return (
    <div className="border-b bg-amber-50/50 dark:bg-amber-950/20">
      {/* First Pinned Message */}
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          <Pin className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-1 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Avatar className="h-6 w-6">
                <AvatarImage src={firstPinned.user?.profilePhotoUrl || undefined} />
                <AvatarFallback className="text-xs">
                  {firstPinned.user?.name?.[0]?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{firstPinned.user?.name}</span>
              <span className="text-xs text-muted-foreground">
                pinned {formatDistanceToNow(new Date(firstPinned.createdAt), { addSuffix: true })}
              </span>
            </div>
            <p className="text-sm text-foreground line-clamp-2">{firstPinned.content}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {hasMultiple && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {pinnedMessages.length} pinned
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => unpinMutation.mutate({ messageId: firstPinned.id })}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Additional Pinned Messages (when expanded) */}
      {isExpanded && hasMultiple && (
        <div className="border-t border-amber-200 dark:border-amber-900">
          {pinnedMessages.slice(1).map((message: any) => (
            <div key={message.id} className="px-4 py-3 border-b border-amber-100 dark:border-amber-900/50 last:border-b-0">
              <div className="flex items-start gap-3">
                <Pin className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={message.user?.profilePhotoUrl || undefined} />
                      <AvatarFallback className="text-xs">
                        {message.user?.name?.[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{message.user?.name}</span>
                    <span className="text-xs text-muted-foreground">
                      pinned {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">{message.content}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => unpinMutation.mutate({ messageId: message.id })}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
