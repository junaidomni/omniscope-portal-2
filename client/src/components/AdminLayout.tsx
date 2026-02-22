/**
 * AdminLayout — The Super Admin Organization Hub shell.
 * This is a parallel layout to PortalLayout, activated when the user
 * selects "All Organizations" from the org switcher. It provides a
 * completely separate navigation structure for platform-level management.
 *
 * Design: Apple/Tesla philosophy — minimal, precise, generous whitespace,
 * confident typography, platinum accents to distinguish from workspace mode.
 */
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Building2,
  Users,
  Plug,
  ToggleLeft,
  ScrollText,
  Shield,
  BarChart3,
  Settings,
  Activity,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Loader2,
  Sparkles,
  ArrowLeft,
  Wallet,
  TrendingUp,
  Crown,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState, useEffect, useMemo, useCallback, createContext, useContext } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useOrg } from "@/contexts/OrgContext";
import OrgSwitcher from "./OrgSwitcher";
import { DesignContext, useDesign } from "./PortalLayout";

// ─── Constants ────────────────────────────────────────────────────────────
const DEFAULT_LOGO = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663324311854/ydFHlgxGadtyijbJ.png";
const ADMIN_SIDEBAR_KEY = "omniscope-admin-sidebar-collapsed";

// ─── Admin Navigation Structure ───────────────────────────────────────────
interface AdminNavItem {
  id: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  path: string;
  matchPaths: string[];
}

interface AdminNavSection {
  label: string;
  items: AdminNavItem[];
}

const adminSections: AdminNavSection[] = [
  {
    label: "Overview",
    items: [
      { id: "dashboard", icon: LayoutDashboard, label: "Dashboard", path: "/admin-hub", matchPaths: ["/admin-hub"] },
      { id: "organizations", icon: Building2, label: "Organizations", path: "/admin-hub/organizations", matchPaths: ["/admin-hub/organizations"] },
      { id: "accounts", icon: Wallet, label: "Accounts", path: "/admin-hub/accounts", matchPaths: ["/admin-hub/accounts", "/admin-hub/account"] },
    ],
  },
  {
    label: "People",
    items: [
      { id: "people", icon: Users, label: "Team Members", path: "/admin-hub/people", matchPaths: ["/admin-hub/people"] },
      { id: "roles", icon: Shield, label: "Roles & Permissions", path: "/admin-hub/roles", matchPaths: ["/admin-hub/roles"] },
    ],
  },
  {
    label: "Platform",
    items: [
      { id: "integrations", icon: Plug, label: "Integrations & API Keys", path: "/admin-hub/integrations", matchPaths: ["/admin-hub/integrations"] },
      { id: "features", icon: ToggleLeft, label: "Feature Flags", path: "/admin-hub/features", matchPaths: ["/admin-hub/features"] },
    ],
  },
  {
    label: "Billing",
    items: [
      { id: "billing", icon: CreditCard, label: "Plans & Billing", path: "/admin-hub/billing", matchPaths: ["/admin-hub/billing"] },
      { id: "revenue", icon: TrendingUp, label: "Revenue", path: "/admin-hub/revenue", matchPaths: ["/admin-hub/revenue"] },
    ],
  },
  {
    label: "Governance",
    items: [
      { id: "super-admins", icon: Crown, label: "Super-Admins", path: "/admin-hub/super-admins", matchPaths: ["/admin-hub/super-admins"] },
      { id: "audit", icon: ScrollText, label: "Audit Log", path: "/admin-hub/audit", matchPaths: ["/admin-hub/audit"] },
    ],
  },
  {
    label: "Insights",
    items: [
      { id: "analytics", icon: BarChart3, label: "Analytics", path: "/admin-hub/analytics", matchPaths: ["/admin-hub/analytics"] },
      { id: "health", icon: Activity, label: "Platform Health", path: "/admin-hub/health", matchPaths: ["/admin-hub/health"] },
    ],
  },
];

function isNavItemActive(item: AdminNavItem, location: string): boolean {
  return item.matchPaths.some((p) => {
    if (p === "/admin-hub") return location === "/admin-hub";
    return location === p || location.startsWith(p + "/");
  });
}

// ─── Accent Color Utility ─────────────────────────────────────────────────
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

