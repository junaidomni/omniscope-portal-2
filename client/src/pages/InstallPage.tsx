import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone, Monitor, Check, Download, Zap, Shield, Wifi } from "lucide-react";
import { getLoginUrl } from "@/const";

export default function InstallPage() {
  const [isMobile, setIsMobile] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  
  console.log('[InstallPage] Component mounted - route is working!');
  
  useEffect(() => {
    // Detect mobile - more comprehensive check
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(userAgent);
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isSmallScreen = window.innerWidth <= 768;
    const checkMobile = isMobileUA || (isTouchDevice && isSmallScreen);
    
    console.log('[InstallPage] Mobile detection:', {
      userAgent: userAgent.substring(0, 50),
      isMobileUA,
      isTouchDevice,
      isSmallScreen,
      checkMobile
    });
    
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
  
  // Show install instructions directly (no login required)
  
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
                <div className="space-y-4">
                  <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg p-4">
                    <h4 className="font-semibold text-foreground mb-3">Manual Installation</h4>
                    {/iPhone|iPad|iPod/i.test(navigator.userAgent) ? (
                      <ol className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex gap-2">
                          <span className="text-[#D4AF37] font-bold">1.</span>
                          <span>Tap the Share button <span className="inline-block">⎙</span> at the bottom of Safari</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-[#D4AF37] font-bold">2.</span>
                          <span>Scroll down and tap "Add to Home Screen"</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-[#D4AF37] font-bold">3.</span>
                          <span>Tap "Add" in the top right corner</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-[#D4AF37] font-bold">4.</span>
                          <span>Find OmniScope icon on your home screen</span>
                        </li>
                      </ol>
                    ) : (
                      <ol className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex gap-2">
                          <span className="text-[#D4AF37] font-bold">1.</span>
                          <span>Tap the menu button (⋮) in Chrome</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-[#D4AF37] font-bold">2.</span>
                          <span>Tap "Install app" or "Add to Home screen"</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-[#D4AF37] font-bold">3.</span>
                          <span>Tap "Install" to confirm</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-[#D4AF37] font-bold">4.</span>
                          <span>Open OmniScope from your home screen</span>
                        </li>
                      </ol>
                    )}
                  </div>
                  <Button
                    onClick={() => window.location.href = getLoginUrl("/")}
                    className="w-full bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-black hover:from-[#C4A037] hover:to-[#E4C03F]"
                  >
                    Sign In After Installing
                  </Button>
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
                onClick={() => window.location.href = getLoginUrl("/")}
                className="w-full bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-black hover:from-[#C4A037] hover:to-[#E4C03F]"
              >
                Sign In to Get Started
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
