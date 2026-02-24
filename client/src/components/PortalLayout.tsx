import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Sparkles, 
  LogOut,
  Loader2,
  Shield,
  Settings,
  Users,
  ChevronLeft,
  ChevronRight,
  Mail,
  Radio,
  Target,
  UserCog,
  Crown,
  Briefcase,
  Building2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState, useEffect, createContext, useContext, useMemo, useCallback, useRef } from "react";
import OmniAvatar, { OmniMode, OmniState } from "./OmniAvatar";
import OmniChatPanel from "./OmniChatPanel";
import OrgSwitcher from "./OrgSwitcher";
import { useOrg } from "@/contexts/OrgContext";

// ─── Theme Definitions ────────────────────────────────────────────────────
// Each theme maps to CSS variable overrides applied to :root
interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  input: string;
  sidebar: string;
  sidebarForeground: string;
  sidebarAccent: string;
  sidebarBorder: string;
}

const THEME_MAP: Record<string, ThemeColors> = {
  obsidian: {
    // Pure black & gold — the OmniScope default
    background: "oklch(0.12 0 0)",
    foreground: "oklch(0.88 0.05 85)",
    card: "oklch(0.16 0 0)",
    cardForeground: "oklch(0.88 0.05 85)",
    popover: "oklch(0.14 0 0)",
    popoverForeground: "oklch(0.88 0.05 85)",
    secondary: "oklch(0.20 0 0)",
    secondaryForeground: "oklch(0.88 0.05 85)",
    muted: "oklch(0.22 0 0)",
    mutedForeground: "oklch(0.60 0.03 85)",
    border: "oklch(0.25 0.02 85)",
    input: "oklch(0.25 0.02 85)",
    sidebar: "oklch(0.14 0 0)",
    sidebarForeground: "oklch(0.88 0.05 85)",
    sidebarAccent: "oklch(0.22 0 0)",
    sidebarBorder: "oklch(0.25 0.02 85)",
  },
  ivory: {
    // Clean white & charcoal — Apple-inspired light mode
    background: "oklch(0.97 0.005 90)",
    foreground: "oklch(0.20 0 0)",
    card: "oklch(1 0 0)",
    cardForeground: "oklch(0.20 0 0)",
    popover: "oklch(0.99 0 0)",
    popoverForeground: "oklch(0.20 0 0)",
    secondary: "oklch(0.94 0.005 90)",
    secondaryForeground: "oklch(0.20 0 0)",
    muted: "oklch(0.92 0.005 90)",
    mutedForeground: "oklch(0.45 0 0)",
    border: "oklch(0.87 0.005 90)",
    input: "oklch(0.87 0.005 90)",
    sidebar: "oklch(0.96 0.005 90)",
    sidebarForeground: "oklch(0.20 0 0)",
    sidebarAccent: "oklch(0.93 0.005 90)",
    sidebarBorder: "oklch(0.90 0.005 90)",
  },
  midnight: {
    // Deep navy blue — rich, unmistakable navy workspace
    background: "oklch(0.22 0.08 255)",
    foreground: "oklch(0.93 0.02 240)",
    card: "oklch(0.26 0.09 255)",
    cardForeground: "oklch(0.93 0.02 240)",
    popover: "oklch(0.24 0.08 255)",
    popoverForeground: "oklch(0.93 0.02 240)",
    secondary: "oklch(0.30 0.08 255)",
    secondaryForeground: "oklch(0.93 0.02 240)",
    muted: "oklch(0.32 0.07 255)",
    mutedForeground: "oklch(0.65 0.06 240)",
    border: "oklch(0.38 0.08 255)",
    input: "oklch(0.38 0.08 255)",
    sidebar: "oklch(0.18 0.10 255)",
    sidebarForeground: "oklch(0.93 0.02 240)",
    sidebarAccent: "oklch(0.30 0.08 255)",
    sidebarBorder: "oklch(0.38 0.08 255)",
  },
  emerald: {
    // Deep forest green — rich, unmistakable green workspace
    background: "oklch(0.21 0.06 160)",
    foreground: "oklch(0.93 0.04 155)",
    card: "oklch(0.25 0.07 160)",
    cardForeground: "oklch(0.93 0.04 155)",
    popover: "oklch(0.23 0.06 160)",
    popoverForeground: "oklch(0.93 0.04 155)",
    secondary: "oklch(0.29 0.06 160)",
    secondaryForeground: "oklch(0.93 0.04 155)",
    muted: "oklch(0.31 0.05 160)",
    mutedForeground: "oklch(0.62 0.08 155)",
    border: "oklch(0.37 0.07 160)",
    input: "oklch(0.37 0.07 160)",
    sidebar: "oklch(0.17 0.08 160)",
    sidebarForeground: "oklch(0.93 0.04 155)",
    sidebarAccent: "oklch(0.29 0.06 160)",
    sidebarBorder: "oklch(0.37 0.07 160)",
  },
  slate: {
    // Warm stone/brown — rich, unmistakable warm workspace
    background: "oklch(0.22 0.04 55)",
    foreground: "oklch(0.92 0.04 60)",
    card: "oklch(0.26 0.05 55)",
    cardForeground: "oklch(0.92 0.04 60)",
    popover: "oklch(0.24 0.04 55)",
    popoverForeground: "oklch(0.92 0.04 60)",
    secondary: "oklch(0.30 0.04 55)",
    secondaryForeground: "oklch(0.92 0.04 60)",
    muted: "oklch(0.32 0.04 55)",
    mutedForeground: "oklch(0.62 0.06 55)",
    border: "oklch(0.38 0.05 55)",
    input: "oklch(0.38 0.05 55)",
    sidebar: "oklch(0.18 0.05 55)",
    sidebarForeground: "oklch(0.92 0.04 60)",
    sidebarAccent: "oklch(0.30 0.04 55)",
    sidebarBorder: "oklch(0.38 0.05 55)",
  },
};

