import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Smile, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface MessageReactionsProps {
  messageId: number;
  currentUserId?: number;
}

const QUICK_REACTIONS = ["👍", "❤️", "🎉", "😂", "😮", "😢", "🔥", "👏"];

export function MessageReactions({ messageId, currentUserId }: MessageReactionsProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const utils = trpc.useUtils();

  // Fetch reactions for this message
  const { data: reactions } = trpc.communications.getReactions.useQuery({ messageId });

  // Mutations
  const addReactionMutation = trpc.communications.addReaction.useMutation({
    onSuccess: () => {
      utils.communications.getReactions.invalidate({ messageId });
    },
  });

  const removeReactionMutation = trpc.communications.removeReaction.useMutation({
    onSuccess: () => {
      utils.communications.getReactions.invalidate({ messageId });
    },
  });

  // Group reactions by emoji
  const groupedReactions = reactions?.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = [];
    }
    acc[reaction.emoji].push(reaction);
    return acc;
  }, {} as Record<string, typeof reactions>);

  const handleReaction = (emoji: string) => {
    if (!currentUserId) return;

    const existingReaction = reactions?.find(
      (r) => r.emoji === emoji && r.userId === currentUserId
    );

    if (existingReaction) {
      // Remove reaction
      removeReactionMutation.mutate({ messageId, emoji });
    } else {
      // Add reaction
      addReactionMutation.mutate({ messageId, emoji });
    }

    setShowEmojiPicker(false);
  };

  const hasUserReacted = (emoji: string) => {
    return reactions?.some((r) => r.emoji === emoji && r.userId === currentUserId);
  };

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1">
      {/* Existing reactions */}
      {groupedReactions &&
        Object.entries(groupedReactions).map(([emoji, reactionList]) => (
          <TooltipProvider key={emoji}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={hasUserReacted(emoji) ? "default" : "outline"}
                  className={`h-6 px-2 text-xs ${
                    hasUserReacted(emoji) ? "bg-amber-500/20 border-amber-500/50" : ""
                  }`}
                  onClick={() => handleReaction(emoji)}
                >
                  <span className="mr-1">{emoji}</span>
                  <span className="text-xs">{reactionList.length}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="flex flex-col gap-1">
                  {reactionList.map((r) => (
                    <div key={r.id} className="flex items-center gap-2">
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={r.userAvatar || undefined} />
                        <AvatarFallback className="text-[8px]">
                          {r.userName?.[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs">{r.userName}</span>
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}

      {/* Add reaction button */}
      <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Smile className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2">
          <div className="grid grid-cols-4 gap-1">
            {QUICK_REACTIONS.map((emoji) => (
              <Button
                key={emoji}
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-lg hover:scale-125 transition-transform"
                onClick={() => handleReaction(emoji)}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
