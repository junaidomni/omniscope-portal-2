import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { X, Smartphone } from "lucide-react";
import { Button } from "./ui/button";

export function InstallBanner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installUrl] = useState(() => `${window.location.origin}/install`);
  
  useEffect(() => {
    // Check if already dismissed
    const isDismissed = localStorage.getItem("omniscope-install-banner-dismissed") === "true";
    setDismissed(isDismissed);
    
    // Check if PWA is already installed
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    const isInApp = (window.navigator as any).standalone === true; // iOS
    setIsInstalled(isStandalone || isInApp);
    
    // Generate QR code
    if (!isDismissed && !isStandalone && !isInApp && canvasRef.current) {
      generateQRCode();
    }
  }, [installUrl]);
  
  const generateQRCode = async () => {
    if (!canvasRef.current) return;
    
    try {
      await QRCode.toCanvas(canvasRef.current, installUrl, {
        width: 80,
        margin: 1,
        color: {
          dark: "#D4AF37", // OmniScope gold
          light: "#000000", // Black background
        },
      });
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  };
  
  const handleDismiss = () => {
    localStorage.setItem("omniscope-install-banner-dismissed", "true");
    setDismissed(true);
  };
  
  // Don't show if dismissed or already installed
  if (dismissed || isInstalled) {
    return null;
  }
  
  return (
    <div className="bg-gradient-to-r from-[#D4AF37]/10 to-[#F4D03F]/10 border border-[#D4AF37]/30 rounded-lg p-3 mb-4">
      <div className="flex items-center gap-3">
        {/* QR Code */}
        <div className="shrink-0 bg-black p-1.5 rounded-lg">
          <canvas ref={canvasRef} className="block" />
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Smartphone className="h-4 w-4 text-[#D4AF37]" />
            <h3 className="text-sm font-semibold text-foreground">
              Install OmniScope Mobile
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Scan this QR code with your phone to install OmniScope as an app
          </p>
        </div>
        
        {/* Dismiss Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          className="shrink-0 h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
