import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone, Monitor, Check, Download, Zap, Shield, Wifi } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";

export default function InstallPage() {
  const { data: user } = trpc.auth.me.useQuery();
  const [isMobile, setIsMobile] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  
  useEffect(() => {
    // Detect mobile
    const checkMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobile(checkMobile);
    
    // Check if already installed
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    const isInApp = (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone || isInApp);
    
    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);
  
  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    
    setDeferredPrompt(null);
  };
  
  if (isInstalled) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-[#D4AF37]/30 bg-black/50">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
              <Check className="h-8 w-8 text-[#D4AF37]" />
            </div>
            <CardTitle className="text-2xl text-[#D4AF37]">Already Installed!</CardTitle>
            <CardDescription>
              OmniScope is already installed on your device
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => window.location.href = "/"}
              className="w-full bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-black hover:from-[#C4A037] hover:to-[#E4C03F]"
            >
              Open OmniScope
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full border-[#D4AF37]/30 bg-black/50">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <img src="/SVG-02.svg" alt="OmniScope" className="h-16 mx-auto" />
            </div>
            <CardTitle className="text-3xl text-[#D4AF37]">Install OmniScope</CardTitle>
            <CardDescription className="text-lg">
              Access your intelligence platform anywhere, anytime
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Benefits */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4">
                <Zap className="h-8 w-8 text-[#D4AF37] mx-auto mb-2" />
                <h3 className="font-semibold text-foreground mb-1">Lightning Fast</h3>
                <p className="text-sm text-muted-foreground">Instant access from your home screen</p>
              </div>
              <div className="text-center p-4">
                <Wifi className="h-8 w-8 text-[#D4AF37] mx-auto mb-2" />
                <h3 className="font-semibold text-foreground mb-1">Works Offline</h3>
                <p className="text-sm text-muted-foreground">Access data without internet</p>
              </div>
              <div className="text-center p-4">
                <Shield className="h-8 w-8 text-[#D4AF37] mx-auto mb-2" />
                <h3 className="font-semibold text-foreground mb-1">Secure & Private</h3>
                <p className="text-sm text-muted-foreground">Enterprise-grade security</p>
              </div>
            </div>
            
            <Button
              onClick={() => window.location.href = getLoginUrl("/install")}
              className="w-full bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-black hover:from-[#C4A037] hover:to-[#E4C03F] h-12 text-lg"
            >
              Sign In to Install
            </Button>
            
            <p className="text-xs text-center text-muted-foreground">
              You'll be redirected back here after signing in to complete installation
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full border-[#D4AF37]/30 bg-black/50">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <img src="/SVG-02.svg" alt="OmniScope" className="h-16 mx-auto" />
          </div>
          <CardTitle className="text-3xl text-[#D4AF37]">Install OmniScope</CardTitle>
          <CardDescription className="text-lg">
            {isMobile ? "Install on your mobile device" : "Install on your desktop"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Installation Instructions */}
          {isMobile ? (
            <div className="space-y-4">
              <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg p-4">
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-[#D4AF37]" />
                  Mobile Installation Steps
                </h3>
                <ol className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <span className="text-[#D4AF37] font-bold">1.</span>
                    <span>Tap the "Install App" button below</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#D4AF37] font-bold">2.</span>
                    <span>Follow your browser's install prompt</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#D4AF37] font-bold">3.</span>
                    <span>Find OmniScope on your home screen</span>
                  </li>
                </ol>
              </div>
              
              {deferredPrompt ? (
                <Button
                  onClick={handleInstall}
                  className="w-full bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-black hover:from-[#C4A037] hover:to-[#E4C03F] h-12 text-lg"
                >
                  <Download className="h-5 w-5 mr-2" />
                  Install App
                </Button>
              ) : (
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">
                    Installation prompt not available yet
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Try using Safari (iOS) or Chrome (Android)
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg p-4">
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Monitor className="h-5 w-5 text-[#D4AF37]" />
                  Desktop Installation Steps
                </h3>
                <ol className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <span className="text-[#D4AF37] font-bold">1.</span>
                    <span>Look for the install icon in your browser's address bar</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#D4AF37] font-bold">2.</span>
                    <span>Click it and select "Install"</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#D4AF37] font-bold">3.</span>
                    <span>OmniScope will open as a standalone app</span>
                  </li>
                </ol>
              </div>
              
              <Button
                onClick={() => window.location.href = "/"}
                variant="outline"
                className="w-full"
              >
                Go to Dashboard
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