// Convert hex accent to OKLCH for CSS variables (approximate)
function hexToOklchAccent(hex: string): { accent: string; accentForeground: string; ring: string; primary: string; primaryForeground: string } {
  // For the accent/primary, we use the hex directly via oklch approximation
  // Since CSS can handle color-mix, we'll use a simpler approach with the hex
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const isLight = l > 0.5;
  
  return {
    accent: hex,
    accentForeground: isLight ? "oklch(0.15 0 0)" : "oklch(0.98 0 0)",
    ring: hex,
    primary: hex,
    primaryForeground: isLight ? "oklch(0.15 0 0)" : "oklch(0.98 0 0)",
  };
}

// ─── Contexts ──────────────────────────────────────────────────────────────
interface SidebarContextType {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}
export const SidebarContext = createContext<SidebarContextType>({ collapsed: false, setCollapsed: () => {} });
export const useSidebar = () => useContext(SidebarContext);

interface OmniContextType {
  omniMode: OmniMode;
  omniState: OmniState;
  setOmniState: (state: OmniState) => void;
  openChat: () => void;
}
export const OmniContext = createContext<OmniContextType>({ omniMode: "sigil", omniState: "relaxed", setOmniState: () => {}, openChat: () => {} });
export const useOmni = () => useContext(OmniContext);

// Design context — lets child pages read the active design preferences
interface DesignContextType {
  theme: string;
  accentColor: string;
  logoUrl: string | null;
  sidebarStyle: string;
  isLightTheme: boolean;
  refetch: () => void;
}
export const DesignContext = createContext<DesignContextType>({ 
  theme: "obsidian", accentColor: "#d4af37", logoUrl: null, sidebarStyle: "default", isLightTheme: false, refetch: () => {} 
});
export const useDesign = () => useContext(DesignContext);

interface PortalLayoutProps {
  children: React.ReactNode;
}

const SIDEBAR_KEY = "omniscope-sidebar-collapsed";
const OMNI_MODE_KEY = "omniscope-omni-mode";
const OMNI_SIDEBAR_KEY = "omniscope-omni-sidebar-visible";

const DEFAULT_LOGO = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663324311854/ydFHlgxGadtyijbJ.png";
const DEFAULT_LOGO_FULL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663324311854/EnEmyoNefHCeqBIl.png";

// ─── Domain Definitions ────────────────────────────────────────────────────
interface DomainItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  matchPaths: string[];
}

const domains: DomainItem[] = [
  { id: "command", icon: LayoutDashboard, label: "Command Center", path: "/", matchPaths: ["/", "/reports/daily", "/reports/weekly"] },
  { id: "intelligence", icon: Radio, label: "Intelligence", path: "/intelligence", matchPaths: ["/intelligence", "/meetings", "/meeting/", "/vault", "/templates", "/pipeline"] },
  { id: "communications", icon: Mail, label: "Communications", path: "/communications", matchPaths: ["/communications", "/mail", "/calendar"] },
  { id: "operations", icon: Target, label: "Operations", path: "/operations", matchPaths: ["/operations", "/tasks"] },
  { id: "relationships", icon: Users, label: "Relationships", path: "/relationships", matchPaths: ["/relationships", "/contacts", "/contact/", "/companies", "/company/"] },
];

function isDomainActive(domain: DomainItem, location: string): boolean {
  return domain.matchPaths.some(p => {
    if (p === "/") return location === "/";
    return location === p || location.startsWith(p);
  });
}

