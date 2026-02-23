import { Phone, Video, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CallNotificationBannerProps {
  callType: "voice" | "video";
  participantCount: number;
  onJoin: () => void;
  className?: string;
}

export function CallNotificationBanner({
  callType,
  participantCount,
  onJoin,
  className,
}: CallNotificationBannerProps) {
  return (
    <div
      className={cn(
        "bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 rounded-lg p-4 flex items-center justify-between animate-in slide-in-from-top",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="bg-amber-500 rounded-full p-2 animate-pulse">
          {callType === "video" ? (
            <Video className="h-5 w-5 text-white" />
          ) : (
            <Phone className="h-5 w-5 text-white" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-foreground">
              {callType === "video" ? "Video" : "Voice"} call in progress
            </p>
            <Badge variant="secondary" className="bg-amber-500/20">
              <Users className="h-3 w-3 mr-1" />
              {participantCount} {participantCount === 1 ? "person" : "people"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Join the call to participate
          </p>
        </div>
      </div>
      <Button
        onClick={onJoin}
        className="bg-amber-500 hover:bg-amber-600 text-white"
      >
        Join Call
      </Button>
    </div>
  );
}
