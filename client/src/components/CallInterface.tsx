import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Monitor,
  MonitorOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWebRTC } from "@/hooks/useWebRTC";

interface CallInterfaceProps {
  channelId: number;
  callId: number;
  onLeave: () => void;
}

interface Participant {
  id: number;
  userId: number;
  role: "host" | "participant";
  audioEnabled: boolean;
  videoEnabled: boolean;
  user: {
    id: number;
    name: string | null;
    email: string;
    profilePhotoUrl: string | null;
  };
}

export function CallInterface({ channelId, callId, onLeave }: CallInterfaceProps) {
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Map<number, MediaStream>>(new Map());
  const [isRecording, setIsRecording] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteVideoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // WebRTC peer connection management
  const { isConnected } = useWebRTC({
    callId,
    channelId,
    localStream: localStreamRef.current,
    onRemoteStream: (userId, stream) => {
      console.log(`[CallInterface] Received remote stream from user ${userId}`);
      setRemoteStreams((prev) => new Map(prev).set(userId, stream));
    },
    onParticipantLeft: (userId) => {
      console.log(`[CallInterface] Participant ${userId} left`);
      setRemoteStreams((prev) => {
        const newMap = new Map(prev);
        newMap.delete(userId);
        return newMap;
      });
    },
  });

  // Get active call data
  const { data: callData } = trpc.communications.getActiveCall.useQuery(
    { channelId },
    { refetchInterval: 2000 }
  );

  const uploadRecordingMutation = trpc.communications.uploadCallRecording.useMutation();

  const leaveCallMutation = trpc.communications.leaveCall.useMutation({
    onSuccess: async () => {
      // Stop recording and upload
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
        // Wait for recording to finish and upload
        await new Promise((resolve) => {
          if (mediaRecorderRef.current) {
            mediaRecorderRef.current.onstop = async () => {
              await handleRecordingUpload();
              resolve(true);
            };
          } else {
            resolve(true);
          }
        });
      }
      
      // Stop local media
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      onLeave();
    },
  });

  // Handle recording upload
  const handleRecordingUpload = async () => {
    if (recordedChunksRef.current.length === 0) return;

    try {
      const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
      const reader = new FileReader();
      
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        await uploadRecordingMutation.mutateAsync({
          callId,
          audioData: base64data,
        });
      };
      
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error("Error uploading recording:", error);
    }
  };

  // Start recording when call begins
  useEffect(() => {
    if (!localStreamRef.current || isRecording) return;

    try {
      // Create audio context to mix all streams
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();

      // Add local audio
      if (localStreamRef.current) {
        const localAudioTracks = localStreamRef.current.getAudioTracks();
        if (localAudioTracks.length > 0) {
          const localSource = audioContext.createMediaStreamSource(
            new MediaStream(localAudioTracks)
          );
          localSource.connect(destination);
        }
      }

      // Add remote audio streams
      remoteStreams.forEach((stream) => {
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length > 0) {
          const source = audioContext.createMediaStreamSource(
            new MediaStream(audioTracks)
          );
          source.connect(destination);
        }
      });

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType: "audio/webm",
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

      console.log("[CallInterface] Recording started");
    } catch (error) {
      console.error("Error starting recording:", error);
    }

    return () => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [localStreamRef.current, remoteStreams.size]);

  // Initialize local media
  useEffect(() => {
    async function initMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: videoEnabled,
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Error accessing media devices:", error);
      }
    }

    initMedia();

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [videoEnabled]);

  // Update participants from call data
  useEffect(() => {
    if (callData?.participants) {
      setParticipants(callData.participants as Participant[]);
    }
  }, [callData]);

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    setVideoEnabled(!videoEnabled);
  };

  const toggleScreenShare = async () => {
    if (!screenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
        // Replace video track with screen share track
        if (localStreamRef.current) {
          const videoTrack = screenStream.getVideoTracks()[0];
          const sender = localStreamRef.current.getVideoTracks()[0];
          if (sender) {
            localStreamRef.current.removeTrack(sender);
            sender.stop();
          }
          localStreamRef.current.addTrack(videoTrack);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
        }
        setScreenSharing(true);
      } catch (error) {
        console.error("Error sharing screen:", error);
      }
    } else {
      // Stop screen sharing and go back to camera
      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.stop();
          localStreamRef.current.removeTrack(videoTrack);
        }
      }
      setScreenSharing(false);
      setVideoEnabled(false);
    }
  };

  const handleLeave = () => {
    leaveCallMutation.mutate({ callId });
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Video Grid */}
      <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-auto">
        {/* Local Video */}
        <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
          {videoEnabled || screenSharing ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Avatar className="h-24 w-24">
                <AvatarFallback className="text-2xl">You</AvatarFallback>
              </Avatar>
            </div>
          )}
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
            <Badge variant="secondary" className="bg-black/50">
              You {screenSharing && "(Screen)"}
            </Badge>
            <div className="flex gap-1">
              {!audioEnabled && (
                <div className="bg-red-500 rounded-full p-1">
                  <MicOff className="h-3 w-3 text-white" />
                </div>
              )}
              {!videoEnabled && !screenSharing && (
                <div className="bg-red-500 rounded-full p-1">
                  <VideoOff className="h-3 w-3 text-white" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Remote Participants */}
        {participants.map((participant) => {
          const remoteStream = remoteStreams.get(participant.userId);
          const hasVideo = remoteStream && remoteStream.getVideoTracks().length > 0;
          
          return (
            <div
              key={participant.id}
              className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video"
            >
              {hasVideo ? (
                <video
                  ref={(el) => {
                    if (el && remoteStream) {
                      el.srcObject = remoteStream;
                      remoteVideoRefs.current.set(participant.userId, el);
                    }
                  }}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={participant.user.profilePhotoUrl || undefined} />
                    <AvatarFallback className="text-2xl">
                      {participant.user.name?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                <Badge variant="secondary" className="bg-black/50">
                  {participant.user.name}
                  {participant.role === "host" && " (Host)"}
                </Badge>
                <div className="flex gap-1">
                  {!participant.audioEnabled && (
                    <div className="bg-red-500 rounded-full p-1">
                      <MicOff className="h-3 w-3 text-white" />
                    </div>
                  )}
                  {!participant.videoEnabled && (
                    <div className="bg-red-500 rounded-full p-1">
                      <VideoOff className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Call Controls */}
      <div className="p-6 bg-gray-900 flex items-center justify-center gap-4">
        <Button
          size="lg"
          variant={audioEnabled ? "secondary" : "destructive"}
          className="rounded-full h-14 w-14 p-0"
          onClick={toggleAudio}
        >
          {audioEnabled ? (
            <Mic className="h-6 w-6" />
          ) : (
            <MicOff className="h-6 w-6" />
          )}
        </Button>

        <Button
          size="lg"
          variant={videoEnabled ? "secondary" : "destructive"}
          className="rounded-full h-14 w-14 p-0"
          onClick={toggleVideo}
        >
          {videoEnabled ? (
            <Video className="h-6 w-6" />
          ) : (
            <VideoOff className="h-6 w-6" />
          )}
        </Button>

        <Button
          size="lg"
          variant={screenSharing ? "default" : "secondary"}
          className="rounded-full h-14 w-14 p-0"
          onClick={toggleScreenShare}
        >
          {screenSharing ? (
            <MonitorOff className="h-6 w-6" />
          ) : (
            <Monitor className="h-6 w-6" />
          )}
        </Button>

        <Button
          size="lg"
          variant="destructive"
          className="rounded-full h-16 w-16 p-0"
          onClick={handleLeave}
        >
          <PhoneOff className="h-7 w-7" />
        </Button>
      </div>
    </div>
  );
}