// ─── Accent Color Utility ──────────────────────────────────────────────────
function hexToRgb(hex: string): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r}, ${g}, ${b}`;
  } catch {
    return "212, 175, 55";
  }
}

// ─── CSS Variable Injection ────────────────────────────────────────────────
function useThemeInjection(theme: string, accentColor: string) {
  useEffect(() => {
    const root = document.documentElement;
    const colors = THEME_MAP[theme] || THEME_MAP.obsidian;
    
    // Apply theme colors as CSS variables
    root.style.setProperty("--background", colors.background);
    root.style.setProperty("--foreground", colors.foreground);
    root.style.setProperty("--card", colors.card);
    root.style.setProperty("--card-foreground", colors.cardForeground);
    root.style.setProperty("--popover", colors.popover);
    root.style.setProperty("--popover-foreground", colors.popoverForeground);
    root.style.setProperty("--secondary", colors.secondary);
    root.style.setProperty("--secondary-foreground", colors.secondaryForeground);
    root.style.setProperty("--muted", colors.muted);
    root.style.setProperty("--muted-foreground", colors.mutedForeground);
    root.style.setProperty("--border", colors.border);
    root.style.setProperty("--input", colors.input);
    root.style.setProperty("--sidebar", colors.sidebar);
    root.style.setProperty("--sidebar-foreground", colors.sidebarForeground);
    root.style.setProperty("--sidebar-accent", colors.sidebarAccent);
    root.style.setProperty("--sidebar-accent-foreground", colors.sidebarForeground);
    root.style.setProperty("--sidebar-border", colors.sidebarBorder);
    root.style.setProperty("--sidebar-ring", accentColor);
    
    // Apply accent color
    const accentOklch = hexToOklchAccent(accentColor);
    // For accent, we use the hex directly since CSS can handle it
    root.style.setProperty("--accent", colors.muted); // keep accent bg neutral
    root.style.setProperty("--accent-foreground", colors.foreground);
    root.style.setProperty("--ring", accentColor);
    
    // Primary = accent color
    root.style.setProperty("--primary", accentColor);
    root.style.setProperty("--primary-foreground", accentOklch.primaryForeground);
    root.style.setProperty("--sidebar-primary", accentColor);
    root.style.setProperty("--sidebar-primary-foreground", accentOklch.primaryForeground);
    
    // Chart colors based on accent
    root.style.setProperty("--chart-1", accentColor);
    
    // ─── Override Tailwind 4 palette variables ─────────────────────────
    // This makes hardcoded classes like bg-zinc-800, text-zinc-400, etc.
    // respond to theme changes without modifying individual components.
    const isLight = theme === "ivory";
    
    // Zinc palette → theme-aware (most commonly used in components)
    // For dark themes: zinc-950=darkest bg, zinc-50=lightest text (normal)
    // For light themes: zinc-950=lightest bg, zinc-50=darkest text (INVERTED)
    root.style.setProperty("--color-zinc-950", colors.background);
    root.style.setProperty("--color-zinc-900", colors.card);
    root.style.setProperty("--color-zinc-800", colors.secondary);
    root.style.setProperty("--color-zinc-700", isLight ? "oklch(0.78 0.005 90)" : colors.border);
    root.style.setProperty("--color-zinc-600", isLight ? "oklch(0.55 0 0)" : colors.mutedForeground);
    root.style.setProperty("--color-zinc-500", isLight ? "oklch(0.48 0 0)" : colors.mutedForeground);
    root.style.setProperty("--color-zinc-400", isLight ? "oklch(0.40 0 0)" : colors.mutedForeground);
    root.style.setProperty("--color-zinc-300", isLight ? "oklch(0.35 0 0)" : colors.mutedForeground);
    root.style.setProperty("--color-zinc-200", isLight ? "oklch(0.28 0 0)" : colors.foreground);
    root.style.setProperty("--color-zinc-100", isLight ? "oklch(0.22 0 0)" : colors.foreground);
    root.style.setProperty("--color-zinc-50",  isLight ? "oklch(0.18 0 0)" : colors.foreground);
    
    // Gray palette (used in some components) — same inversion logic
    root.style.setProperty("--color-gray-950", colors.background);
    root.style.setProperty("--color-gray-900", colors.card);
    root.style.setProperty("--color-gray-800", colors.secondary);
    root.style.setProperty("--color-gray-700", isLight ? "oklch(0.78 0.005 90)" : colors.border);
    root.style.setProperty("--color-gray-600", isLight ? "oklch(0.55 0 0)" : colors.mutedForeground);
    root.style.setProperty("--color-gray-500", isLight ? "oklch(0.48 0 0)" : colors.mutedForeground);
    root.style.setProperty("--color-gray-400", isLight ? "oklch(0.40 0 0)" : colors.mutedForeground);
    root.style.setProperty("--color-gray-300", isLight ? "oklch(0.35 0 0)" : colors.mutedForeground);
    root.style.setProperty("--color-gray-200", isLight ? "oklch(0.28 0 0)" : colors.foreground);
    root.style.setProperty("--color-gray-100", isLight ? "oklch(0.22 0 0)" : colors.foreground);
    root.style.setProperty("--color-gray-50",  isLight ? "oklch(0.18 0 0)" : colors.foreground);
    
    // Neutral palette
    root.style.setProperty("--color-neutral-950", colors.background);
    root.style.setProperty("--color-neutral-900", colors.card);
    root.style.setProperty("--color-neutral-800", colors.secondary);
    root.style.setProperty("--color-neutral-700", isLight ? "oklch(0.78 0 0)" : colors.border);
    root.style.setProperty("--color-neutral-400", isLight ? "oklch(0.40 0 0)" : colors.mutedForeground);
    root.style.setProperty("--color-neutral-50",  isLight ? "oklch(0.18 0 0)" : colors.foreground);
    
    // Stone palette
    root.style.setProperty("--color-stone-950", colors.background);
    root.style.setProperty("--color-stone-900", colors.card);
    root.style.setProperty("--color-stone-800", colors.secondary);
    root.style.setProperty("--color-stone-700", isLight ? "oklch(0.78 0 0)" : colors.border);
    root.style.setProperty("--color-stone-400", isLight ? "oklch(0.40 0 0)" : colors.mutedForeground);
    root.style.setProperty("--color-stone-50",  isLight ? "oklch(0.18 0 0)" : colors.foreground);
    
    // Slate palette
    root.style.setProperty("--color-slate-950", colors.background);
    root.style.setProperty("--color-slate-900", colors.card);
    root.style.setProperty("--color-slate-800", colors.secondary);
    root.style.setProperty("--color-slate-700", isLight ? "oklch(0.78 0 0)" : colors.border);
    root.style.setProperty("--color-slate-400", isLight ? "oklch(0.40 0 0)" : colors.mutedForeground);
    root.style.setProperty("--color-slate-50",  isLight ? "oklch(0.18 0 0)" : colors.foreground);
    
    // Yellow/Amber → follow the primary/accent color
    // For light mode, darken the accent for better contrast
    root.style.setProperty("--color-yellow-600", isLight ? "oklch(0.55 0.16 85)" : accentColor);
    root.style.setProperty("--color-yellow-500", isLight ? "oklch(0.60 0.16 85)" : accentColor);
    root.style.setProperty("--color-yellow-400", accentColor);
    root.style.setProperty("--color-yellow-300", accentColor);
    root.style.setProperty("--color-amber-600", isLight ? "oklch(0.55 0.16 85)" : accentColor);
    root.style.setProperty("--color-amber-500", isLight ? "oklch(0.60 0.16 85)" : accentColor);
    root.style.setProperty("--color-amber-400", accentColor);
    root.style.setProperty("--color-amber-300", accentColor);
    
    // Emerald/green for status badges
    if (isLight) {
      root.style.setProperty("--color-emerald-600", "oklch(0.52 0.14 155)");
      root.style.setProperty("--color-emerald-500", "oklch(0.58 0.14 155)");
      root.style.setProperty("--color-red-600", "oklch(0.52 0.20 25)");
      root.style.setProperty("--color-red-500", "oklch(0.58 0.20 25)");
    }
    
    // For light mode, override white/black where used as text/bg to ensure contrast
    // text-white on light bg = invisible, so remap to dark
    // bg-black on light = too harsh, so remap to near-black
    if (isLight) {
      root.style.setProperty("--color-white", "oklch(0.15 0 0)"); // text-white → dark
      root.style.setProperty("--color-black", "oklch(0.97 0.005 90)"); // bg-black → light bg
    } else {
      // Reset to defaults for dark themes
      root.style.removeProperty("--color-white");
      root.style.removeProperty("--color-black");
    }
    
    return () => {
      // No cleanup needed — next theme switch will override
    };
  }, [theme, accentColor]);
}

// ─── Main Layout ───────────────────────────────────────────────────────────
export default function PortalLayout({ children }: PortalLayoutProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();
  const logoutMutation = trpc.auth.logout.useMutation();
  
  // Design preferences
  const designQuery = trpc.design.get.useQuery(undefined, { enabled: isAuthenticated });
  const designPrefs = designQuery.data;
  const activeTheme = designPrefs?.theme || "obsidian";
  const accentColor = designPrefs?.accentColor || "#d4af37";
  const customLogo = designPrefs?.logoUrl || null;
  const sidebarStyle = designPrefs?.sidebarStyle || "default";
  const isLightTheme = activeTheme === "ivory";
  const accentRgb = useMemo(() => hexToRgb(accentColor), [accentColor]);

  // Inject CSS variables for the active theme
  useThemeInjection(activeTheme, accentColor);

  // Sidebar width based on sidebarStyle preference
  const [collapsed, setCollapsedState] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === "true"; } catch { return false; }
  });
  const setCollapsed = (v: boolean) => {
    setCollapsedState(v);
    try { localStorage.setItem(SIDEBAR_KEY, String(v)); } catch {};
  };

  // Sidebar dimensions based on style
  const sidebarWidthPx = useMemo(() => {
    if (collapsed) return 72;
    if (sidebarStyle === "compact") return 220;
    if (sidebarStyle === "minimal") return 200;
    return 260; // default
  }, [collapsed, sidebarStyle]);
  
  const sidebarWidth = `w-[${sidebarWidthPx}px]`;
  const mainMargin = `ml-[${sidebarWidthPx}px]`;

  // Omni state
  const [omniChatOpen, setOmniChatOpen] = useState(false);
  const [omniMode, setOmniMode] = useState<OmniMode>(() => {
    try { return (localStorage.getItem(OMNI_MODE_KEY) as OmniMode) || "3d-character"; } catch { return "3d-character"; }
  });
  const [omniSidebarVisible, setOmniSidebarVisible] = useState(() => {
    try { return localStorage.getItem(OMNI_SIDEBAR_KEY) !== "false"; } catch { return true; }
  });

  // Omni emotional state — default to relaxed (happy), child pages can override
  const [omniState, setOmniState] = useState<OmniState>("relaxed");

  // Hover state for sidebar items
  const [hoveredDomain, setHoveredDomain] = useState<string | null>(null);

  // Persist Omni preferences
  useEffect(() => { try { localStorage.setItem(OMNI_MODE_KEY, omniMode); } catch {} }, [omniMode]);
  useEffect(() => { try { localStorage.setItem(OMNI_SIDEBAR_KEY, String(omniSidebarVisible)); } catch {} }, [omniSidebarVisible]);

  // Listen for settings changes
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === OMNI_MODE_KEY && e.newValue) setOmniMode(e.newValue as OmniMode);
      if (e.key === OMNI_SIDEBAR_KEY && e.newValue) setOmniSidebarVisible(e.newValue === "true");
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // ⌘K keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOmniChatOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      toast.success("Logged out successfully");
      window.location.href = getLoginUrl();
    } catch { toast.error("Failed to logout"); }
  };

  // Auto-provision account for authenticated users who don't have one yet
  const { isProvisioned, provision, isLoading: orgLoading, switchOrg } = useOrg();
  const provisioningRef = useRef(false);
  useEffect(() => {
    if (isAuthenticated && user && !orgLoading && !isProvisioned && !provisioningRef.current) {
      provisioningRef.current = true;
      provision().catch(() => {}).finally(() => { provisioningRef.current = false; });
    }
  }, [isAuthenticated, user, orgLoading, isProvisioned, provision]);

  // Redirect first-time users to onboarding
  useEffect(() => {
    if (isAuthenticated && user && !user.onboardingCompleted && location !== '/onboarding') {
      setLocation('/onboarding');
    }
  }, [isAuthenticated, user, location]);

  // Theme-aware colors for the sidebar — derived from THEME_MAP so each
  // theme (Midnight navy, Emerald green, Slate brown, etc.) is reflected
  const themeColors = THEME_MAP[activeTheme] || THEME_MAP.obsidian;
  const sidebarBg = `var(--sidebar, ${themeColors.sidebar})`;
  const sidebarBorderColor = `var(--sidebar-border, ${themeColors.sidebarBorder})`;
  const textPrimary = `var(--sidebar-foreground, ${themeColors.sidebarForeground})`;
  const textSecondary = isLightTheme ? 'oklch(0.45 0 0)' : 'oklch(0.60 0.02 0)';
  const textMuted = isLightTheme ? 'oklch(0.55 0 0)' : 'oklch(0.50 0.02 0)';
  const textHover = `var(--sidebar-foreground, ${themeColors.sidebarForeground})`;
  const hoverBg = `var(--sidebar-accent, ${themeColors.sidebarAccent})`;
  const activeBg = `color-mix(in oklch, ${accentColor} 12%, transparent)`;
  const dividerColor = `var(--sidebar-border, ${themeColors.sidebarBorder})`;
  const collapseBtnBg = `var(--sidebar, ${themeColors.sidebar})`;

  const refetchDesign = useCallback(() => designQuery.refetch(), [designQuery]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: `var(--background, ${themeColors.background})` }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: accentColor }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: `var(--background, ${themeColors.background})` }}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(to right, rgba(${accentRgb}, 0.1) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(${accentRgb}, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px'
          }} />
          <div className="absolute top-0 left-0 right-0 h-96" style={{ background: `linear-gradient(to bottom, rgba(${accentRgb}, 0.06), transparent)` }} />
          <div className="absolute bottom-0 left-0 right-0 h-96" style={{ background: `linear-gradient(to top, rgba(${accentRgb}, 0.06), transparent)` }} />
        </div>
        <div className="text-center relative z-10">
          <img src={customLogo || DEFAULT_LOGO_FULL} alt="OmniScope" className="h-48 mx-auto mb-12" />
          <h1 className="text-3xl font-bold mb-3" style={{ color: `var(--foreground, ${themeColors.foreground})` }}>Intelligence Portal</h1>
          <p className="mb-10 text-lg" style={{ color: `var(--muted-foreground, ${themeColors.mutedForeground})` }}>Secure access required</p>
          <Button
            onClick={() => window.location.href = getLoginUrl()}
            className="font-medium px-8 py-6 text-lg"
            style={{ backgroundColor: accentColor, color: isLightTheme ? '#fff' : '#000' }}
          >
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';
  const isPlatformOwner = (user as any)?.platformOwner === true;
  const profilePhoto = (user as any)?.profilePhotoUrl;
  const isMinimal = sidebarStyle === "minimal";
  const isCompact = sidebarStyle === "compact";

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
    <OmniContext.Provider value={{ omniMode, omniState, setOmniState, openChat: () => setOmniChatOpen(true) }}>
    <DesignContext.Provider value={{ 
      theme: activeTheme, 
      accentColor, 
      logoUrl: customLogo, 
      sidebarStyle,
      isLightTheme,
      refetch: refetchDesign,
    }}>
      <div className="min-h-screen flex" style={{ background: `var(--background, ${themeColors.background})` }}>
        {/* ─── Sidebar ─── */}
        <div 
          className="flex flex-col fixed left-0 top-0 h-screen transition-all duration-300 ease-in-out z-50"
          style={{
            width: `${sidebarWidthPx}px`,
            background: sidebarBg,
            borderRight: `1px solid ${sidebarBorderColor}`,
          }}
        >
          {/* ─── Logo Section ─── */}
          <div 
            className="relative flex items-center justify-center shrink-0"
            style={{ 
              padding: collapsed ? '16px 8px' : isMinimal ? '14px 14px' : '20px 20px',
              borderBottom: `1px solid ${dividerColor}`,
            }}
          >
            {collapsed ? (
              <div className="relative">
                <img 
                  src={customLogo || DEFAULT_LOGO} 
                  alt="OmniScope" 
                  className="w-10 h-10 object-contain transition-transform duration-300 hover:scale-105"
                />
                <div 
                  className="absolute inset-0 rounded-full blur-lg opacity-20 -z-10"
                  style={{ backgroundColor: accentColor }}
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 w-full">
                <img 
                  src={customLogo || DEFAULT_LOGO} 
                  alt="OmniScope" 
                  className="w-full object-contain transition-transform duration-300"
                  style={{ maxWidth: isMinimal ? '120px' : isCompact ? '140px' : '160px', height: 'auto' }}
                />
              </div>
            )}
            
            {/* Collapse Toggle */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full flex items-center justify-center transition-all duration-200 z-10 hover:scale-110"
              style={{
                background: collapseBtnBg,
                border: `1px solid rgba(${accentRgb}, 0.2)`,
                color: textSecondary,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `rgba(${accentRgb}, 0.5)`;
                e.currentTarget.style.color = accentColor;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = `rgba(${accentRgb}, 0.2)`;
                e.currentTarget.style.color = textSecondary;
              }}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
            </button>
          </div>

          {/* ─── Org Switcher ─── */}
          <OrgSwitcher
            collapsed={collapsed}
            accentColor={accentColor}
            accentRgb={accentRgb}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            textMuted={textMuted}
            hoverBg={hoverBg}
            dividerColor={dividerColor}
            isLightTheme={isLightTheme}
            sidebarBg={sidebarBg}
            onCreateOrg={() => setLocation('/org/new')}
            onViewAllOrgs={() => { switchOrg(null); setLocation('/admin-hub'); }}
          />

          {/* ─── Navigation ─── */}
          <nav className={`flex-1 overflow-y-auto px-2 ${isMinimal ? 'py-2 space-y-0' : 'py-3 space-y-0.5'}`}>
            {/* Section Label */}
            {!collapsed && !isMinimal && (
              <div className="px-3 pb-2">
                <span className="text-[10px] font-semibold tracking-[0.2em] uppercase" style={{ color: textMuted }}>
                  Workspace
                </span>
              </div>
            )}

            {/* Domain Items */}
            {domains.map((domain) => {
              const Icon = domain.icon;
              const active = isDomainActive(domain, location);
              const hovered = hoveredDomain === domain.id;
              const itemPy = isMinimal ? 'py-2' : isCompact ? 'py-2' : 'py-2.5';
              const itemPx = collapsed ? 'px-2' : isMinimal ? 'px-2.5' : 'px-3';
              
              return (
                <Link key={domain.id} href={domain.path}>
                  <button
                    className={`w-full flex items-center ${collapsed ? 'justify-center' : ''} gap-3 ${itemPx} ${itemPy} rounded-xl transition-all duration-200 group relative`}
                    style={{
                      background: active ? activeBg : hovered ? hoverBg : 'transparent',
                      color: active ? accentColor : hovered ? textPrimary : textSecondary,
                    }}
                    onMouseEnter={() => setHoveredDomain(domain.id)}
                    onMouseLeave={() => setHoveredDomain(null)}
                    title={collapsed ? domain.label : undefined}
                  >
                    {/* Active indicator */}
                    {active && (
                      <div 
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-5 rounded-r-full transition-all duration-300"
                        style={{ backgroundColor: accentColor }}
                      />
                    )}
                    <Icon 
                      className="h-[18px] w-[18px] shrink-0 transition-all duration-200" 
                      style={{ 
                        color: active ? accentColor : hovered ? textHover : textMuted,
                      }}
                    />
                    {!collapsed && (
                      <span className={`${isMinimal ? 'text-xs' : 'text-[13px]'} truncate transition-all duration-200 ${active ? 'font-medium' : ''}`}>
                        {domain.label}
                      </span>
                    )}
                  </button>
                </Link>
              );
            })}

            {/* Divider */}
            <div className={`${isMinimal ? '!my-2' : '!my-3'} mx-3`} style={{ borderTop: `1px solid ${dividerColor}` }} />

            {/* Ask Omni */}
            {omniSidebarVisible && (
              <>
                {!collapsed && !isMinimal && (
                  <div className="px-3 pb-2">
                    <span className="text-[10px] font-semibold tracking-[0.2em] uppercase" style={{ color: textMuted }}>
                      Tools
                    </span>
                  </div>
                )}

                <button
                  onClick={() => setOmniChatOpen(true)}
                  className={`w-full flex items-center ${collapsed ? 'justify-center' : ''} gap-3 ${collapsed ? 'px-2 py-2.5' : isMinimal ? 'px-2.5 py-2' : 'px-3 py-2.5'} rounded-xl transition-all duration-200 group relative`}
                  style={{ color: textSecondary }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `rgba(${accentRgb}, 0.06)`;
                    e.currentTarget.style.color = accentColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = textSecondary;
                  }}
                  title={collapsed ? "Ask Omni (⌘K)" : undefined}
                >
                  <Sparkles className="h-[18px] w-[18px] shrink-0 transition-colors duration-200" />
                  {!collapsed && (
                    <>
                      <span className={`${isMinimal ? 'text-xs' : 'text-[13px]'} truncate flex-1 text-left`}>Ask Omni</span>
                      {!isMinimal && (
                        <kbd 
                          className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                          style={{ 
                            background: isLightTheme ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)', 
                            border: `1px solid ${isLightTheme ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)'}`,
                            color: textMuted,
                          }}
                        >
                          ⌘K
                        </kbd>
                      )}
                    </>
                  )}
                </button>
              </>
            )}
          </nav>

          {/* ─── Footer: Settings + HR + Admin ─── */}
          <div className="px-2 pb-2 space-y-0.5">
            <div className="mx-2 mb-2" style={{ borderTop: `1px solid ${dividerColor}` }} />

            {[
              { path: "/setup", icon: Settings, label: "Settings" },
              { path: "/hr", icon: UserCog, label: "HR Hub" },
              { path: "/account", icon: Briefcase, label: "Account" },
              ...(isAdmin ? [{ path: "/admin", icon: Shield, label: "Admin" }] : []),
              ...(isPlatformOwner ? [{ path: "/admin-hub", icon: Crown, label: "Platform", onClick: () => { switchOrg(null); setLocation('/admin-hub'); } }] : []),
            ].map((item: any) => {
              const Icon = item.icon;
              const active = location === item.path || location.startsWith(item.path + '/') || location.startsWith(item.path + '?');
              if (item.onClick) {
                return (
                  <button
                    key={item.path}
                    onClick={item.onClick}
                    className={`w-full flex items-center ${collapsed ? 'justify-center' : ''} gap-3 ${collapsed ? 'px-2 py-2' : isMinimal ? 'px-2.5 py-1.5' : 'px-3 py-2'} rounded-xl transition-all duration-200 group relative`}
                    style={{
                      background: active ? activeBg : 'transparent',
                      color: active ? accentColor : textSecondary,
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = hoverBg;
                        e.currentTarget.style.color = textHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = textSecondary;
                      }
                    }}
                    title={collapsed ? item.label : undefined}
                  >
                    {active && (
                      <div 
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-4 rounded-r-full"
                        style={{ backgroundColor: accentColor }}
                      />
                    )}
                    <Icon className="h-4 w-4 shrink-0 transition-colors duration-200" />
                    {!collapsed && <span className={`${isMinimal ? 'text-[11px]' : 'text-xs'} truncate`}>{item.label}</span>}
                  </button>
                );
              }
              return (
                <Link key={item.path} href={item.path}>
                  <button
                    className={`w-full flex items-center ${collapsed ? 'justify-center' : ''} gap-3 ${collapsed ? 'px-2 py-2' : isMinimal ? 'px-2.5 py-1.5' : 'px-3 py-2'} rounded-xl transition-all duration-200 group relative`}
                    style={{
                      background: active ? activeBg : 'transparent',
                      color: active ? accentColor : textSecondary,
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = hoverBg;
                        e.currentTarget.style.color = textHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = textSecondary;
                      }
                    }}
                    title={collapsed ? item.label : undefined}
                  >
                    {active && (
                      <div 
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-4 rounded-r-full"
                        style={{ backgroundColor: accentColor }}
                      />
                    )}
                    <Icon className="h-4 w-4 shrink-0 transition-colors duration-200" />
                    {!collapsed && <span className={`${isMinimal ? 'text-[11px]' : 'text-xs'} truncate`}>{item.label}</span>}
                  </button>
                </Link>
              );
            })}
          </div>

          {/* ─── User Section ─── */}
          <div 
            className={`${isMinimal ? 'p-2' : 'p-3'} shrink-0`}
            style={{ borderTop: `1px solid ${dividerColor}` }}
          >
            {collapsed ? (
              <div className="flex flex-col items-center gap-2">
                {profilePhoto ? (
                  <img 
                    src={profilePhoto} 
                    alt={user?.name || "User"} 
                    className="h-8 w-8 rounded-full object-cover ring-2"
                    style={{ ringColor: `rgba(${accentRgb}, 0.3)` }}
                  />
                ) : (
                  <div 
                    className="h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs"
                    style={{ backgroundColor: accentColor, color: isLightTheme ? '#fff' : '#000' }}
                    title={user?.name || "User"}
                  >
                    {user?.name?.charAt(0).toUpperCase() || "U"}
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="transition-colors p-1 rounded-md"
                  style={{ color: textMuted }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = textPrimary; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = textMuted; }}
                  title="Sign Out"
                  disabled={logoutMutation.isPending}
                >
                  {logoutMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <LogOut className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                {profilePhoto ? (
                  <img 
                    src={profilePhoto} 
                    alt={user?.name || "User"} 
                    className="h-9 w-9 rounded-full object-cover shrink-0 ring-2"
                    style={{ ringColor: `rgba(${accentRgb}, 0.2)` }}
                  />
                ) : (
                  <div 
                    className="h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0"
                    style={{ backgroundColor: accentColor, color: isLightTheme ? '#fff' : '#000' }}
                  >
                    {user?.name?.charAt(0).toUpperCase() || "U"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className={`${isMinimal ? 'text-xs' : 'text-[13px]'} font-medium truncate`} style={{ color: textPrimary }}>
                    {user?.name || "User"}
                  </p>
                  <p className="text-[10px] truncate" style={{ color: textSecondary }}>{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-lg transition-all duration-200"
                  style={{ color: textMuted }}
                  onMouseEnter={(e) => { 
                    e.currentTarget.style.color = textPrimary; 
                    e.currentTarget.style.background = hoverBg;
                  }}
                  onMouseLeave={(e) => { 
                    e.currentTarget.style.color = textMuted; 
                    e.currentTarget.style.background = 'transparent';
                  }}
                  title="Sign Out"
                  disabled={logoutMutation.isPending}
                >
                  {logoutMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <LogOut className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ─── Main Content ─── */}
        <main 
          className="flex-1 overflow-auto transition-all duration-300 ease-in-out"
          style={{ marginLeft: `${sidebarWidthPx}px` }}
        >
          {children}
        </main>

        {/* Floating Omni Avatar */}
        {omniMode !== "hidden" && !omniChatOpen && location !== "/" && (
          <div className="fixed bottom-6 right-6 z-[80]">
            <OmniAvatar
              mode={omniMode}
              state={omniState}
              size={56}
              onClick={() => setOmniChatOpen(true)}
              badge={false}
              theme={activeTheme}
            />
          </div>
        )}

        {/* Omni Chat Panel */}
        <OmniChatPanel
          open={omniChatOpen}
          onClose={() => setOmniChatOpen(false)}
          omniMode={omniMode === "hidden" ? "sigil" : omniMode}
          currentPage={location}
        />
      </div>
    </DesignContext.Provider>
    </OmniContext.Provider>
    </SidebarContext.Provider>
  );
}

// Export Omni settings for use in Settings page
export type { OmniMode };
export { OMNI_MODE_KEY, OMNI_SIDEBAR_KEY };
