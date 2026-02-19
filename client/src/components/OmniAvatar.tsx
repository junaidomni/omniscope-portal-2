import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

export type OmniMode = "sigil" | "character" | "hidden";
export type OmniState = "idle" | "hover" | "thinking" | "success" | "error";

interface OmniAvatarProps {
  mode: OmniMode;
  state: OmniState;
  size?: number; // px, default 56
  onClick?: () => void;
  badge?: boolean; // gold notification dot
}

// ─── Sigil Mode ─────────────────────────────────────────────────────────────
// Concentric gold rings with breathing pulse. Institutional, geometric, premium.

function SigilAvatar({ state, size = 56, badge }: Omit<OmniAvatarProps, "mode" | "onClick">) {
  const r = size / 2;
  const outerR = r - 2;
  const midR = r - 8;
  const innerR = r - 14;

  const pulseClass =
    state === "thinking" ? "animate-spin-slow" :
    state === "success" ? "animate-pulse-gold" :
    state === "error" ? "opacity-50" :
    state === "hover" ? "animate-glow" :
    "animate-breathe";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className={`transition-all duration-500 ${pulseClass}`}
      >
        {/* Outer glow */}
        <defs>
          <radialGradient id="sigil-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ca8a04" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ca8a04" stopOpacity="0" />
          </radialGradient>
          <filter id="sigil-blur">
            <feGaussianBlur stdDeviation="2" />
          </filter>
        </defs>

        {/* Background glow */}
        <circle cx={r} cy={r} r={outerR} fill="url(#sigil-glow)" />

        {/* Outer ring */}
        <circle
          cx={r} cy={r} r={outerR}
          fill="none"
          stroke="#ca8a04"
          strokeWidth="1.5"
          strokeOpacity={state === "error" ? 0.3 : 0.7}
        />

        {/* Middle ring */}
        <circle
          cx={r} cy={r} r={midR}
          fill="none"
          stroke="#ca8a04"
          strokeWidth="1"
          strokeOpacity={state === "error" ? 0.2 : 0.4}
          strokeDasharray={state === "thinking" ? "4 4" : "none"}
        />

        {/* Inner ring */}
        <circle
          cx={r} cy={r} r={innerR}
          fill="none"
          stroke="#ca8a04"
          strokeWidth="0.75"
          strokeOpacity={state === "error" ? 0.15 : 0.3}
        />

        {/* Center dot */}
        <circle
          cx={r} cy={r} r={3}
          fill="#ca8a04"
          opacity={state === "idle" ? 0.8 : 1}
        />

        {/* Success flash */}
        {state === "success" && (
          <circle
            cx={r} cy={r} r={outerR - 2}
            fill="none"
            stroke="#eab308"
            strokeWidth="2"
            opacity="0.6"
            className="animate-ping-once"
          />
        )}
      </svg>

      {/* Notification badge */}
      {badge && (
        <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-yellow-500 animate-pulse-subtle border-2 border-zinc-900" />
      )}
    </div>
  );
}

// ─── Character Mode ─────────────────────────────────────────────────────────
// Minimal geometric companion with eyes that track cursor. Premium, not childish.

function CharacterAvatar({ state, size = 56, badge }: Omit<OmniAvatarProps, "mode" | "onClick">) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });

  // Track cursor for eye movement
  useEffect(() => {
    if (state === "thinking") return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxOffset = 3;
      const factor = Math.min(dist / 200, 1);
      setEyeOffset({
        x: (dx / (dist || 1)) * maxOffset * factor,
        y: (dy / (dist || 1)) * maxOffset * factor,
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [state]);

  const r = size / 2;
  const bodyR = r - 4;

  // Blink animation
  const [blinking, setBlinking] = useState(false);
  useEffect(() => {
    const blink = () => {
      setBlinking(true);
      setTimeout(() => setBlinking(false), 150);
    };
    const interval = setInterval(blink, 3000 + Math.random() * 2000);
    return () => clearInterval(interval);
  }, []);

  const eyeH = blinking ? 0.5 : state === "error" ? 2.5 : 3;
  const mouthWidth = state === "success" ? 8 : state === "error" ? 4 : 6;
  const mouthCurve = state === "success" ? -2 : state === "error" ? 1.5 : -0.5;

  const pulseClass =
    state === "thinking" ? "animate-pulse" :
    state === "hover" ? "animate-glow" :
    "animate-breathe";

  return (
    <div ref={containerRef} className="relative" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className={`transition-all duration-300 ${pulseClass}`}
      >
        <defs>
          <radialGradient id="char-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ca8a04" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#ca8a04" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="char-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#27272a" />
            <stop offset="100%" stopColor="#18181b" />
          </linearGradient>
        </defs>

        {/* Background glow */}
        <circle cx={r} cy={r} r={bodyR + 4} fill="url(#char-glow)" />

        {/* Body — soft rounded shape */}
        <ellipse
          cx={r}
          cy={r + 1}
          rx={bodyR}
          ry={bodyR - 2}
          fill="url(#char-body)"
          stroke="#ca8a04"
          strokeWidth="1"
          strokeOpacity="0.4"
        />

        {/* Left eye */}
        <ellipse
          cx={r - 7 + eyeOffset.x}
          cy={r - 3 + eyeOffset.y}
          rx={2.5}
          ry={eyeH}
          fill="#ca8a04"
          opacity={state === "thinking" ? 0.5 : 0.9}
          className="transition-all duration-150"
        />

        {/* Right eye */}
        <ellipse
          cx={r + 7 + eyeOffset.x}
          cy={r - 3 + eyeOffset.y}
          rx={2.5}
          ry={eyeH}
          fill="#ca8a04"
          opacity={state === "thinking" ? 0.5 : 0.9}
          className="transition-all duration-150"
        />

        {/* Mouth — subtle curve */}
        <path
          d={`M ${r - mouthWidth / 2} ${r + 6} Q ${r} ${r + 6 + mouthCurve} ${r + mouthWidth / 2} ${r + 6}`}
          fill="none"
          stroke="#ca8a04"
          strokeWidth="1"
          strokeOpacity="0.5"
          strokeLinecap="round"
          className="transition-all duration-300"
        />

        {/* Thinking dots */}
        {state === "thinking" && (
          <>
            <circle cx={r - 6} cy={r + 6} r={1.5} fill="#ca8a04" opacity="0.6" className="animate-bounce-dot-1" />
            <circle cx={r} cy={r + 6} r={1.5} fill="#ca8a04" opacity="0.6" className="animate-bounce-dot-2" />
            <circle cx={r + 6} cy={r + 6} r={1.5} fill="#ca8a04" opacity="0.6" className="animate-bounce-dot-3" />
          </>
        )}
      </svg>

      {/* Notification badge */}
      {badge && (
        <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-yellow-500 animate-pulse-subtle border-2 border-zinc-900" />
      )}
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export default function OmniAvatar({ mode, state, size = 56, onClick, badge }: OmniAvatarProps) {
  const [hovered, setHovered] = useState(false);
  const currentState = hovered && state === "idle" ? "hover" : state;

  if (mode === "hidden") return null;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative cursor-pointer transition-transform duration-200 hover:scale-110 active:scale-95 focus:outline-none"
      title="Ask Omni"
      aria-label="Ask Omni AI Assistant"
    >
      {mode === "sigil" ? (
        <SigilAvatar state={currentState} size={size} badge={badge} />
      ) : (
        <CharacterAvatar state={currentState} size={size} badge={badge} />
      )}
    </button>
  );
}
