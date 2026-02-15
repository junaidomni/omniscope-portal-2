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
  Loader2
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface PortalLayoutProps {
  children: React.ReactNode;
}

export default function PortalLayout({ children }: PortalLayoutProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();
  const logoutMutation = trpc.auth.logout.useMutation();

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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <img src="/omniscope-logo.svg" alt="OmniScope" className="h-12 mx-auto mb-8" />
          <h1 className="text-2xl font-bold text-white mb-4">OmniScope Intelligence Portal</h1>
          <p className="text-zinc-400 mb-8">Secure access required</p>
          <Button
            onClick={() => window.location.href = getLoginUrl()}
            className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium"
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
    { path: "/calendar", icon: Calendar, label: "Calendar View" },
    { path: "/tasks", icon: CheckSquare, label: "To-Do" },
  ];

  return (
    <div className="min-h-screen bg-black flex">
      {/* Sidebar - Fixed */}
      <div className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col fixed left-0 top-0 h-screen">
        {/* Logo */}
        <div className="p-6 border-b border-zinc-800 flex flex-col items-center">
          <img 
            src="/omniscope-logo-optimized.svg" 
            alt="OmniScope" 
            className="h-auto" 
            style={{ maxHeight: '70px', width: 'auto' }}
          />
          <p className="text-xs text-yellow-600 font-medium mt-3 tracking-wide">INTELLIGENCE PORTAL</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            
            return (
              <Link key={item.path} href={item.path}>
                <button
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? "bg-yellow-600 text-black font-medium"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </button>
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-zinc-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-yellow-600 flex items-center justify-center text-black font-bold">
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
        </div>
      </div>

      {/* Main Content - With left margin to account for fixed sidebar */}
      <main className="flex-1 overflow-auto ml-64">
        {children}
      </main>
    </div>
  );
}
