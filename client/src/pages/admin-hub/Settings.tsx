/**
 * Admin Hub — Platform Settings
 * Global configuration for the platform with inline Appearance & Design panel.
 * Apple/Tesla design: minimal, precise, generous whitespace.
 */
import { trpc } from "@/lib/trpc";
import { useDesign } from "@/components/PortalLayout";
import {
  Settings, Globe, Shield, Bell, Palette, Database,
  ChevronRight, ArrowLeft, Save, Check, Monitor, Moon, Sun,
  Type, Layout, Sidebar, Image,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

type SettingsView = "main" | "appearance" | "general" | "security" | "notifications" | "domains" | "data";

const THEME_OPTIONS = [
  { id: "obsidian", label: "Obsidian", desc: "Black & Gold", bg: "#0a0a0a", accent: "#d4af37", icon: Moon },
  { id: "ivory", label: "Ivory", desc: "Light Cream & Charcoal", bg: "#faf9f6", accent: "#2d2d2d", icon: Sun },
  { id: "midnight", label: "Midnight", desc: "Deep Navy & Silver", bg: "#0f172a", accent: "#94a3b8", icon: Moon },
  { id: "emerald", label: "Emerald", desc: "Dark Green & Gold", bg: "#0a1a0a", accent: "#10b981", icon: Moon },
  { id: "slate", label: "Slate", desc: "Cool Gray & Blue", bg: "#1e293b", accent: "#3b82f6", icon: Monitor },
];

const FONT_OPTIONS = [
  { id: "Inter", label: "Inter", sample: "The quick brown fox" },
  { id: "SF Pro", label: "SF Pro", sample: "The quick brown fox" },
  { id: "Roboto", label: "Roboto", sample: "The quick brown fox" },
  { id: "Poppins", label: "Poppins", sample: "The quick brown fox" },
  { id: "JetBrains Mono", label: "JetBrains Mono", sample: "The quick brown fox" },
];

const SIDEBAR_STYLES = [
  { id: "default", label: "Default", desc: "Full sidebar with icons and labels" },
  { id: "compact", label: "Compact", desc: "Narrower sidebar with smaller text" },
  { id: "minimal", label: "Minimal", desc: "Icons only, expand on hover" },
];

const ACCENT_PRESETS = [
  "#d4af37", "#10b981", "#3b82f6", "#a855f7", "#ef4444",
  "#f59e0b", "#06b6d4", "#ec4899", "#8b5cf6", "#64748b",
  "#14532d", "#7c2d12", "#1e3a5f", "#4a1942",
];

export default function AdminHubSettings() {
  const { accentColor: currentAccent, isLightTheme } = useDesign();
  const [view, setView] = useState<SettingsView>("main");

  const cardBg = isLightTheme ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.03)";
  const cardBorder = isLightTheme ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const textPrimary = isLightTheme ? "oklch(0.15 0 0)" : "oklch(0.92 0.02 85)";
  const textSecondary = isLightTheme ? "oklch(0.40 0 0)" : "oklch(0.60 0.02 0)";
  const textMuted = isLightTheme ? "oklch(0.55 0 0)" : "oklch(0.48 0.01 0)";
  const inputBg = isLightTheme ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.04)";

  const tokens = { cardBg, cardBorder, textPrimary, textSecondary, textMuted, inputBg, accentColor: currentAccent, isLightTheme };

  const settingsSections: { id: SettingsView; title: string; description: string; icon: any; ready: boolean }[] = [
    { id: "appearance", title: "Appearance & Design", description: "Platform theme, accent colors, and sidebar preferences", icon: Palette, ready: true },
    { id: "general", title: "General", description: "Platform name, branding, and default configuration", icon: Settings, ready: false },
    { id: "security", title: "Security & Access", description: "Authentication policies, session management, and access controls", icon: Shield, ready: false },
    { id: "notifications", title: "Notifications", description: "Platform-wide notification preferences and channels", icon: Bell, ready: false },
    { id: "domains", title: "Domains & DNS", description: "Custom domain configuration and SSL management", icon: Globe, ready: false },
    { id: "data", title: "Data & Storage", description: "Database management, backups, and storage quotas", icon: Database, ready: false },
  ];

  if (view === "appearance") {
    return <AppearanceSettings tokens={tokens} onBack={() => setView("main")} />;
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: textPrimary }}>
            Platform Settings
          </h1>
          <p className="text-sm mt-1" style={{ color: textSecondary }}>
            Global configuration that applies across all organizations.
          </p>
        </div>

        {/* Settings Grid */}
        <div className="space-y-3">
          {settingsSections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => {
                  if (section.ready) {
                    setView(section.id);
                  } else {
                    toast.info(`${section.title} — coming soon`);
                  }
                }}
                className="w-full rounded-2xl p-5 transition-all duration-200 text-left group"
                style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = `${currentAccent}33`;
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = cardBorder;
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${currentAccent}12` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: currentAccent }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium" style={{ color: textPrimary }}>
                        {section.title}
                      </p>
                      {!section.ready && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ background: `${currentAccent}10`, color: textMuted }}>
                          Soon
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: textMuted }}>
                      {section.description}
                    </p>
                  </div>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 transition-all duration-200"
                    style={{ color: section.ready ? textMuted : `${textMuted}50`, transform: "translateX(0)" }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Info Note */}
        <div
          className="rounded-xl p-4 text-xs"
          style={{
            background: `${currentAccent}08`,
            border: `1px solid ${currentAccent}15`,
            color: textSecondary,
          }}
        >
          Settings marked as "Soon" are actively being developed. Platform-level settings override organization-level defaults unless explicitly overridden per org.
        </div>
      </div>
    </div>
  );
}

/* ─── Appearance & Design Settings ─── */
function AppearanceSettings({ tokens, onBack }: { tokens: any; onBack: () => void }) {
  const designQuery = trpc.design.get.useQuery();
  const updateDesign = trpc.design.update.useMutation({
    onSuccess: () => {
      designQuery.refetch();
      toast.success("Design preferences saved");
    },
    onError: (err: any) => toast.error(err.message || "Failed to save"),
  });

  const [theme, setTheme] = useState("obsidian");
  const [accentColor, setAccentColor] = useState("#d4af37");
  const [fontFamily, setFontFamily] = useState("Inter");
  const [sidebarStyle, setSidebarStyle] = useState("default");
  const [sidebarPosition, setSidebarPosition] = useState<"left" | "right">("left");

  useEffect(() => {
    if (designQuery.data) {
      setTheme(designQuery.data.theme || "obsidian");
      setAccentColor(designQuery.data.accentColor || "#d4af37");
      setFontFamily(designQuery.data.fontFamily || "Inter");
      setSidebarStyle(designQuery.data.sidebarStyle || "default");
      setSidebarPosition(designQuery.data.sidebarPosition || "left");
    }
  }, [designQuery.data]);

  const hasChanges = designQuery.data && (
    theme !== designQuery.data.theme ||
    accentColor !== designQuery.data.accentColor ||
    fontFamily !== designQuery.data.fontFamily ||
    sidebarStyle !== designQuery.data.sidebarStyle ||
    sidebarPosition !== designQuery.data.sidebarPosition
  );

  const handleSave = () => {
    updateDesign.mutate({ theme: theme as any, accentColor, fontFamily, sidebarStyle: sidebarStyle as any, sidebarPosition: sidebarPosition as any });
  };

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header with Back */}
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200"
            style={{ background: tokens.inputBg, border: `1px solid ${tokens.cardBorder}` }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${tokens.accentColor}44`; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = tokens.cardBorder; }}
          >
            <ArrowLeft className="h-4 w-4" style={{ color: tokens.textSecondary }} />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: tokens.textPrimary }}>
              Appearance & Design
            </h1>
            <p className="text-sm mt-0.5" style={{ color: tokens.textSecondary }}>
              Customize the platform's visual identity. Changes apply globally.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={!hasChanges || updateDesign.isPending}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
            style={{
              background: hasChanges ? tokens.accentColor : `${tokens.accentColor}30`,
              color: tokens.isLightTheme ? "#fff" : "#000",
              opacity: hasChanges ? 1 : 0.5,
            }}
          >
            <Save className="h-3.5 w-3.5" />
            {updateDesign.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>

        {/* Theme Selection */}
        <div className="rounded-2xl p-6" style={{ background: tokens.cardBg, border: `1px solid ${tokens.cardBorder}` }}>
          <h3 className="text-sm font-semibold tracking-wide uppercase mb-1" style={{ color: tokens.textMuted, letterSpacing: "0.08em" }}>
            Theme
          </h3>
          <p className="text-xs mb-4" style={{ color: tokens.textMuted }}>
            Choose the base visual theme for the entire platform.
          </p>
          <div className="grid grid-cols-5 gap-3">
            {THEME_OPTIONS.map((t) => {
              const isActive = theme === t.id;
              const ThemeIcon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className="rounded-xl p-3 transition-all duration-200 text-left relative overflow-hidden"
                  style={{
                    background: t.bg,
                    border: `2px solid ${isActive ? t.accent : "transparent"}`,
                    boxShadow: isActive ? `0 0 20px ${t.accent}20` : "none",
                  }}
                >
                  {isActive && (
                    <div className="absolute top-2 right-2">
                      <Check className="h-3.5 w-3.5" style={{ color: t.accent }} />
                    </div>
                  )}
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center mb-2" style={{ background: `${t.accent}20` }}>
                    <ThemeIcon className="h-3.5 w-3.5" style={{ color: t.accent }} />
                  </div>
                  <p className="text-xs font-medium" style={{ color: t.accent }}>{t.label}</p>
                  <p className="text-[9px] mt-0.5" style={{ color: `${t.accent}80` }}>{t.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Accent Color */}
        <div className="rounded-2xl p-6" style={{ background: tokens.cardBg, border: `1px solid ${tokens.cardBorder}` }}>
          <h3 className="text-sm font-semibold tracking-wide uppercase mb-1" style={{ color: tokens.textMuted, letterSpacing: "0.08em" }}>
            Accent Color
          </h3>
          <p className="text-xs mb-4" style={{ color: tokens.textMuted }}>
            The primary accent color used across the platform for highlights, buttons, and interactive elements.
          </p>
          <div className="flex flex-wrap gap-2.5 mb-4">
            {ACCENT_PRESETS.map((color) => (
              <button
                key={color}
                onClick={() => setAccentColor(color)}
                className="w-9 h-9 rounded-full transition-all duration-200"
                style={{
                  background: color,
                  boxShadow: accentColor === color
                    ? `0 0 0 3px ${tokens.isLightTheme ? "#fff" : "#1a1a1a"}, 0 0 0 5px ${color}`
                    : "none",
                  transform: accentColor === color ? "scale(1.15)" : "scale(1)",
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="w-10 h-10 rounded-lg cursor-pointer border-0"
            />
            <input
              type="text"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="w-32 px-3 py-2 rounded-lg text-sm font-mono outline-none"
              style={{ background: tokens.inputBg, border: `1px solid ${tokens.cardBorder}`, color: tokens.textPrimary }}
            />
            <div className="flex-1 h-10 rounded-lg" style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}66)` }} />
          </div>
        </div>



        {/* Sidebar Layout */}
        <div className="rounded-2xl p-6" style={{ background: tokens.cardBg, border: `1px solid ${tokens.cardBorder}` }}>
          <div className="flex items-center gap-2 mb-1">
            <Sidebar className="h-4 w-4" style={{ color: tokens.accentColor }} />
            <h3 className="text-sm font-semibold tracking-wide uppercase" style={{ color: tokens.textMuted, letterSpacing: "0.08em" }}>
              Sidebar Layout
            </h3>
          </div>
          <p className="text-xs mb-4" style={{ color: tokens.textMuted }}>
            Configure the sidebar navigation style and position.
          </p>

          {/* Style */}
          <div className="space-y-2 mb-5">
            {SIDEBAR_STYLES.map((style) => (
              <button
                key={style.id}
                onClick={() => setSidebarStyle(style.id)}
                className="w-full rounded-xl p-3.5 transition-all duration-200 text-left flex items-center gap-4"
                style={{
                  background: sidebarStyle === style.id ? `${tokens.accentColor}08` : "transparent",
                  border: `1px solid ${sidebarStyle === style.id ? `${tokens.accentColor}30` : tokens.cardBorder}`,
                }}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: tokens.textPrimary }}>
                    {style.label}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: tokens.textMuted }}>
                    {style.desc}
                  </p>
                </div>
                {sidebarStyle === style.id && (
                  <Check className="h-4 w-4 shrink-0" style={{ color: tokens.accentColor }} />
                )}
              </button>
            ))}
          </div>

          {/* Position */}
          <div>
            <label className="text-xs font-medium mb-2 block" style={{ color: tokens.textSecondary }}>
              Sidebar Position
            </label>
            <div className="flex gap-2">
              {(["left", "right"] as const).map((pos) => (
                <button
                  key={pos}
                  onClick={() => setSidebarPosition(pos)}
                  className="flex-1 rounded-xl p-3 transition-all duration-200 text-center"
                  style={{
                    background: sidebarPosition === pos ? `${tokens.accentColor}08` : "transparent",
                    border: `1px solid ${sidebarPosition === pos ? `${tokens.accentColor}30` : tokens.cardBorder}`,
                    color: sidebarPosition === pos ? tokens.accentColor : tokens.textSecondary,
                  }}
                >
                  <Layout className="h-4 w-4 mx-auto mb-1" style={{ transform: pos === "right" ? "scaleX(-1)" : "none" }} />
                  <span className="text-xs font-medium capitalize">{pos}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Preview */}
        <div className="rounded-2xl p-6" style={{ background: tokens.cardBg, border: `1px solid ${tokens.cardBorder}` }}>
          <h3 className="text-sm font-semibold tracking-wide uppercase mb-4" style={{ color: tokens.textMuted, letterSpacing: "0.08em" }}>
            Live Preview
          </h3>
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${tokens.cardBorder}` }}>
            <PreviewMockup
              theme={theme}
              accentColor={accentColor}
              fontFamily={fontFamily}
              sidebarStyle={sidebarStyle}
              sidebarPosition={sidebarPosition}
            />
          </div>
        </div>

        {/* Bottom Save */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={!hasChanges || updateDesign.isPending}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
            style={{
              background: hasChanges ? tokens.accentColor : `${tokens.accentColor}30`,
              color: tokens.isLightTheme ? "#fff" : "#000",
              opacity: hasChanges ? 1 : 0.5,
            }}
          >
            <Save className="h-3.5 w-3.5" />
            {updateDesign.isPending ? "Saving..." : "Save All Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Preview Mockup ─── */
function PreviewMockup({
  theme, accentColor, fontFamily, sidebarStyle, sidebarPosition,
}: {
  theme: string; accentColor: string; fontFamily: string; sidebarStyle: string; sidebarPosition: string;
}) {
  const themeConfig = THEME_OPTIONS.find((t) => t.id === theme) || THEME_OPTIONS[0];
  const isLight = theme === "ivory";
  const sidebarWidth = sidebarStyle === "minimal" ? 48 : sidebarStyle === "compact" ? 180 : 220;
  const textColor = isLight ? "#1a1a1a" : "#e5e5e5";
  const mutedColor = isLight ? "#666" : "#888";

  const sidebarEl = (
    <div
      className="shrink-0 flex flex-col p-3 gap-1"
      style={{
        width: sidebarWidth,
        background: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)",
        borderRight: sidebarPosition === "left" ? `1px solid ${isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.06)"}` : "none",
        borderLeft: sidebarPosition === "right" ? `1px solid ${isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.06)"}` : "none",
        fontFamily,
      }}
    >
      {/* Logo area */}
      <div className="flex items-center gap-2 px-2 py-2 mb-2">
        <div className="w-6 h-6 rounded-md" style={{ background: `${accentColor}25` }} />
        {sidebarStyle !== "minimal" && (
          <span className="text-[10px] font-semibold truncate" style={{ color: textColor }}>OmniScope</span>
        )}
      </div>
      {/* Nav items */}
      {["Dashboard", "Intelligence", "Operations", "Settings"].map((item, i) => (
        <div
          key={item}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
          style={{
            background: i === 0 ? `${accentColor}15` : "transparent",
          }}
        >
          <div className="w-4 h-4 rounded" style={{ background: i === 0 ? accentColor : mutedColor, opacity: i === 0 ? 1 : 0.3 }} />
          {sidebarStyle !== "minimal" && (
            <span className="text-[9px]" style={{ color: i === 0 ? accentColor : mutedColor }}>
              {item}
            </span>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex h-48" style={{ background: themeConfig.bg, fontFamily, flexDirection: sidebarPosition === "right" ? "row-reverse" : "row" }}>
      {sidebarEl}
      {/* Main content */}
      <div className="flex-1 p-4">
        <div className="h-3 w-24 rounded mb-2" style={{ background: `${accentColor}30` }} />
        <div className="h-2 w-40 rounded mb-4" style={{ background: `${mutedColor}30` }} />
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg p-2" style={{ background: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)", border: `1px solid ${isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)"}` }}>
              <div className="h-2 w-12 rounded mb-1" style={{ background: `${accentColor}40` }} />
              <div className="h-1.5 w-16 rounded" style={{ background: `${mutedColor}20` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
