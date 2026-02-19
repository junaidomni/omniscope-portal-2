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
  UserCog
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState, useEffect, createContext, useContext } from "react";
import OmniAvatar, { OmniMode } from "./OmniAvatar";
import OmniChatPanel from "./OmniChatPanel";

// Context so child pages can read sidebar state
interface SidebarContextType {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}
export const SidebarContext = createContext<SidebarContextType>({ collapsed: false, setCollapsed: () => {} });
export const useSidebar = () => useContext(SidebarContext);

// Omni context — lets child pages access Omni mode and open the chat panel
interface OmniContextType {
  omniMode: OmniMode;
  openChat: () => void;
}
export const OmniContext = createContext<OmniContextType>({ omniMode: "sigil", openChat: () => {} });
export const useOmni = () => useContext(OmniContext);

interface PortalLayoutProps {
  children: React.ReactNode;
}

const SIDEBAR_KEY = "omniscope-sidebar-collapsed";
const OMNI_MODE_KEY = "omniscope-omni-mode";
const OMNI_SIDEBAR_KEY = "omniscope-omni-sidebar-visible";

// Domain definitions — each domain groups related modules
interface DomainItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  matchPaths: string[]; // paths that activate this domain
}

const domains: DomainItem[] = [
  { 
    id: "command", 
    icon: LayoutDashboard, 
    label: "Command Center", 
    path: "/",
    matchPaths: ["/", "/reports/daily", "/reports/weekly"]
  },
  { 
    id: "intelligence", 
    icon: Radio, 
    label: "Intelligence", 
    path: "/intelligence",
    matchPaths: ["/intelligence", "/meetings", "/meeting/", "/vault", "/templates", "/pipeline"]
  },
  { 
    id: "communications", 
    icon: Mail, 
    label: "Communications", 
    path: "/communications",
    matchPaths: ["/communications", "/mail", "/calendar"]
  },
  { 
    id: "operations", 
    icon: Target, 
    label: "Operations", 
    path: "/operations",
    matchPaths: ["/operations", "/tasks"]
  },
  { 
    id: "relationships", 
    icon: Users, 
    label: "Relationships", 
    path: "/relationships",
    matchPaths: ["/relationships", "/contacts", "/contact/", "/companies", "/company/"]
  },
];

function isDomainActive(domain: DomainItem, location: string): boolean {
  return domain.matchPaths.some(p => {
    if (p === "/") return location === "/";
    return location === p || location.startsWith(p);
  });
}

