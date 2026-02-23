import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Smartphone, Download } from "lucide-react";
import { Button } from "./ui/button";

export function InstallQRCode() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [installUrl] = useState(() => `${window.location.origin}/install`);
  const [showQR, setShowQR] = useState(false);
  
  useEffect(() => {
    if (showQR && canvasRef.current) {
      generateQRCode();
    }
  }, [showQR, installUrl]);
  
  const generateQRCode = async () => {
    if (!canvasRef.current) return;
    
    try {
      await QRCode.toCanvas(canvasRef.current, installUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: "#D4AF37", // OmniScope gold
          light: "#000000", // Black background
        },
      });
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  };
  
  const downloadQRCode = () => {
    if (!canvasRef.current) return;
    
    const url = canvasRef.current.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = "omniscope-install-qr.png";
    link.href = url;
    link.click();
  };
  
  return (
    <Card className="border-[#D4AF37]/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-[#D4AF37]" />
          Install on Mobile
        </CardTitle>
        <CardDescription>
          Scan this QR code with your phone to install OmniScope as an app
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!showQR ? (
          <Button 
            onClick={() => setShowQR(true)}
            className="w-full bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-black hover:from-[#C4A037] hover:to-[#E4C03F]"
          >
            Show QR Code
          </Button>
        ) : (
          <>
            <div className="flex justify-center p-4 bg-black rounded-lg">
              <canvas ref={canvasRef} />
            </div>
            
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Installation Instructions:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Open your phone's camera app</li>
                <li>Point it at the QR code above</li>
                <li>Tap the notification that appears</li>
                <li>Follow the prompts to install OmniScope</li>
              </ol>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={downloadQRCode}
                variant="outline"
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                Download QR
              </Button>
              <Button
                onClick={() => setShowQR(false)}
                variant="ghost"
                className="flex-1"
              >
                Hide QR
              </Button>
            </div>
            
            <p className="text-xs text-center text-muted-foreground">
              {installUrl}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
