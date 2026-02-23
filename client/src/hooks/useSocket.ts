import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import Cookies from "js-cookie";

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Get auth token from cookie
    const token = Cookies.get("session");
    if (!token) {
      console.warn("[WebSocket] No auth token found");
      return;
    }

    // Connect to WebSocket server
    const socket = io({
      auth: { token },
      autoConnect: true,
    });

    socket.on("connect", () => {
      console.log("[WebSocket] Connected");
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("[WebSocket] Disconnected");
      setIsConnected(false);
    });

    socket.on("connect_error", (error) => {
      console.error("[WebSocket] Connection error:", error.message);
      setIsConnected(false);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
  };
}

export function useChannelSocket(channelId: number | null) {
  const { socket, isConnected } = useSocket();
  const [newMessage, setNewMessage] = useState<any>(null);
  const [userTyping, setUserTyping] = useState<number[]>([]);
  const [channelInvite, setChannelInvite] = useState<any>(null);

  useEffect(() => {
    if (!socket || !channelId) return;

    // Join channel
    socket.emit("join-channel", channelId);

    // Listen for new messages
    socket.on("new-message", (message: any) => {
      setNewMessage(message);
    });

    // Listen for channel invites
    socket.on("channel-invite", (invite: any) => {
      setChannelInvite(invite);
    });

    // Listen for typing indicators
    socket.on("user-typing", ({ userId }: { channelId: number; userId: number }) => {
      setUserTyping((prev) => [...new Set([...prev, userId])]);
    });

    socket.on("user-stopped-typing", ({ userId }: { channelId: number; userId: number }) => {
      setUserTyping((prev) => prev.filter((id) => id !== userId));
    });

    return () => {
      // Leave channel
      socket.emit("leave-channel", channelId);
      socket.off("new-message");
      socket.off("channel-invite");
      socket.off("user-typing");
      socket.off("user-stopped-typing");
    };
  }, [socket, channelId]);

  const emitTyping = (isTyping: boolean) => {
    if (!socket || !channelId) return;
    socket.emit(isTyping ? "typing-start" : "typing-stop", channelId);
  };

  return {
    isConnected,
    newMessage,
    userTyping,
    channelInvite,
    emitTyping,
  };
}