export default function PortalLayout({ children }: PortalLayoutProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();
  const logoutMutation = trpc.auth.logout.useMutation();
  const [collapsed, setCollapsedState] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === "true"; } catch { return false; }
  });

  const setCollapsed = (v: boolean) => {
    setCollapsedState(v);
    try { localStorage.setItem(SIDEBAR_KEY, String(v)); } catch {};
  };

  // Omni state — all hooks must be before early returns
  const [omniChatOpen, setOmniChatOpen] = useState(false);
  const [omniMode, setOmniMode] = useState<OmniMode>(() => {
    try { return (localStorage.getItem(OMNI_MODE_KEY) as OmniMode) || "sigil"; } catch { return "sigil"; }
  });
  const [omniSidebarVisible, setOmniSidebarVisible] = useState(() => {
    try { return localStorage.getItem(OMNI_SIDEBAR_KEY) !== "false"; } catch { return true; }
  });

  // Persist Omni preferences
  useEffect(() => {
    try { localStorage.setItem(OMNI_MODE_KEY, omniMode); } catch {}
  }, [omniMode]);
  useEffect(() => {
    try { localStorage.setItem(OMNI_SIDEBAR_KEY, String(omniSidebarVisible)); } catch {}
  }, [omniSidebarVisible]);

  // Listen for settings changes from the Setup > Omni tab (same-window storage events)
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === OMNI_MODE_KEY && e.newValue) {
        setOmniMode(e.newValue as OmniMode);
      }
      if (e.key === OMNI_SIDEBAR_KEY && e.newValue) {
        setOmniSidebarVisible(e.newValue === "true");
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // ⌘K keyboard shortcut for Omni chat
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
    } catch (error) {
      toast.error("Failed to logout");
    }
  };

  // Redirect first-time users to onboarding
  useEffect(() => {
    if (isAuthenticated && user && !user.onboardingCompleted && location !== '/onboarding') {
      setLocation('/onboarding');
    }
  }, [isAuthenticated, user, location]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(to right, rgba(202, 138, 4, 0.1) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(202, 138, 4, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px'
          }} />
          <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-yellow-900/10 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-96 bg-gradient-to-t from-yellow-900/10 to-transparent" />
        </div>
        <div className="text-center relative z-10">
          <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663324311854/EnEmyoNefHCeqBIl.png" alt="OmniScope" className="h-48 mx-auto mb-12" />
          <h1 className="text-3xl font-bold text-white mb-3">Intelligence Portal</h1>
          <p className="text-zinc-400 mb-10 text-lg">Secure access required</p>
          <Button
            onClick={() => window.location.href = getLoginUrl()}
            className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium px-8 py-6 text-lg"
          >
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';
  const sidebarWidth = collapsed ? "w-[72px]" : "w-64";
  const mainMargin = collapsed ? "ml-[72px]" : "ml-64";

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
    <OmniContext.Provider value={{ omniMode, openChat: () => setOmniChatOpen(true) }}>
      <div className="min-h-screen bg-black flex">
        {/* Sidebar - Fixed */}
        <div className={`${sidebarWidth} bg-zinc-900 border-r border-zinc-800 flex flex-col fixed left-0 top-0 h-screen transition-all duration-300 ease-in-out z-50`}>
          {/* Logo + Collapse Toggle */}
          <div className="border-b border-zinc-800 flex flex-col items-center justify-center relative" style={{ padding: collapsed ? '12px 8px' : '20px' }}>
            {collapsed ? (
              <img 
                src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663324311854/ydFHlgxGadtyijbJ.png" 
                alt="OmniScope" 
                className="w-10 h-10 object-contain"
              />
            ) : (
              <img 
                src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663324311854/ydFHlgxGadtyijbJ.png" 
                alt="OmniScope Intelligence Portal" 
                className="w-full object-contain" 
                style={{ maxWidth: '160px', height: 'auto' }}
              />
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors z-10"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* Primary Domains */}
          <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
            {!collapsed && (
              <div className="px-3 pt-2 pb-1.5">
                <span className="text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">Workspace</span>
              </div>
            )}

            {domains.map((domain) => {
              const Icon = domain.icon;
              const active = isDomainActive(domain, location);
              
              return (
                <Link key={domain.id} href={domain.path}>
                  <button
                    className={`w-full flex items-center ${collapsed ? 'justify-center' : ''} gap-3 ${collapsed ? 'px-2 py-2.5' : 'px-3 py-2.5'} rounded-lg transition-all group relative ${
                      active
                        ? "bg-yellow-600/10 text-yellow-500 font-medium"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                    }`}
                    title={collapsed ? domain.label : undefined}
                  >
                    {active && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-yellow-500 rounded-r-full" />
                    )}
                    <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-yellow-500' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
                    {!collapsed && <span className="text-sm truncate">{domain.label}</span>}
                  </button>
                </Link>
              );
            })}

            {/* Divider */}
            <div className="!my-3 mx-3 border-t border-zinc-800/60" />

            {/* Ask OmniScope — sidebar trigger (toggleable) */}
            {omniSidebarVisible && (
              <>
                {!collapsed && (
                  <div className="px-3 pb-1.5">
                    <span className="text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">Tools</span>
                  </div>
                )}

                <button
                  onClick={() => setOmniChatOpen(true)}
                  className={`w-full flex items-center ${collapsed ? 'justify-center' : ''} gap-3 ${collapsed ? 'px-2 py-2.5' : 'px-3 py-2.5'} rounded-lg transition-all group relative text-zinc-400 hover:text-white hover:bg-zinc-800/60`}
                  title={collapsed ? "Ask Omni (⌘K)" : undefined}
                >
                  <Sparkles className="h-[18px] w-[18px] shrink-0 text-zinc-500 group-hover:text-yellow-500 transition-colors" />
                  {!collapsed && (
                    <>
                      <span className="text-sm truncate flex-1 text-left">Ask Omni</span>
                      <kbd className="text-[9px] text-zinc-600 font-mono bg-zinc-800 border border-zinc-700/60 px-1 py-0.5 rounded">⌘K</kbd>
                    </>
                  )}
                </button>
              </>
            )}
          </nav>

          {/* Footer: Settings + Admin */}
          <div className="px-2 pb-1 space-y-0.5">
            <div className="mx-1 mb-1 border-t border-zinc-800/60" />

            {[
              { path: "/setup", icon: Settings, label: "Settings" },
              { path: "/hr", icon: UserCog, label: "HR Hub" },
              ...(isAdmin ? [{ path: "/admin", icon: Shield, label: "Admin" }] : []),
            ].map((item) => {
              const Icon = item.icon;
              const active = location === item.path || location.startsWith(item.path + '/') || location.startsWith(item.path + '?');
              return (
                <Link key={item.path} href={item.path}>
                  <button
                    className={`w-full flex items-center ${collapsed ? 'justify-center' : ''} gap-3 ${collapsed ? 'px-2 py-2' : 'px-3 py-2'} rounded-lg transition-all group relative ${
                      active
                        ? "bg-yellow-600/10 text-yellow-500 font-medium"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40"
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    {active && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-yellow-500 rounded-r-full" />
                    )}
                    <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-yellow-500' : ''}`} />
                    {!collapsed && <span className="text-xs truncate">{item.label}</span>}
                  </button>
                </Link>
              );
            })}
          </div>

          {/* User Section */}
          <div className="p-3 border-t border-zinc-800">
            {collapsed ? (
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-yellow-600 flex items-center justify-center text-black font-bold text-xs" title={user?.name || "User"}>
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <button
                  onClick={handleLogout}
                  className="text-zinc-500 hover:text-white transition-colors p-1"
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
                <div className="h-8 w-8 rounded-full bg-yellow-600 flex items-center justify-center text-black font-bold text-xs shrink-0">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{user?.name || "User"}</p>
                  <p className="text-[10px] text-zinc-500 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-zinc-500 hover:text-white transition-colors p-1.5 rounded-md hover:bg-zinc-800"
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

        {/* Main Content */}
        <main className={`flex-1 overflow-auto ${mainMargin} transition-all duration-300 ease-in-out`}>
          {children}
        </main>

        {/* Floating Omni Avatar — bottom-right (hidden on Triage page where greeting bar has one) */}
        {omniMode !== "hidden" && !omniChatOpen && location !== "/" && (
          <div className="fixed bottom-6 right-6 z-[80]">
            <OmniAvatar
              mode={omniMode}
              state="idle"
              size={56}
              onClick={() => setOmniChatOpen(true)}
              badge={false}
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
    </OmniContext.Provider>
    </SidebarContext.Provider>
  );
}

// Export Omni settings for use in Settings page
export type { OmniMode };
export { OMNI_MODE_KEY, OMNI_SIDEBAR_KEY };
