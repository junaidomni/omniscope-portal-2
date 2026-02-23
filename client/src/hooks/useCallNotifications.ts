import { useEffect, useRef, useState } from "react";
import { useChannelSocket } from "./useSocket";
import { trpc } from "@/lib/trpc";

interface CallNotificationData {
  channelId: number;
  channelName: string;
  callType: "voice" | "video";
  startedBy: string;
}

interface NotificationPreferences {
  callNotifications: boolean;
  soundVolume: number;
  deliveryMethod: "browser" | "in-app" | "both";
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  callNotifications: true,
  soundVolume: 80,
  deliveryMethod: "both",
};

export function useCallNotifications() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasPermission = useRef(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);

  // Load user preferences
  const { data: user } = trpc.auth.me.useQuery();

  useEffect(() => {
    if (user?.notificationPreferences) {
      try {
        const parsed = JSON.parse(user.notificationPreferences);
        setPreferences({ ...DEFAULT_PREFERENCES, ...parsed });
      } catch (error) {
        console.error("Failed to parse notification preferences:", error);
      }
    }
  }, [user]);

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then((permission) => {
        hasPermission.current = permission === "granted";
      });
    } else if (Notification.permission === "granted") {
      hasPermission.current = true;
    }

    // Create audio element for call sound
    audioRef.current = new Audio();
    // Using a simple beep sound data URL (you can replace with actual sound file)
    audioRef.current.src = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE=";
    audioRef.current.loop = false;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const showCallNotification = (data: CallNotificationData) => {
    // Check if call notifications are enabled
    if (!preferences.callNotifications) {
      return;
    }

    // Play sound if delivery method includes sound
    if (audioRef.current && (preferences.deliveryMethod === "browser" || preferences.deliveryMethod === "both")) {
      audioRef.current.volume = preferences.soundVolume / 100;
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((error) => {
        console.error("Error playing notification sound:", error);
      });
    }

    // Show browser notification if delivery method includes browser
    if (hasPermission.current && "Notification" in window && (preferences.deliveryMethod === "browser" || preferences.deliveryMethod === "both")) {
      const notification = new Notification(
        `${data.callType === "video" ? "Video" : "Voice"} call in ${data.channelName}`,
        {
          body: `${data.startedBy} started a call. Click to join.`,
          icon: "/favicon.ico",
          tag: `call-${data.channelId}`,
          requireInteraction: true,
        }
      );

      notification.onclick = () => {
        window.focus();
        // Navigate to the channel (you can enhance this with proper routing)
        notification.close();
      };

      // Auto-close after 30 seconds
      setTimeout(() => {
        notification.close();
      }, 30000);
    }
  };

  return { showCallNotification };
}
