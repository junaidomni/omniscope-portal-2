import { MessageSquare, Phone, User } from "lucide-react";
import { useLocation } from "wouter";
import { ReactNode } from "react";

interface MobileLayoutProps {
  children: ReactNode;
}

export default function MobileLayout({ children }: MobileLayoutProps) {
  const [location, setLocation] = useLocation();
  
  const tabs = [
    { path: "/mobile/messages", icon: MessageSquare, label: "Messages" },
    { path: "/mobile/calls", icon: Phone, label: "Calls" },
    { path: "/mobile/profile", icon: User, label: "Profile" },
  ];
  
  return (
    <div className="h-screen flex flex-col bg-black">
      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
      
      {/* Bottom navigation */}
      <nav className="border-t border-[#D4AF37]/30 bg-black/95 backdrop-blur-sm">
        <div className="flex items-center justify-around h-16 px-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = location.startsWith(tab.path);
            
            return (
              <button
                key={tab.path}
                onClick={() => setLocation(tab.path)}
                className={`flex flex-col items-center justify-center gap-1 min-w-[60px] min-h-[44px] transition-colors ${
                  isActive
                    ? "text-[#D4AF37]"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                <Icon className="h-6 w-6" />
                <span className="text-xs font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