// ─── AdminLayout Props ────────────────────────────────────────────────────
interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();
  const logoutMutation = trpc.auth.logout.useMutation();
  const { switchOrg, memberships } = useOrg();

  // Design preferences — shared with PortalLayout
  const designQuery = trpc.design.get.useQuery(undefined, { enabled: isAuthenticated });
  const designPrefs = designQuery.data;
  const activeTheme = designPrefs?.theme || "obsidian";
  const accentColor = designPrefs?.accentColor || "#d4af37";
  const customLogo = designPrefs?.logoUrl || null;
  const isLightTheme = activeTheme === "ivory";
  const accentRgb = useMemo(() => hexToRgb(accentColor), [accentColor]);

  // Sidebar collapse state
  const [collapsed, setCollapsedState] = useState(() => {
    try { return localStorage.getItem(ADMIN_SIDEBAR_KEY) === "true"; } catch { return false; }
  });
  const setCollapsed = (v: boolean) => {
    setCollapsedState(v);
    try { localStorage.setItem(ADMIN_SIDEBAR_KEY, String(v)); } catch {}
  };

  const sidebarWidthPx = collapsed ? 72 : 260;

  // Hover state
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      toast.success("Logged out successfully");
      window.location.href = getLoginUrl();
    } catch { toast.error("Failed to logout"); }
  };

  const handleBackToWorkspace = () => {
    // Switch to the first org (or default) and navigate to workspace
    const defaultMembership = memberships.find((m) => m.isDefault) || memberships[0];
    if (defaultMembership) {
      switchOrg(defaultMembership.org.id);
      // Use window.location to ensure full route change out of admin-hub
      window.location.href = "/";
    } else {
      window.location.href = "/";
    }
  };

  // ─── Theme-aware colors ─────────────────────────────────────────────────
  // Admin hub uses a slightly elevated palette — platinum/silver tints
  const sidebarBg = isLightTheme ? "oklch(0.97 0 0)" : "oklch(0.11 0 0)";
  const sidebarBorderColor = isLightTheme ? "oklch(0.90 0 0)" : "oklch(0.20 0.01 85)";
  const textPrimary = isLightTheme ? "oklch(0.15 0 0)" : "oklch(0.92 0.02 85)";
  const textSecondary = isLightTheme ? "oklch(0.45 0 0)" : "oklch(0.62 0.02 0)";
  const textMuted = isLightTheme ? "oklch(0.55 0 0)" : "oklch(0.48 0.01 0)";
  const textHover = isLightTheme ? "oklch(0.15 0 0)" : "oklch(0.90 0.02 85)";
  const hoverBg = isLightTheme ? "oklch(0.94 0 0)" : "oklch(0.16 0 0)";
  const activeBg = `color-mix(in oklch, ${accentColor} 12%, transparent)`;
  const dividerColor = isLightTheme ? "oklch(0.90 0 0)" : "oklch(0.20 0.01 85)";
  const mainBg = isLightTheme ? "oklch(0.96 0 0)" : "oklch(0.10 0 0)";

  const profilePhoto = (user as any)?.profilePhotoUrl;
  const isAdmin = user?.role === "admin";

  const refetchDesign = useCallback(() => designQuery.refetch(), [designQuery]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: mainBg }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: accentColor }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  return (
    <DesignContext.Provider value={{
      theme: activeTheme,
      accentColor,
      logoUrl: customLogo,
      sidebarStyle: "default",
      isLightTheme,
      refetch: refetchDesign,
    }}>
    <div className="min-h-screen flex" style={{ background: mainBg }}>
      {/* ─── Admin Sidebar ─── */}
      <div
        className="flex flex-col fixed left-0 top-0 h-screen transition-all duration-300 ease-in-out z-50"
        style={{
          width: `${sidebarWidthPx}px`,
          background: sidebarBg,
          borderRight: `1px solid ${sidebarBorderColor}`,
        }}
      >
        {/* ─── Logo + Admin Badge ─── */}
        <div
          className="relative flex items-center justify-center shrink-0"
          style={{
            padding: collapsed ? "16px 8px" : "20px 20px",
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
                className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                  border: `1.5px solid ${sidebarBg}`,
                }}
              >
                <Shield className="h-2 w-2" style={{ color: isLightTheme ? "#fff" : "#000" }} />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 w-full">
              <img
                src={customLogo || DEFAULT_LOGO}
                alt="OmniScope"
                className="object-contain transition-transform duration-300"
                style={{ maxWidth: "160px", height: "auto" }}
              />
            </div>
          )}

          {/* Collapse Toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full flex items-center justify-center transition-all duration-200 z-10 hover:scale-110"
            style={{
              background: sidebarBg,
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
          onCreateOrg={() => setLocation("/org/new")}
          onViewAllOrgs={() => setLocation("/admin-hub")}
          onSwitchToOrg={() => { setLocation("/"); }}
        />
        <div style={{ borderBottom: `1px solid ${dividerColor}` }} />

        {/* ─── Navigation ─── */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {adminSections.map((section, sIdx) => (
            <div key={section.label}>
              {/* Section Label */}
              {!collapsed && (
                <div className={`px-3 ${sIdx === 0 ? "pb-2" : "pt-4 pb-2"}`}>
                  <span
                    className="text-[10px] font-semibold tracking-[0.2em] uppercase"
                    style={{ color: textMuted }}
                  >
                    {section.label}
                  </span>
                </div>
              )}
              {collapsed && sIdx > 0 && (
                <div className="mx-2 my-2" style={{ borderTop: `1px solid ${dividerColor}` }} />
              )}

              {/* Nav Items */}
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isNavItemActive(item, location);
                const hovered = hoveredItem === item.id;

                return (
                  <Link key={item.id} href={item.path}>
                    <button
                      className={`w-full flex items-center ${collapsed ? "justify-center" : ""} gap-3 ${collapsed ? "px-2" : "px-3"} py-2.5 rounded-xl transition-all duration-200 group relative`}
                      style={{
                        background: active ? activeBg : hovered ? hoverBg : "transparent",
                        color: active ? accentColor : hovered ? textPrimary : textSecondary,
                      }}
                      onMouseEnter={() => setHoveredItem(item.id)}
                      onMouseLeave={() => setHoveredItem(null)}
                      title={collapsed ? item.label : undefined}
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
                        <span
                          className={`text-[13px] truncate transition-all duration-200 ${active ? "font-medium" : ""}`}
                        >
                          {item.label}
                        </span>
                      )}
                    </button>
                  </Link>
                );
              })}
            </div>
          ))}

          {/* Divider before tools */}
          <div className="mx-3 !my-3" style={{ borderTop: `1px solid ${dividerColor}` }} />

          {/* Back to Workspace */}
          <button
            onClick={handleBackToWorkspace}
            className={`w-full flex items-center ${collapsed ? "justify-center" : ""} gap-3 ${collapsed ? "px-2" : "px-3"} py-2.5 rounded-xl transition-all duration-200`}
            style={{ color: textSecondary }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = hoverBg;
              e.currentTarget.style.color = accentColor;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = textSecondary;
            }}
            title={collapsed ? "Back to Workspace" : undefined}
          >
            <ArrowLeft className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span className="text-[13px]">Back to Workspace</span>}
          </button>
        </nav>

        {/* ─── Footer: Platform Settings ─── */}
        <div className="px-2 pb-2 space-y-0.5">
          <div className="mx-2 mb-2" style={{ borderTop: `1px solid ${dividerColor}` }} />
          <Link href="/admin-hub/settings">
            <button
              className={`w-full flex items-center ${collapsed ? "justify-center" : ""} gap-3 ${collapsed ? "px-2 py-2" : "px-3 py-2"} rounded-xl transition-all duration-200 group relative`}
              style={{
                background: location.startsWith("/admin-hub/settings") ? activeBg : "transparent",
                color: location.startsWith("/admin-hub/settings") ? accentColor : textSecondary,
              }}
              onMouseEnter={(e) => {
                if (!location.startsWith("/admin-hub/settings")) {
                  e.currentTarget.style.background = hoverBg;
                  e.currentTarget.style.color = textHover;
                }
              }}
              onMouseLeave={(e) => {
                if (!location.startsWith("/admin-hub/settings")) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = textSecondary;
                }
              }}
              title={collapsed ? "Platform Settings" : undefined}
            >
              {location.startsWith("/admin-hub/settings") && (
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-4 rounded-r-full"
                  style={{ backgroundColor: accentColor }}
                />
              )}
              <Settings className="h-4 w-4 shrink-0 transition-colors duration-200" />
              {!collapsed && <span className="text-xs truncate">Platform Settings</span>}
            </button>
          </Link>
        </div>

        {/* ─── User Section ─── */}
        <div className="p-3 shrink-0" style={{ borderTop: `1px solid ${dividerColor}` }}>
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
                  style={{ backgroundColor: accentColor, color: isLightTheme ? "#fff" : "#000" }}
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
                  style={{ backgroundColor: accentColor, color: isLightTheme ? "#fff" : "#000" }}
                >
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium truncate" style={{ color: textPrimary }}>
                  {user?.name || "User"}
                </p>
                <p className="text-[10px] truncate" style={{ color: textSecondary }}>
                  {user?.email}
                </p>
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
                  e.currentTarget.style.background = "transparent";
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
    </div>
    </DesignContext.Provider>
  );
}
