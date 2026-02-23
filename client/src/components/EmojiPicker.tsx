import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Smile } from "lucide-react";

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

const COMMON_EMOJIS = [
  "👍", "❤️", "😂", "😮", "😢", "🙏",
  "🎉", "🔥", "✅", "❌", "⭐", "💯",
  "👀", "🤔", "💪", "🚀", "💡", "📌",
];

export function EmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
    setOpen(false);
  };

  return (
    <div className="relative" ref={pickerRef}>
      <Button 
        size="sm" 
        variant="ghost" 
        className="h-8 w-8 p-0"
        onClick={() => setOpen(!open)}
      >
        <Smile className="h-4 w-4" />
      </Button>
      
      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-64 p-2 bg-popover border rounded-lg shadow-lg z-50">
          <div className="grid grid-cols-6 gap-1">
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleEmojiClick(emoji)}
                className="h-10 w-10 flex items-center justify-center text-2xl hover:bg-accent rounded transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface MessageReactionsProps {
  messageId: number;
  reactions: Array<{
    emoji: string;
    count: number;
    userReacted: boolean;
  }>;
  onReact: (emoji: string) => void;
  onUnreact: (emoji: string) => void;
}

export function MessageReactions({ messageId, reactions, onReact, onUnreact }: MessageReactionsProps) {
  if (reactions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          onClick={() => reaction.userReacted ? onUnreact(reaction.emoji) : onReact(reaction.emoji)}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm transition-colors ${
            reaction.userReacted
              ? "bg-primary/20 text-primary border border-primary"
              : "bg-muted hover:bg-muted/80 border border-transparent"
          }`}
        >
          <span>{reaction.emoji}</span>
          <span className="text-xs">{reaction.count}</span>
        </button>
      ))}
    </div>
  );
}
