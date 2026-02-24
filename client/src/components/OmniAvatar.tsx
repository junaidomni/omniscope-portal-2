import { useState, useEffect, useRef, useMemo } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

export type OmniMode = "sigil" | "character" | "hidden";

export type OmniState =
  | "idle"
  | "hover"
  | "thinking"
  | "success"
  | "error"
  | "wave"
  | "thumbsup"
  | "celebrate"
  | "curious"
  | "concerned"
  | "focused"
  | "alert"
  | "proud"
  | "waiting"
  | "relaxed";

// Theme-adaptive color palette for Omni's rim, glow, and ambient aura.
// Eyes always keep their gold core identity.
export interface OmniThemeColors {
  rim: string;
  rimRgb: string;
  ambient: string;
  ambientRgb: string;
}

export const OMNI_THEME_PALETTES: Record<string, OmniThemeColors> = {
  obsidian: { rim: "#d4af37", rimRgb: "212,175,55", ambient: "#d4af37", ambientRgb: "212,175,55" },
  ivory:    { rim: "#b8860b", rimRgb: "184,134,11", ambient: "#b8860b", ambientRgb: "184,134,11" },
  midnight: { rim: "#7c8db5", rimRgb: "124,141,181", ambient: "#7c8db5", ambientRgb: "124,141,181" },
  emerald:  { rim: "#6b9e78", rimRgb: "107,158,120", ambient: "#6b9e78", ambientRgb: "107,158,120" },
  slate:    { rim: "#d4a054", rimRgb: "212,160,84", ambient: "#d4a054", ambientRgb: "212,160,84" },
};

// State-specific overlay colors that mix with the theme rim
export const STATE_OVERLAYS: Partial<Record<OmniState, { color: string; rgb: string }>> = {
  success:   { color: "#22c55e", rgb: "34,197,94" },
  celebrate: { color: "#eab308", rgb: "234,179,8" },
  error:     { color: "#ef4444", rgb: "239,68,68" },
  alert:     { color: "#f97316", rgb: "249,115,22" },
  concerned: { color: "#f59e0b", rgb: "245,158,11" },
  focused:   { color: "#3b82f6", rgb: "59,130,246" },
  thinking:  { color: "#6366f1", rgb: "99,102,241" },
  waiting:   { color: "#06b6d4", rgb: "6,182,212" },
  proud:     { color: "#eab308", rgb: "234,179,8" },
};

// Omni feature preferences (stored in localStorage)
export interface OmniPreferences {
  emotionalReactions: boolean;
  idleAnimations: boolean;
  proactiveStates: boolean;
}

const OMNI_PREFS_KEY = "omniscope-omni-prefs";

