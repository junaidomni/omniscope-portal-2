import { LogOut, Settings, Bell, Shield, HelpCircle, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

export default function MobileProfile() {
  const { data: user } = trpc.auth.me.useQuery();
  const [, setLocation] = useLocation();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = "/";
    },
  });
  
  const menuItems = [
    { icon: Settings, label: "Settings", path: "/mobile/settings" },
    { icon: Bell, label: "Notifications", path: "/mobile/notifications" },
    { icon: Shield, label: "Privacy & Security", path: "/mobile/privacy" },
    { icon: HelpCircle, label: "Help & Support", path: "/mobile/help" },
  ];
  
  return (
    <div className="h-full flex flex-col bg-black overflow-y-auto">
      {/* Header */}
      <div className="flex-none border-b border-[#D4AF37]/30 bg-black/95 backdrop-blur-sm px-4 py-3">
        <h1 className="text-xl font-semibold text-[#D4AF37]">Profile</h1>
      </div>
      
      {/* Profile info */}
      <div className="flex-none px-4 py-6 border-b border-[#D4AF37]/10">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="flex-none w-20 h-20 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#F4D03F] flex items-center justify-center text-black font-bold text-2xl">
            {user?.name?.charAt(0).toUpperCase() || "?"}
          </div>
          
          {/* User info */}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-foreground truncate">
              {user?.name || "User"}
            </h2>
            <p className="text-sm text-gray-400 truncate">
              {user?.email || ""}
            </p>
          </div>
        </div>
      </div>
      
      {/* Menu items */}
      <div className="flex-1">
        <div className="divide-y divide-[#D4AF37]/10">
          {menuItems.map((item) => {
            const Icon = item.icon;
            
            return (
              <button
                key={item.path}
                onClick={() => setLocation(item.path)}
                className="w-full px-4 py-4 flex items-center gap-3 hover:bg-[#D4AF37]/5 active:bg-[#D4AF37]/10 transition-colors"
              >
                <Icon className="h-5 w-5 text-[#D4AF37]" />
                <span className="flex-1 text-left text-foreground">{item.label}</span>
                <ChevronRight className="h-5 w-5 text-gray-500" />
              </button>
            );
          })}
        </div>
        
        {/* Logout */}
        <div className="px-4 py-4">
          <button
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="w-full px-4 py-3 flex items-center justify-center gap-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 active:bg-red-500/30 transition-colors disabled:opacity-50"
          >
            <LogOut className="h-5 w-5" />
            <span className="font-medium">Log Out</span>
          </button>
        </div>
      </div>
      
      {/* App info */}
      <div className="flex-none px-4 py-4 border-t border-[#D4AF37]/10 text-center">
        <p className="text-xs text-gray-500">
          OmniScope Intelligence Portal
        </p>
        <p className="text-xs text-gray-600 mt-1">
          Version 1.0.0
        </p>
      </div>
    </div>
  );
}
