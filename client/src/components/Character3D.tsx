import { useEffect, useState } from "react";
import { OmniState } from "./OmniAvatar";

/**
 * Character3D - Professional sprite sheet animated mascot
 * 
 * Uses CSS sprite sheet animation technique for smooth, performant character animations.
 * The sprite sheet contains 8 frames in a 2×4 grid (2752×1536px):
 * 
 * Row 1: Idle, Wave, Thinking, Success
 * Row 2: Focused, Alert, Proud, Thumbs Up
 */

// Sprite sheet configuration
const SPRITE_SHEET_URL =
  "https://private-us-east-1.manuscdn.com/sessionFile/DDiMkLGQBY3PBFwVfZsFZ9/sandbox/bHeUEyPeynIwSpkiYncPFc_1771976995996_na1fn_b21uaS1jaGFyYWN0ZXItc3ByaXRlLXNoZWV0.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvRERpTWtMR1FCWTNQQkZ3VmZac0ZaOS9zYW5kYm94L2JIZVVFeVBleW5Jd1Nwa2lZbmNQRmNfMTc3MTk3Njk5NTk5Nl9uYTFmbl9iMjF1YVMxamFHRnlZV04wWlhJdGMzQnlhWFJsTFhOb1pXVjAucG5nP3gtb3NzLXByb2Nlc3M9aW1hZ2UvcmVzaXplLHdfMTkyMCxoXzE5MjAvZm9ybWF0LHdlYnAvcXVhbGl0eSxxXzgwIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzk4NzYxNjAwfX19XX0_&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=DvwSIe4ZG8CzLYE~3oO7gPoyVDTL-UvpNnCujKa4wD~QmXe4oAKTdTERimiw6V-JUcj8UHDRFSiNhoAaa-J6yhTWCLtQLGNPYLSNrmw8hOliSPT6-Iw5GO0hjbfVB-Wm53q~di-DGKTwn2J8zUaXEl9RBeLST3YNNUAYYxdXU9Mk7ais8VV-8jCYKbdcRDsFzR7CzYltvmCCHVqwnY7BSZL24NGi0UInBuEbenD69RdGbFUbVMYNAO1t04Du-xdS2o3K~51ycPWnab1fVwLjlFuWZPZz~VHU5ksXZUEqk7r98zw7Q0hWcacz7ING-5QuBVz21If444K4HpY-yjL7rA__";

// Sprite sheet is 2752×1536px with 8 frames in 2×4 grid
// Each frame: 688×384px
const FRAME_WIDTH = 688;
const FRAME_HEIGHT = 384;
const COLS = 4;
const ROWS = 2;

// Map states to frame positions (col, row)
const STATE_TO_POSITION: Record<string, [number, number]> = {
  idle: [0, 0],
  wave: [1, 0],
  thinking: [2, 0],
  success: [3, 0],
  focused: [0, 1],
  alert: [1, 1],
  proud: [2, 1],
  thumbsup: [3, 1],
};

// Map OmniState to sprite frame
function getFramePosition(state: OmniState): [number, number] {
  switch (state) {
    case "wave":
    case "hover":
      return STATE_TO_POSITION.wave;
    
    case "thinking":
    case "waiting":
      return STATE_TO_POSITION.thinking;
    
    case "success":
    case "celebrate":
      return STATE_TO_POSITION.success;
    
    case "focused":
    case "curious":
      return STATE_TO_POSITION.focused;
    
    case "alert":
    case "concerned":
    case "error":
      return STATE_TO_POSITION.alert;
    
    case "proud":
      return STATE_TO_POSITION.proud;
    
    case "thumbsup":
      return STATE_TO_POSITION.thumbsup;
    
    case "idle":
    case "relaxed":
    default:
      return STATE_TO_POSITION.idle;
  }
}

// Get animation class for state
function getAnimationClass(state: OmniState): string {
  switch (state) {
    case "wave":
    case "hover":
      return "animate-bounce-subtle";
    
    case "thinking":
    case "waiting":
      return "animate-pulse-subtle";
    
    case "success":
    case "celebrate":
      return "animate-celebrate";
    
    case "thumbsup":
      return "animate-bounce-subtle";
    
    case "focused":
    case "curious":
      return "animate-float";
    
    case "alert":
    case "error":
    case "concerned":
      return "animate-shake";
    
    case "proud":
      return "animate-float-slow";
    
    case "idle":
    case "relaxed":
    default:
      return "animate-breathe-slow";
  }
}

interface Character3DProps {
  state: OmniState;
  size?: number;
  badge?: boolean;
  className?: string;
}

export default function Character3D({ 
  state, 
  size = 120, 
  badge, 
  className = "" 
}: Character3DProps) {
  const [currentState, setCurrentState] = useState<OmniState>(state);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Handle state transitions
  useEffect(() => {
    if (state !== currentState) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentState(state);
        setIsTransitioning(false);
      }, 150);
    }
  }, [state, currentState]);

  // Calculate background position for current frame
  const [col, row] = getFramePosition(currentState);
  const backgroundPositionX = -(col * FRAME_WIDTH);
  const backgroundPositionY = -(row * FRAME_HEIGHT);

  // Scale factor to match desired size
  const scaleFactor = size / FRAME_WIDTH;
  const scaledSheetWidth = FRAME_WIDTH * COLS * scaleFactor;
  const scaledSheetHeight = FRAME_HEIGHT * ROWS * scaleFactor;

  const animationClass = getAnimationClass(currentState);

  return (
    <div 
      className={`relative ${className}`} 
      style={{ width: size, height: size }}
    >
      {/* Character Sprite */}
      <div
        className={`w-full h-full transition-all duration-300 ${animationClass} ${
          isTransitioning ? "opacity-0 scale-95" : "opacity-100 scale-100"
        }`}
        style={{
          backgroundImage: `url(${SPRITE_SHEET_URL})`,
          backgroundSize: `${scaledSheetWidth}px ${scaledSheetHeight}px`,
          backgroundPosition: `${backgroundPositionX * scaleFactor}px ${backgroundPositionY * scaleFactor}px`,
          backgroundRepeat: "no-repeat",
          filter: state === "error" ? "brightness(0.8) saturate(1.2)" : "none",
        }}
        role="img"
        aria-label={`Omni character in ${currentState} state`}
      />

      {/* Badge Indicator */}
      {badge && (
        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-500 animate-pulse-subtle border-2 border-white shadow-lg" />
      )}

      {/* State-specific Effects */}
      {(state === "success" || state === "celebrate") && (
        <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping-once" />
      )}
      
      {state === "alert" && (
        <div className="absolute inset-0 rounded-full bg-orange-500/20 animate-pulse" />
      )}
      
      {state === "error" && (
        <div className="absolute inset-0 rounded-full bg-red-500/20 animate-pulse" />
      )}
    </div>
  );
}
