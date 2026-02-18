import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Sparkles, 
  FileText, 
  CheckSquare,
  Calendar,
  LogOut,
  Loader2,
  Shield,
  Settings,
  Users,
  Building2,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Mail
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState, useEffect, createContext, useContext } from "react";

// Context so child pages can read sidebar state
interface SidebarContextType {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}
export const SidebarContext = createContext<SidebarContextType>({ collapsed: false, setCollapsed: () => {} });
export const useSidebar = () => useContext(SidebarContext);

interface PortalLayoutProps {
  children: React.ReactNode;
}

const SIDEBAR_KEY = "omniscope-sidebar-collapsed";

export default function PortalLayout({ children }: PortalLayoutProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();
  const logoutMutation = trpc.auth.logout.useMutation();
  const [collapsed, setCollapsedState] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === "true"; } catch { return false; }
  });

  const setCollapsed = (v: boolean) => {
    setCollapsedState(v);
    try { localStorage.setItem(SIDEBAR_KEY, String(v)); } catch {}
  };

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      toast.success("Logged out successfully");
      window.location.href = getLoginUrl();
    } catch (error) {
      toast.error("Failed to logout");
    }
  };

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
        {/* Sovereign-themed background */}
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
        
        {/* Content */}
        <div className="text-center relative z-10">
          <img src="/omniscope-only.png" alt="OmniScope" className="h-48 mx-auto mb-12" />
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

  const navItems = [
    { path: "/", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/ask", icon: Sparkles, label: "Ask OmniScope" },
    { path: "/meetings", icon: FileText, label: "Meetings" },
    { path: "/calendar", icon: Calendar, label: "Calendar" },
    { path: "/tasks", icon: CheckSquare, label: "To-Do" },
    { path: "/contacts", icon: Users, label: "Relationship Hub" },
    { path: "/companies", icon: Briefcase, label: "Companies" },
    { path: "/mail", icon: Mail, label: "Mail" },
    { path: "/hr", icon: Building2, label: "HR Hub" },
    { path: "/integrations", icon: Settings, label: "Integrations" },
  ];

  const isAdmin = user?.role === 'admin';
  const sidebarWidth = collapsed ? "w-[72px]" : "w-64";
  const mainMargin = collapsed ? "ml-[72px]" : "ml-64";

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
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
            {/* Collapse toggle button */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors z-10"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              
              return (
                <Link key={item.path} href={item.path}>
                  <button
                    className={`w-full flex items-center ${collapsed ? 'justify-center' : ''} gap-3 ${collapsed ? 'px-2 py-3' : 'px-4 py-3'} rounded-lg transition-all ${
                      isActive
                        ? "bg-yellow-600 text-black font-medium"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </button>
                </Link>
              );
            })}
          </nav>

          {/* Setup & Admin - Bottom of sidebar above user */}
          <div className="px-2 pb-1 space-y-1">
            <Link href="/onboarding">
              <button
                className={`w-full flex items-center ${collapsed ? 'justify-center' : ''} gap-3 ${collapsed ? 'px-2 py-3' : 'px-4 py-3'} rounded-lg transition-all ${
                  location === '/onboarding'
                    ? "bg-yellow-600 text-black font-medium"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
                title={collapsed ? "Setup" : undefined}
              >
                <Settings className="h-5 w-5 shrink-0" />
                {!collapsed && <span>Setup</span>}
              </button>
            </Link>
          </div>
          {isAdmin && (
            <div className="px-2 pb-1">
              <Link href="/admin">
                <button
                  className={`w-full flex items-center ${collapsed ? 'justify-center' : ''} gap-3 ${collapsed ? 'px-2 py-3' : 'px-4 py-3'} rounded-lg transition-all ${
                    location === '/admin'
                      ? "bg-yellow-600 text-black font-medium"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                  }`}
                  title={collapsed ? "Admin Panel" : undefined}
                >
                  <Shield className="h-5 w-5 shrink-0" />
                  {!collapsed && <span>Admin Panel</span>}
                </button>
              </Link>
            </div>
          )}

          {/* User Section */}
          <div className="p-3 border-t border-zinc-800">
            {collapsed ? (
              <div className="flex flex-col items-center gap-2">
                <div className="h-9 w-9 rounded-full bg-yellow-600 flex items-center justify-center text-black font-bold text-sm" title={user?.name || "User"}>
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <button
                  onClick={handleLogout}
                  className="text-zinc-500 hover:text-white transition-colors p-1"
                  title="Sign Out"
                  disabled={logoutMutation.isPending}
                >
                  {logoutMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-full bg-yellow-600 flex items-center justify-center text-black font-bold shrink-0">
                    {user?.name?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{user?.name || "User"}</p>
                    <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
                  </div>
                </div>
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  size="sm"
                  className="w-full border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
                  disabled={logoutMutation.isPending}
                >
                  {logoutMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Main Content - With left margin to account for fixed sidebar */}
        <main className={`flex-1 overflow-auto ${mainMargin} transition-all duration-300 ease-in-out`}>
          {children}
        </main>
      </div>
    </SidebarContext.Provider>
  );
}