export function getOmniPreferences(): OmniPreferences {
  try {
    const stored = localStorage.getItem(OMNI_PREFS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { emotionalReactions: true, idleAnimations: true, proactiveStates: true };
}

export function setOmniPreferences(prefs: OmniPreferences) {
  try {
    localStorage.setItem(OMNI_PREFS_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new StorageEvent("storage", { key: OMNI_PREFS_KEY, newValue: JSON.stringify(prefs) }));
  } catch {}
}

interface OmniAvatarProps {
  mode: OmniMode;
  state: OmniState;
  size?: number;
  onClick?: () => void;
  badge?: boolean;
  className?: string;
  theme?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getThemePalette(theme: string): OmniThemeColors {
  return OMNI_THEME_PALETTES[theme] || OMNI_THEME_PALETTES.obsidian;
}

function getActiveRim(state: OmniState, theme: string): { color: string; rgb: string } {
  const overlay = STATE_OVERLAYS[state];
  if (overlay) return overlay;
  const palette = getThemePalette(theme);
  return { color: palette.rim, rgb: palette.rimRgb };
}

// ─── Sigil Mode ─────────────────────────────────────────────────────────────

function SigilAvatar({ state, size = 56, badge, theme = "obsidian" }: Omit<OmniAvatarProps, "mode" | "onClick" | "className">) {
  const r = size / 2;
  const outerR = r - 2;
  const midR = r - 8;
  const innerR = r - 14;
  const rim = getActiveRim(state, theme);

  const pulseClass =
    state === "thinking" || state === "focused" ? "animate-spin-slow" :
    state === "success" || state === "thumbsup" || state === "celebrate" || state === "proud" ? "animate-pulse-gold" :
    state === "error" || state === "alert" ? "animate-omni-alert-pulse" :
    state === "concerned" ? "animate-omni-concerned" :
    state === "waiting" ? "animate-omni-waiting" :
    state === "curious" ? "animate-omni-curious" :
    state === "relaxed" ? "animate-breathe-slow" :
    state === "hover" || state === "wave" ? "animate-glow" :
    "animate-breathe";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className={`transition-all duration-500 ${pulseClass}`}
      >
        <defs>
          <radialGradient id="sigil-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={rim.color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={rim.color} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={r} cy={r} r={outerR} fill="url(#sigil-glow)" />
        <circle cx={r} cy={r} r={outerR} fill="none" stroke={rim.color} strokeWidth="1.5" strokeOpacity={state === "error" ? 0.3 : 0.7} />
        <circle cx={r} cy={r} r={midR} fill="none" stroke={rim.color} strokeWidth="1" strokeOpacity={state === "error" ? 0.2 : 0.4} strokeDasharray={state === "thinking" || state === "focused" ? "4 4" : "none"} />
        <circle cx={r} cy={r} r={innerR} fill="none" stroke={rim.color} strokeWidth="0.75" strokeOpacity={state === "error" ? 0.15 : 0.3} />
        <circle cx={r} cy={r} r={3} fill="#eab308" opacity={state === "idle" || state === "relaxed" ? 0.8 : 1} />
        {(state === "success" || state === "celebrate" || state === "proud") && (
          <circle cx={r} cy={r} r={outerR - 2} fill="none" stroke={rim.color} strokeWidth="2" opacity="0.6" className="animate-ping-once" />
        )}
      </svg>
      {badge && (
        <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-yellow-500 animate-pulse-subtle border-2 border-zinc-900" />
      )}
    </div>
  );
}

// ─── Character Mode (NOMI-Inspired) ────────────────────────────────────────
// Dark sphere with expressive gold pill-shaped eyes. Inspired by NIO NOMI.
// Eyes track cursor, blink periodically, and change expression based on state.

function CharacterAvatar({ state, size = 56, badge, theme = "obsidian" }: Omit<OmniAvatarProps, "mode" | "onClick" | "className">) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const [blinking, setBlinking] = useState(false);
  const [idleBehavior, setIdleBehavior] = useState<"none" | "glance-left" | "glance-right" | "glance-up" | "tilt">("none");
  const [prefs, setPrefs] = useState(getOmniPreferences);

  const rim = getActiveRim(state, theme);
  const palette = getThemePalette(theme);

  // Listen for preference changes
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === OMNI_PREFS_KEY) setPrefs(getOmniPreferences());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // ── Cursor tracking ──
  useEffect(() => {
    if (state === "thinking" || state === "focused") {
      setEyeOffset({ x: -1.5, y: 1 });
      return;
    }
    if (state === "thumbsup" || state === "celebrate" || state === "proud") {
      setEyeOffset({ x: 0, y: 0 });
      return;
    }
    if (state === "curious") {
      setEyeOffset({ x: 1.5, y: -1 });
      return;
    }
    if (state === "concerned") {
      setEyeOffset({ x: 0, y: 1 });
      return;
    }
    if (state === "waiting") {
      setEyeOffset({ x: 0, y: -0.8 });
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

  // ── Natural blink pattern ──
  useEffect(() => {
    const scheduleBlink = () => {
      const delay = state === "relaxed" ? 4000 + Math.random() * 3000 : 2500 + Math.random() * 3000;
      return setTimeout(() => {
        setBlinking(true);
        setTimeout(() => {
          setBlinking(false);
          if (Math.random() < 0.2) {
            setTimeout(() => {
              setBlinking(true);
              setTimeout(() => setBlinking(false), 100);
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
  }, [state]);

  // ── Enhanced idle behaviors ──
  useEffect(() => {
    if (!prefs.idleAnimations || (state !== "idle" && state !== "relaxed")) {
      setIdleBehavior("none");
      return;
    }

    const behaviors: Array<"glance-left" | "glance-right" | "glance-up" | "tilt"> = [
      "glance-left", "glance-right", "glance-up", "tilt",
    ];

    const scheduleIdleBehavior = () => {
      const delay = 6000 + Math.random() * 8000;
      return setTimeout(() => {
        const behavior = behaviors[Math.floor(Math.random() * behaviors.length)];
        setIdleBehavior(behavior);
        setTimeout(() => setIdleBehavior("none"), 1500);
      }, delay);
    };

    let timer = scheduleIdleBehavior();
    const interval = setInterval(() => {
      clearTimeout(timer);
      timer = scheduleIdleBehavior();
    }, 14000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [state, prefs.idleAnimations]);

  // Apply idle behavior offsets
  const idleEyeAdjust = useMemo(() => {
    switch (idleBehavior) {
      case "glance-left": return { x: -2.5, y: 0 };
      case "glance-right": return { x: 2.5, y: 0 };
      case "glance-up": return { x: 0, y: -1.5 };
      default: return { x: 0, y: 0 };
    }
  }, [idleBehavior]);

  const finalEyeOffset = {
    x: eyeOffset.x + idleEyeAdjust.x,
    y: eyeOffset.y + idleEyeAdjust.y,
  };

  const s = size;
  const r = s / 2;
  const bodyR = r - 3;
  const scale = s / 56;

  // ── Original NOMI pill-shaped eye dimensions ──
  const eyeW = 4.5 * scale;
  const eyeSpacing = 8 * scale;

  const getEyeH = () => {
    if (blinking) return 0.8 * scale;
    switch (state) {
      case "hover": case "wave": return 7 * scale;
      case "curious": return 8 * scale;            // Extra tall, wide-eyed
      case "thinking": return 4 * scale;
      case "focused": return 4.5 * scale;
      case "success": case "thumbsup": case "celebrate": case "proud": return 2 * scale;
      case "error": case "alert": return 5 * scale;
      case "concerned": return 5 * scale;
      case "waiting": return 5.5 * scale;            // Wider, patient eyes
      case "relaxed": return 3.5 * scale;           // Soft, droopy
      default: return 6 * scale;
    }
  };

  const eyeH = getEyeH();
  const eyeRx = eyeW / 2;
  const eyeRy = Math.min(eyeH / 2, eyeRx);

  const happyStates: OmniState[] = ["success", "thumbsup", "celebrate", "proud"];
  const isHappy = happyStates.includes(state);
  const eyeY = isHappy ? r - 1 * scale : r - 2 * scale;

  // Eye color: gold core always, state-tinted
  const getEyeColor = () => {
    switch (state) {
      case "error": case "alert": return "#d97706";
      case "concerned": return "#f59e0b";
      case "focused": return "#eab308";
      case "relaxed": return "#d4af37";
      case "waiting": return "#eab308";              // Warm gold, patient
      default: return "#eab308";
    }
  };
  const eyeColor = getEyeColor();
  const eyeOpacity = (state === "thinking" || state === "focused") ? 0.6 : (state === "relaxed" ? 0.75 : 0.95);

  const showMouth = ["success", "error", "hover", "thumbsup", "wave", "celebrate", "proud", "curious", "concerned", "relaxed", "alert"].includes(state);

  const rimOpacity =
    state === "hover" || state === "wave" || state === "curious" ? 0.6 :
    state === "thinking" || state === "focused" ? 0.3 :
    isHappy ? 0.8 :
    state === "error" || state === "alert" ? 0.4 :
    state === "concerned" ? 0.35 :
    state === "relaxed" ? 0.2 :
    state === "waiting" ? 0.3 :
    0.35;

  const glowClass = !prefs.emotionalReactions ? "animate-breathe" :
    state === "thinking" || state === "focused" ? "animate-omni-think" :
    isHappy ? "animate-omni-success" :
    state === "alert" ? "animate-omni-alert-pulse" :
    state === "concerned" ? "animate-omni-concerned" :
    state === "curious" ? "animate-omni-curious" :
    state === "waiting" ? "animate-omni-waiting" :
    state === "relaxed" ? "animate-breathe-slow" :
    state === "hover" || state === "wave" ? "animate-glow" :
    "animate-breathe";

  // Idle float
  const floatClass = prefs.idleAnimations && (state === "idle" || state === "relaxed") ? "animate-omni-float" : "";

  // Curiosity tilt
  const tiltDeg = idleBehavior === "tilt" ? 5 : state === "curious" ? 4 : state === "concerned" ? -3 : 0;

  const uid = useRef(`omni-${Math.random().toString(36).slice(2, 8)}`).current;

  // Arm calculations
  const armBaseX = r + bodyR * 0.7;
  const armBaseY = r + bodyR * 0.3;

  return (
    <div ref={containerRef} className={`relative ${floatClass}`} style={{ width: s, height: s + (state === "thumbsup" || state === "wave" || state === "celebrate" ? 8 * scale : 0) }}>
      <svg
        viewBox={`0 0 ${s + 20 * scale} ${s + 12 * scale}`}
        width={s + 20 * scale}
        height={s + 12 * scale}
        className={`transition-all duration-300 ${glowClass}`}
        style={{
          marginLeft: -10 * scale,
          marginTop: -2 * scale,
          transform: tiltDeg ? `rotate(${tiltDeg}deg)` : undefined,
          transition: "transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <defs>
          {/* Original dark body gradient */}
          <radialGradient id={`${uid}-body`} cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#2a2a2e" />
            <stop offset="70%" stopColor="#1a1a1e" />
            <stop offset="100%" stopColor="#111113" />
          </radialGradient>
          <radialGradient id={`${uid}-rim`} cx="50%" cy="50%" r="50%">
            <stop offset="85%" stopColor="transparent" />
            <stop offset="95%" stopColor={rim.color} stopOpacity={rimOpacity} />
            <stop offset="100%" stopColor={rim.color} stopOpacity={rimOpacity * 0.3} />
          </radialGradient>
          <filter id={`${uid}-eye-glow`}>
            <feGaussianBlur stdDeviation={state === "hover" || state === "wave" || state === "curious" ? "2" : "1"} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id={`${uid}-ambient`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={rim.color} stopOpacity={state === "hover" || state === "celebrate" || state === "alert" ? 0.15 : 0.06} />
            <stop offset="100%" stopColor={rim.color} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Center offset for arm space */}
        <g transform={`translate(${10 * scale}, ${2 * scale})`}>
          {/* Ambient glow */}
          <circle cx={r} cy={r} r={bodyR + 6} fill={`url(#${uid}-ambient)`} />

          {/* Wave arm — behind body, left side */}
          {state === "wave" && (
            <g className="animate-omni-wave" style={{ transformOrigin: `${r - bodyR * 0.6}px ${r}px` }}>
              <path
                d={`M ${r - bodyR * 0.6} ${r}
                    Q ${r - bodyR - 6 * scale} ${r - 6 * scale}
                      ${r - bodyR - 8 * scale} ${r - 14 * scale}`}
                fill="none" stroke="#2a2a2e" strokeWidth={4 * scale} strokeLinecap="round"
              />
              <circle
                cx={r - bodyR - 8 * scale} cy={r - 14 * scale} r={3 * scale}
                fill="#2a2a2e" stroke={rim.color} strokeWidth={0.8 * scale} strokeOpacity="0.4"
              />
            </g>
          )}

          {/* Main body — original dark sphere */}
          <circle cx={r} cy={r} r={bodyR} fill={`url(#${uid}-body)`} />
          <circle cx={r} cy={r} r={bodyR} fill={`url(#${uid}-rim)`} className="transition-all duration-500" />
          <circle cx={r} cy={r + bodyR * 0.15} r={bodyR * 0.85} fill="none" stroke="#000" strokeWidth="0.5" strokeOpacity="0.2" />

          {/* ── Eyes — Original pill/rect shape ── */}
          <g filter={`url(#${uid}-eye-glow)`} className="transition-all duration-150">
            {/* Left eye */}
            {isHappy ? (
              <path
                d={`M ${r - eyeSpacing - eyeW} ${eyeY + finalEyeOffset.y}
                    Q ${r - eyeSpacing} ${eyeY - 3 * scale + finalEyeOffset.y}
                      ${r - eyeSpacing + eyeW} ${eyeY + finalEyeOffset.y}`}
                fill="none" stroke="#eab308" strokeWidth={2 * scale} strokeLinecap="round"
                className="transition-all duration-300"
              />
            ) : (
              <rect
                x={r - eyeSpacing - eyeW / 2 + finalEyeOffset.x}
                y={eyeY - eyeH / 2 + finalEyeOffset.y}
                width={eyeW} height={eyeH} rx={eyeRx} ry={eyeRy}
                fill={eyeColor}
                opacity={eyeOpacity}
                className="transition-all duration-150"
              />
            )}

            {/* Right eye */}
            {isHappy ? (
              <path
                d={`M ${r + eyeSpacing - eyeW} ${eyeY + finalEyeOffset.y}
                    Q ${r + eyeSpacing} ${eyeY - 3 * scale + finalEyeOffset.y}
                      ${r + eyeSpacing + eyeW} ${eyeY + finalEyeOffset.y}`}
                fill="none" stroke="#eab308" strokeWidth={2 * scale} strokeLinecap="round"
                className="transition-all duration-300"
              />
            ) : state === "error" || state === "alert" ? (
              <rect
                x={r + eyeSpacing - eyeW / 2 + finalEyeOffset.x}
                y={eyeY - eyeH / 2 + finalEyeOffset.y - 0.5 * scale}
                width={eyeW} height={eyeH} rx={eyeRx} ry={eyeRy}
                fill={eyeColor} opacity={0.9}
                transform={`rotate(8, ${r + eyeSpacing + finalEyeOffset.x}, ${eyeY + finalEyeOffset.y})`}
                className="transition-all duration-150"
              />
            ) : (
              <rect
                x={r + eyeSpacing - eyeW / 2 + finalEyeOffset.x}
                y={eyeY - eyeH / 2 + finalEyeOffset.y}
                width={eyeW} height={eyeH} rx={eyeRx} ry={eyeRy}
                fill={eyeColor}
                opacity={eyeOpacity}
                className="transition-all duration-150"
              />
            )}
          </g>

          {/* ── Mouths ── */}
          {/* Happy smile */}
          {showMouth && isHappy && (
            <path
              d={`M ${r - 4 * scale} ${r + 5 * scale}
                  Q ${r} ${r + 8.5 * scale}
                    ${r + 4 * scale} ${r + 5 * scale}`}
              fill="none" stroke="#eab308" strokeWidth={1.2 * scale} strokeLinecap="round" opacity="0.7"
              className="transition-all duration-300"
            />
          )}
          {/* Error/alert frown */}
          {showMouth && (state === "error" || state === "alert") && (
            <path
              d={`M ${r - 3 * scale} ${r + 6.5 * scale}
                  Q ${r} ${r + 5 * scale}
                    ${r + 3 * scale} ${r + 6.5 * scale}`}
              fill="none" stroke={eyeColor} strokeWidth={1 * scale} strokeLinecap="round" opacity="0.5"
            />
          )}
          {/* Concerned — small worried line */}
          {showMouth && state === "concerned" && (
            <path
              d={`M ${r - 2.5 * scale} ${r + 6 * scale}
                  Q ${r} ${r + 5.5 * scale}
                    ${r + 2.5 * scale} ${r + 6 * scale}`}
              fill="none" stroke="#f59e0b" strokeWidth={0.8 * scale} strokeLinecap="round" opacity="0.4"
            />
          )}
          {/* Hover/wave — subtle smile */}
          {showMouth && (state === "hover" || state === "wave") && (
            <path
              d={`M ${r - 3 * scale} ${r + 5.5 * scale}
                  Q ${r} ${r + 6.5 * scale}
                    ${r + 3 * scale} ${r + 5.5 * scale}`}
              fill="none" stroke={rim.color} strokeWidth={0.8 * scale} strokeLinecap="round" opacity="0.4"
            />
          )}
          {/* Curious — small "o" */}
          {showMouth && state === "curious" && (
            <circle
              cx={r} cy={r + 5.5 * scale} r={1.8 * scale}
              fill="none" stroke="#eab308" strokeWidth={0.7 * scale} opacity="0.35"
            />
          )}
          {/* Relaxed — gentle content line */}
          {showMouth && state === "relaxed" && (
            <path
              d={`M ${r - 2.5 * scale} ${r + 5 * scale}
                  Q ${r} ${r + 6 * scale}
                    ${r + 2.5 * scale} ${r + 5 * scale}`}
              fill="none" stroke={palette.rim} strokeWidth={0.6 * scale} strokeLinecap="round" opacity="0.3"
            />
          )}

          {/* ── Thinking — eyes look sideways, single pulsing ring around body ── */}
          {state === "thinking" && (
            <circle
              cx={r} cy={r} r={bodyR + 2}
              fill="none" stroke={rim.color} strokeWidth={1 * scale}
              strokeDasharray={`${4 * scale} ${3 * scale}`}
              opacity="0.3"
              className="animate-spin-slow"
            />
          )}

          {/* ── Focused — similar to thinking but steadier ── */}
          {state === "focused" && (
            <circle
              cx={r} cy={r} r={bodyR + 2}
              fill="none" stroke={rim.color} strokeWidth={0.8 * scale}
              strokeDasharray={`${6 * scale} ${2 * scale}`}
              opacity="0.25"
              className="animate-spin-slow"
            />
          )}

          {/* ── Waiting — gentle patient smile + slow orbiting ring ── */}
          {state === "waiting" && (
            <>
              {/* Small calm smile */}
              <path
                d={`M ${r - 3 * scale} ${r + 5 * scale}
                    Q ${r} ${r + 7 * scale}
                      ${r + 3 * scale} ${r + 5 * scale}`}
                fill="none" stroke="#eab308" strokeWidth={0.9 * scale} strokeLinecap="round" opacity="0.45"
              />
              {/* Gentle slow-spinning ring */}
              <circle
                cx={r} cy={r} r={bodyR + 2.5}
                fill="none" stroke={rim.color} strokeWidth={0.7 * scale}
                strokeDasharray={`${8 * scale} ${12 * scale}`}
                opacity="0.25"
                className="animate-spin-slow"
              />
            </>
          )}

          {/* ── Alert indicator — subtle pulsing ring ── */}
          {state === "alert" && (
            <circle cx={r} cy={r} r={bodyR + 3}
              fill="none" stroke="#f97316" strokeWidth={1 * scale} opacity="0.35"
              className="animate-pulse-subtle" />
          )}

          {/* ── Thumbs up arm — right side, in front of body ── */}
          {state === "thumbsup" && (
            <g className="animate-omni-thumbsup" style={{ transformOrigin: `${armBaseX}px ${armBaseY}px` }}>
              <path
                d={`M ${armBaseX} ${armBaseY}
                    Q ${r + bodyR + 2 * scale} ${r - 2 * scale}
                      ${r + bodyR + 4 * scale} ${r - 10 * scale}`}
                fill="none" stroke="#2a2a2e" strokeWidth={4 * scale} strokeLinecap="round"
              />
              <circle
                cx={r + bodyR + 4 * scale} cy={r - 10 * scale} r={3.5 * scale}
                fill="#2a2a2e" stroke={rim.color} strokeWidth={0.8 * scale} strokeOpacity="0.5"
              />
              <line
                x1={r + bodyR + 4 * scale} y1={r - 13.5 * scale}
                x2={r + bodyR + 4 * scale} y2={r - 18 * scale}
                stroke="#eab308" strokeWidth={2 * scale} strokeLinecap="round" opacity="0.8"
              />
            </g>
          )}

          {/* ── Celebration sparkles ── */}
          {(state === "celebrate" || state === "proud") && (
            <g>
              <circle cx={r - bodyR - 4 * scale} cy={r - 8 * scale} r={1.5 * scale} fill="#eab308" opacity="0.8" className="animate-sparkle-1" />
              <circle cx={r + bodyR + 5 * scale} cy={r - 6 * scale} r={1 * scale} fill="#eab308" opacity="0.7" className="animate-sparkle-2" />
              <circle cx={r - 6 * scale} cy={r - bodyR - 4 * scale} r={1.2 * scale} fill="#fbbf24" opacity="0.6" className="animate-sparkle-3" />
              <circle cx={r + 8 * scale} cy={r - bodyR - 2 * scale} r={1.5 * scale} fill="#fbbf24" opacity="0.8" className="animate-sparkle-1" />
              <circle cx={r - bodyR - 2 * scale} cy={r + 4 * scale} r={0.8 * scale} fill="#eab308" opacity="0.5" className="animate-sparkle-2" />
              <circle cx={r + bodyR + 3 * scale} cy={r + 6 * scale} r={1 * scale} fill="#eab308" opacity="0.6" className="animate-sparkle-3" />
              <text x={r - bodyR - 6 * scale} y={r - 12 * scale} fontSize={6 * scale} fill="#eab308" opacity="0.7" className="animate-sparkle-2">✦</text>
              <text x={r + bodyR + 2 * scale} y={r - 12 * scale} fontSize={5 * scale} fill="#fbbf24" opacity="0.6" className="animate-sparkle-1">✦</text>
              <text x={r} y={r - bodyR - 6 * scale} fontSize={7 * scale} fill="#eab308" opacity="0.8" className="animate-sparkle-3">★</text>
            </g>
          )}

          {/* ── Success ring flash ── */}
          {(state === "success" || state === "celebrate" || state === "proud") && (
            <circle cx={r} cy={r} r={bodyR - 1} fill="none" stroke={rim.color} strokeWidth="1.5" opacity="0.4" className="animate-ping-once" />
          )}
        </g>
      </svg>

      {/* Notification badge */}
      {badge && (
        <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-yellow-500 animate-pulse-subtle border-2 border-zinc-900" />
      )}
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export default function OmniAvatar({ mode, state, size = 56, onClick, badge, className, theme = "obsidian" }: OmniAvatarProps) {
  const [hovered, setHovered] = useState(false);
  const currentState = hovered && state === "idle" ? "hover" : state;

  if (mode === "hidden") return null;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative cursor-pointer transition-transform duration-200 hover:scale-110 active:scale-95 focus:outline-none ${className || ""}`}
      title="Ask Omni"
      aria-label="Ask Omni AI Assistant"
    >
      {mode === "sigil" ? (
        <SigilAvatar state={currentState} size={size} badge={badge} theme={theme} />
      ) : (
        <CharacterAvatar state={currentState} size={size} badge={badge} theme={theme} />
      )}
    </button>
  );
}
