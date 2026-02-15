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
  Shield
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
          <img src="/omniscope-logo-large.png" alt="OmniScope Intelligence Portal" className="h-48 mx-auto mb-12" />
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
    { path: "/calendar", icon: Calendar, label: "Calendar View" },
    { path: "/tasks", icon: CheckSquare, label: "To-Do" },
  ];

  // Add Admin Panel for admin users
  if (user?.role === 'admin') {
    navItems.push({ path: "/admin", icon: Shield, label: "Admin Panel" });
  }

  return (
    <div className="min-h-screen bg-black flex">
      {/* Sidebar - Fixed */}
      <div className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col fixed left-0 top-0 h-screen">
        {/* Logo */}
        <div className="p-6 border-b border-zinc-800 flex flex-col items-center justify-center">
          <img 
            src="/omniscope-logo-unified.svg" 
            alt="OmniScope Intelligence Portal" 
            className="w-full" 
            style={{ maxWidth: '180px' }}
          />
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
