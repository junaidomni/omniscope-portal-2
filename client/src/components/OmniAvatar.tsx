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

// ─── Character Mode (NOMI-Inspired) ────────────────────────────────────────
// Dark sphere with expressive gold pill-shaped eyes. Inspired by NIO NOMI.
// Eyes track cursor, blink periodically, and change expression based on state.

function CharacterAvatar({ state, size = 56, badge }: Omit<OmniAvatarProps, "mode" | "onClick">) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const [blinking, setBlinking] = useState(false);
  const [doubleBlink, setDoubleBlink] = useState(false);

  // Track cursor for eye movement
  useEffect(() => {
    if (state === "thinking") {
      // During thinking, eyes look down-left (contemplative)
      setEyeOffset({ x: -1.5, y: 1 });
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxOffset = size > 80 ? 5 : 3;
      const factor = Math.min(dist / 200, 1);
      setEyeOffset({
        x: (dx / (dist || 1)) * maxOffset * factor,
        y: (dy / (dist || 1)) * maxOffset * factor,
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [state, size]);

  // Natural blink pattern — occasional double blinks
  useEffect(() => {
    const scheduleBlink = () => {
      const delay = 2500 + Math.random() * 3000;
      return setTimeout(() => {
        setBlinking(true);
        setTimeout(() => {
          setBlinking(false);
          // 20% chance of double blink
          if (Math.random() < 0.2) {
            setDoubleBlink(true);
            setTimeout(() => {
              setBlinking(true);
              setTimeout(() => {
                setBlinking(false);
                setDoubleBlink(false);
              }, 100);
            }, 120);
          }
        }, 120);
      }, delay);
    };

    let timer = scheduleBlink();
    const interval = setInterval(() => {
      clearTimeout(timer);
      timer = scheduleBlink();
    }, 5500);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  const s = size;
  const r = s / 2;
  const bodyR = r - 3;
  const scale = s / 56; // scale factor relative to base 56px

  // Eye dimensions — NOMI-style rounded rectangles (pill shapes)
  const eyeW = 4.5 * scale;
  const eyeSpacing = 8 * scale;

  // Eye height varies by state and blink
  const getEyeH = () => {
    if (blinking) return 0.8 * scale;
    switch (state) {
      case "hover": return 7 * scale; // wide open, attentive
      case "thinking": return 4 * scale; // narrowed, focused
      case "success": return 2 * scale; // happy squint (arcs)
      case "error": return 5 * scale; // slightly worried
      default: return 6 * scale; // calm, neutral
    }
  };

  const eyeH = getEyeH();
  const eyeRx = eyeW / 2;
  const eyeRy = eyeH / 2;

  // Eye Y position — shifts slightly based on state
  const eyeY = state === "success" ? r - 1 * scale : r - 2 * scale;

  // Mouth — only appears for strong emotions
  const showMouth = state === "success" || state === "error" || state === "hover";

  // Rim glow intensity
  const rimOpacity =
    state === "hover" ? 0.6 :
    state === "thinking" ? 0.3 :
    state === "success" ? 0.8 :
    state === "error" ? 0.2 :
    0.35;

  // Outer glow class
  const glowClass =
    state === "thinking" ? "animate-omni-think" :
    state === "success" ? "animate-omni-success" :
    state === "hover" ? "animate-glow" :
    "animate-breathe";

  // Unique IDs for SVG defs (prevent conflicts when multiple avatars render)
  const uid = useRef(`omni-${Math.random().toString(36).slice(2, 8)}`).current;

  return (
    <div ref={containerRef} className="relative" style={{ width: s, height: s }}>
      <svg
        viewBox={`0 0 ${s} ${s}`}
        width={s}
        height={s}
        className={`transition-all duration-300 ${glowClass}`}
      >
        <defs>
          {/* Body gradient — dark sphere like NOMI */}
          <radialGradient id={`${uid}-body`} cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#2a2a2e" />
            <stop offset="70%" stopColor="#1a1a1e" />
            <stop offset="100%" stopColor="#111113" />
          </radialGradient>

          {/* Gold rim highlight */}
          <radialGradient id={`${uid}-rim`} cx="50%" cy="50%" r="50%">
            <stop offset="85%" stopColor="transparent" />
            <stop offset="95%" stopColor="#ca8a04" stopOpacity={rimOpacity} />
            <stop offset="100%" stopColor="#ca8a04" stopOpacity={rimOpacity * 0.3} />
          </radialGradient>

          {/* Eye glow */}
          <filter id={`${uid}-eye-glow`}>
            <feGaussianBlur stdDeviation={state === "hover" ? "2" : "1"} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Ambient glow behind body */}
          <radialGradient id={`${uid}-ambient`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ca8a04" stopOpacity={state === "hover" ? 0.15 : 0.06} />
            <stop offset="100%" stopColor="#ca8a04" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient glow */}
        <circle cx={r} cy={r} r={bodyR + 6} fill={`url(#${uid}-ambient)`} />

        {/* Main body — dark sphere */}
        <circle
          cx={r}
          cy={r}
          r={bodyR}
          fill={`url(#${uid}-body)`}
        />

        {/* Gold rim highlight */}
        <circle
          cx={r}
          cy={r}
          r={bodyR}
          fill={`url(#${uid}-rim)`}
          className="transition-all duration-500"
        />

        {/* Subtle inner shadow for depth */}
        <circle
          cx={r}
          cy={r + bodyR * 0.15}
          r={bodyR * 0.85}
          fill="none"
          stroke="#000"
          strokeWidth="0.5"
          strokeOpacity="0.2"
        />

        {/* ── Eyes ── */}
        <g filter={`url(#${uid}-eye-glow)`} className="transition-all duration-150">
          {/* Left eye — NOMI pill shape */}
          {state === "success" ? (
            // Happy squint — curved arcs (NOMI smile-eyes)
            <path
              d={`M ${r - eyeSpacing - eyeW} ${eyeY + eyeOffset.y}
                  Q ${r - eyeSpacing} ${eyeY - 3 * scale + eyeOffset.y}
                    ${r - eyeSpacing + eyeW} ${eyeY + eyeOffset.y}`}
              fill="none"
              stroke="#eab308"
              strokeWidth={2 * scale}
              strokeLinecap="round"
              className="transition-all duration-300"
            />
          ) : (
            <rect
              x={r - eyeSpacing - eyeW / 2 + eyeOffset.x}
              y={eyeY - eyeH / 2 + eyeOffset.y}
              width={eyeW}
              height={eyeH}
              rx={eyeRx}
              ry={Math.min(eyeRy, eyeRx)}
              fill={state === "error" ? "#d97706" : "#eab308"}
              opacity={state === "thinking" ? 0.6 : 0.95}
              className="transition-all duration-150"
            />
          )}

          {/* Right eye — NOMI pill shape */}
          {state === "success" ? (
            <path
              d={`M ${r + eyeSpacing - eyeW} ${eyeY + eyeOffset.y}
                  Q ${r + eyeSpacing} ${eyeY - 3 * scale + eyeOffset.y}
                    ${r + eyeSpacing + eyeW} ${eyeY + eyeOffset.y}`}
              fill="none"
              stroke="#eab308"
              strokeWidth={2 * scale}
              strokeLinecap="round"
              className="transition-all duration-300"
            />
          ) : state === "error" ? (
            // Error — right eye tilted slightly (worried asymmetry)
            <rect
              x={r + eyeSpacing - eyeW / 2 + eyeOffset.x}
              y={eyeY - eyeH / 2 + eyeOffset.y - 0.5 * scale}
              width={eyeW}
              height={eyeH}
              rx={eyeRx}
              ry={Math.min(eyeRy, eyeRx)}
              fill="#d97706"
              opacity={0.9}
              transform={`rotate(8, ${r + eyeSpacing + eyeOffset.x}, ${eyeY + eyeOffset.y})`}
              className="transition-all duration-150"
            />
          ) : (
            <rect
              x={r + eyeSpacing - eyeW / 2 + eyeOffset.x}
              y={eyeY - eyeH / 2 + eyeOffset.y}
              width={eyeW}
              height={eyeH}
              rx={eyeRx}
              ry={Math.min(eyeRy, eyeRx)}
              fill="#eab308"
              opacity={state === "thinking" ? 0.6 : 0.95}
              className="transition-all duration-150"
            />
          )}
        </g>

        {/* ── Mouth ── */}
        {showMouth && state === "success" && (
          // Happy mouth — small upward curve
          <path
            d={`M ${r - 4 * scale} ${r + 5 * scale}
                Q ${r} ${r + 8 * scale}
                  ${r + 4 * scale} ${r + 5 * scale}`}
            fill="none"
            stroke="#eab308"
            strokeWidth={1.2 * scale}
            strokeLinecap="round"
            opacity="0.7"
            className="transition-all duration-300"
          />
        )}
        {showMouth && state === "error" && (
          // Worried mouth — small downward curve
          <path
            d={`M ${r - 3 * scale} ${r + 6.5 * scale}
                Q ${r} ${r + 5 * scale}
                  ${r + 3 * scale} ${r + 6.5 * scale}`}
            fill="none"
            stroke="#d97706"
            strokeWidth={1 * scale}
            strokeLinecap="round"
            opacity="0.5"
            className="transition-all duration-300"
          />
        )}
        {showMouth && state === "hover" && (
          // Subtle neutral mouth — tiny line
          <line
            x1={r - 2.5 * scale}
            y1={r + 6 * scale}
            x2={r + 2.5 * scale}
            y2={r + 6 * scale}
            stroke="#ca8a04"
            strokeWidth={0.8 * scale}
            strokeLinecap="round"
            opacity="0.3"
            className="transition-all duration-300"
          />
        )}

        {/* ── Thinking indicator ── */}
        {state === "thinking" && (
          <g>
            <circle cx={r - 5 * scale} cy={r + 7 * scale} r={1.5 * scale} fill="#ca8a04" opacity="0.5" className="animate-bounce-dot-1" />
            <circle cx={r} cy={r + 7 * scale} r={1.5 * scale} fill="#ca8a04" opacity="0.5" className="animate-bounce-dot-2" />
            <circle cx={r + 5 * scale} cy={r + 7 * scale} r={1.5 * scale} fill="#ca8a04" opacity="0.5" className="animate-bounce-dot-3" />
          </g>
        )}

        {/* ── Success sparkle ── */}
        {state === "success" && (
          <circle
            cx={r}
            cy={r}
            r={bodyR - 1}
            fill="none"
            stroke="#eab308"
            strokeWidth="1.5"
            opacity="0.4"
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
