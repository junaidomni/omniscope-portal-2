import { useEffect } from "react";
import { useSocket } from "@/hooks/useSocket";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export function NotificationListener() {
  const { socket } = useSocket();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!socket) return;

    // Listen for channel invites
    socket.on("channel-invite", (data: { channelId: number; channelName: string; invitedBy: string }) => {
      toast.success(`You've been invited to ${data.channelName}`, {
        description: `Invited by ${data.invitedBy}`,
        action: {
          label: "View",
          onClick: () => {
            // Invalidate channels list to show new channel
            utils.communications.listChannels.invalidate();
            utils.communications.listDealRooms.invalidate();
          },
        },
        duration: 5000,
      });

      // Refresh channels list
      utils.communications.listChannels.invalidate();
      utils.communications.listDealRooms.invalidate();
    });

    // Listen for new messages in channels user is not currently viewing
    socket.on("new-message-notification", (data: { channelId: number; channelName: string; senderName: string; preview: string }) => {
      toast.info(`New message in ${data.channelName}`, {
        description: `${data.senderName}: ${data.preview}`,
        duration: 3000,
      });

      // Refresh channels to update unread counts
      utils.communications.listChannels.invalidate();
    });

    return () => {
      socket.off("channel-invite");
      socket.off("new-message-notification");
    };
  }, [socket, utils]);

  return null; // This component doesn't render anything
}
