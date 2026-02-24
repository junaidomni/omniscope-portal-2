import { useState, useEffect } from "react";
import { OmniState } from "./OmniAvatar";

// ─── 3D Character Asset URLs ────────────────────────────────────────────────

const CHARACTER_ASSETS: Record<string, string> = {
  idle: "https://private-us-east-1.manuscdn.com/sessionFile/DDiMkLGQBY3PBFwVfZsFZ9/sandbox/iDyhMMDNBUGKOOwdwVeGSa-img-1_1771972980000_na1fn_b21uaS1jaGFyYWN0ZXItaWRsZQ.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvRERpTWtMR1FCWTNQQkZ3VmZac0ZaOS9zYW5kYm94L2lEeWhNTUROQlVHS09Pd2R3VmVHU2EtaW1nLTFfMTc3MTk3Mjk4MDAwMF9uYTFmbl9iMjF1YVMxamFHRnlZV04wWlhJdGFXUnNaUS5wbmc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=ITAEsAV1IUBm4waRJsO0dzSgx-Jjo3vcOUATFp0I~CznLZ5cH4Vj2AwtzUE2lwXQbSUcQchl-NGMPfeqXGofc3lRxJ~NV0dNLl2Kmq5SjM2aGOedUJ~P8DGvceB6jCF0uSF8M2rF3Q7WI14di38ySlutl7xzfoj2VoY3jYmXPys3g70xqWe6Xck5h1DDoxyEycrRPoC31m2Umr-guYUlk~2SW~GxEtn2MFsyadYSp9vy35Sg5Zp9HZICzsPlT-kYAOhluzeiu~cgmFIXSgW0Y8DEiCx~aDiX5gR7U4C5PtLkm8h3MvUbYTB43BXGYMQEPqeSAa9Ur8lndp-LVUFQwQ__",
  wave: "https://private-us-east-1.manuscdn.com/sessionFile/DDiMkLGQBY3PBFwVfZsFZ9/sandbox/iDyhMMDNBUGKOOwdwVeGSa-img-2_1771972997000_na1fn_b21uaS1jaGFyYWN0ZXItd2F2ZQ.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvRERpTWtMR1FCWTNQQkZ3VmZac0ZaOS9zYW5kYm94L2lEeWhNTUROQlVHS09Pd2R3VmVHU2EtaW1nLTJfMTc3MTk3Mjk5NzAwMF9uYTFmbl9iMjF1YVMxamFHRnlZV04wWlhJdGQyRjJaUS5wbmc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=hgqYDhMbuHamLtE0Clu9WXbimug~7HvE6nnervtaaNOWXIjAhsa1aaDJp8jyzXmcooy0L8Td~QYGsymhLJKDmB7eH8JsJ7MtzGTTyl1QqQG1GlMs3EHJB0y2RnKU08lx87F1g-fAjmBklp82vtYvIa~fNOUZ9XuFj8gN2djdQBGaHNBjQWMjapVaunsb6y6d6zYmCVkL5PA63xIP3yESyerue~H1KjCc3XQtEWmhEOidm9a7iVhehcmqjIhLkqnSmX6i1uP0-ndEMqQaGpNlXNY~guZ459jChUEC0NVCwc5olISJ9Y0N0LGqMtWVVqcb5R5VlO5mYo9lmHC2zyHjSg__",
  thinking: "https://private-us-east-1.manuscdn.com/sessionFile/DDiMkLGQBY3PBFwVfZsFZ9/sandbox/iDyhMMDNBUGKOOwdwVeGSa-img-3_1771972997000_na1fn_b21uaS1jaGFyYWN0ZXItdGhpbmtpbmc.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvRERpTWtMR1FCWTNQQkZ3VmZac0ZaOS9zYW5kYm94L2lEeWhNTUROQlVHS09Pd2R3VmVHU2EtaW1nLTNfMTc3MTk3Mjk5NzAwMF9uYTFmbl9iMjF1YVMxamFHRnlZV04wWlhJdGRHaHBibXRwYm1jLnBuZz94LW9zcy1wcm9jZXNzPWltYWdlL3Jlc2l6ZSx3XzE5MjAsaF8xOTIwL2Zvcm1hdCx3ZWJwL3F1YWxpdHkscV84MCIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5ODc2MTYwMH19fV19&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=p1Bu0nYJALG366qG~H0iNOL~RskuKIiivk~NkbchzObOVawa4fXd03R06mLsRXZJNHkogVcLp8AIGRno6kBzNsMb-KRkcBIlZyd-d1vQ1bOFj5LnL6YZhCsaQXz~LK5u7qKUm~dxfZx8q6m4xAYkOQDSGpe6iJMIgObaTqxaO9edpa6AA6yagx9Admqfk7rY~x1mE5IWeZIPNJriNH5cOyfsV62Pf-j6CusYOOedBNNO41XVkTrxxse4l3k94oef-his8FdYVxrP3EuyhbbgscylmAb8vdONigr1h8YzpR1K6IAnpZINK~x3Y073RDzkLeLRc9hki7-1g7Rqj1rmDg__",
  success: "https://private-us-east-1.manuscdn.com/sessionFile/DDiMkLGQBY3PBFwVfZsFZ9/sandbox/iDyhMMDNBUGKOOwdwVeGSa-img-4_1771972980000_na1fn_b21uaS1jaGFyYWN0ZXItc3VjY2Vzcw.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvRERpTWtMR1FCWTNQQkZ3VmZac0ZaOS9zYW5kYm94L2lEeWhNTUROQlVHS09Pd2R3VmVHU2EtaW1nLTRfMTc3MTk3Mjk4MDAwMF9uYTFmbl9iMjF1YVMxamFHRnlZV04wWlhJdGMzVmpZMlZ6Y3cucG5nP3gtb3NzLXByb2Nlc3M9aW1hZ2UvcmVzaXplLHdfMTkyMCxoXzE5MjAvZm9ybWF0LHdlYnAvcXVhbGl0eSxxXzgwIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzk4NzYxNjAwfX19XX0_&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=W8FMd6guEupzClCTJA6fM0jfUQZnrmugyd5PHKr1I5DDUffA4sQ0xzQjphlV-MuvyuCFQLZoh6rF-SsINCz8f125Pu2K94ffkKIOEBPNnRYsQY~pX43gAOMxBjBbmK4JYKakGISwnV-FBZONDRN2F1CIUVsnOzSWW709UMwbcTItx2Wj07NZHze-edkhtKoEiFs0baY~XZeRc9Mp7YCUZ~iKzgLEtqovViRTNXf8XyMKiKuIZMf37IvIFFeEbwNovveN8yXW9OUWU6HWg-h9v90kEcl8fKWuRwe8INwpVIpXgGQl7qc71wWYXUB72CKPCzRYGQv5Imdtvm-4MFdEog__",
  focused: "https://private-us-east-1.manuscdn.com/sessionFile/DDiMkLGQBY3PBFwVfZsFZ9/sandbox/iDyhMMDNBUGKOOwdwVeGSa-img-5_1771972992000_na1fn_b21uaS1jaGFyYWN0ZXItZm9jdXNlZA.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvRERpTWtMR1FCWTNQQkZ3VmZac0ZaOS9zYW5kYm94L2lEeWhNTUROQlVHS09Pd2R3VmVHU2EtaW1nLTVfMTc3MTk3Mjk5MjAwMF9uYTFmbl9iMjF1YVMxamFHRnlZV04wWlhJdFptOWpkWE5sWkEucG5nP3gtb3NzLXByb2Nlc3M9aW1hZ2UvcmVzaXplLHdfMTkyMCxoXzE5MjAvZm9ybWF0LHdlYnAvcXVhbGl0eSxxXzgwIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzk4NzYxNjAwfX19XX0_&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=Ls2rvhsuf6DnfrInnDjrqVQwGvwbOLvuVCm-BYmWTa6E-fwBX3eD2akEozuqbWWWB7QTldBrbm6OtxkWQc2y0BFQyiEp5BWmgQ5UNywVE-7OcnE-Nit9iajAeeb29aH0PqdT7VeOONgGQ4cHtWLx7plALiLJIzgLwdBFNQvseS-IDboW-AJ9wMxu-pV70IRjVWOh33Nt4bT3fS6JKorkPpj2MK2P-J~T-eBYDp8IK0~iLSO4Ky9wBPqKt--GWd4IiX69Yd07L~aHAmbgrwwgruh7JsjPzV2zt4ZshRy3xG9x2jLnRIwa7v2qrC7HpFoo5xHnv9iXKNQb0MGMsL6nUg__",
  alert: "https://private-us-east-1.manuscdn.com/sessionFile/DDiMkLGQBY3PBFwVfZsFZ9/sandbox/alfoMVzOJMKMRQkCxnkP61-img-1_1771973046000_na1fn_b21uaS1jaGFyYWN0ZXItYWxlcnQ.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvRERpTWtMR1FCWTNQQkZ3VmZac0ZaOS9zYW5kYm94L2FsZm9NVnpPSk1LTVJRa0N4bmtQNjEtaW1nLTFfMTc3MTk3MzA0NjAwMF9uYTFmbl9iMjF1YVMxamFHRnlZV04wWlhJdFlXeGxjblEucG5nP3gtb3NzLXByb2Nlc3M9aW1hZ2UvcmVzaXplLHdfMTkyMCxoXzE5MjAvZm9ybWF0LHdlYnAvcXVhbGl0eSxxXzgwIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzk4NzYxNjAwfX19XX0_&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=Dru0dhWJBiuj1SDaTvCwwLYUWT3W4CFHAVSRv~JHK7cOcKbsLfi1I3YZCWhGhkpAi3Kf5NhLhOrvf6vJTyaOG9JcuRkj5xJtJKFVDuo-FqS3vGcwwyR5w4rUshSXpoN4IV0~rAgj11BTFyeIth3QwiQEwRxVDimI3KQPGWeKr7xbej4JmcqAfUSGM0P0Y5bXEdVWwp4gxE~MNrzk8LljEJmFMsC3k0IYcQRHKpTTY-797dX2tMZvqqlRyG8EYyRltApAstMMuZ-AdnckovMrwbC8CGoLoj7RpBo35lSLdLKHkuEFi4RC4FDqn0O4yfvYrqPjod90etTPvPg~loCL0Q__",
  proud: "https://private-us-east-1.manuscdn.com/sessionFile/DDiMkLGQBY3PBFwVfZsFZ9/sandbox/alfoMVzOJMKMRQkCxnkP61-img-2_1771973056000_na1fn_b21uaS1jaGFyYWN0ZXItcHJvdWQ.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvRERpTWtMR1FCWTNQQkZ3VmZac0ZaOS9zYW5kYm94L2FsZm9NVnpPSk1LTVJRa0N4bmtQNjEtaW1nLTJfMTc3MTk3MzA1NjAwMF9uYTFmbl9iMjF1YVMxamFHRnlZV04wWlhJdGNISnZkV1FucG5nP3gtb3NzLXByb2Nlc3M9aW1hZ2UvcmVzaXplLHdfMTkyMCxoXzE5MjAvZm9ybWF0LHdlYnAvcXVhbGl0eSxxXzgwIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzk4NzYxNjAwfX19XX0_&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=PYBgW6M4PhgMZPfpx1PhwCFx1-Q2sa4dXCG92ddT8S8CEcIhlYZZmGli0kmPEIdcDbSfuAW~TnSNM1e-gIlOtji~7xa5wyYZb3sM0rzwc3FrBoqF8cyCmpyKk-6rprwxIGYMQ5PM~884ZoOfTG5i9GFh1NE2fkR5d1WFAkTTdZKWPyXEjfrA1ZpnATuFcSgqyA3RbBeEG7bx3URRL1anr~C8-VDDbdvVWPVekD-J9yPsFULofvgt5W0DgK2EK7Bf7ceHptKQBhbUjlJobNX1sQ-zjIgriNx60QonbusB6G4pcgMhzeRW-hGcCDLM1a1yETvubM5MBcJsChBAE3WsdA__",
  thumbsup: "https://private-us-east-1.manuscdn.com/sessionFile/DDiMkLGQBY3PBFwVfZsFZ9/sandbox/alfoMVzOJMKMRQkCxnkP61-img-3_1771973049000_na1fn_b21uaS1jaGFyYWN0ZXItdGh1bWJzdXA.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvRERpTWtMR1FCWTNQQkZ3VmZac0ZaOS9zYW5kYm94L2FsZm9NVnpPSk1LTVJRa0N4bmtQNjEtaW1nLTNfMTc3MTk3MzA0OTAwMF9uYTFmbl9iMjF1YVMxamFHRnlZV04wWlhJdGRHaDFiV0p6ZFhBLnBuZz94LW9zcy1wcm9jZXNzPWltYWdlL3Jlc2l6ZSx3XzE5MjAsaF8xOTIwL2Zvcm1hdCx3ZWJwL3F1YWxpdHkscV84MCIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5ODc2MTYwMH19fV19&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=hxaRLZxGwsZ-6~ZbviRvyIIzG9QtZ8JEjdLAKMmfqWAlLwtX-tRTfWM-pDE~nnfoXw3tIJ4Xgw~8w-Wvvtd0BnM71kyW~ifnZBjpQVVydePKPh98k4IwyAt~H~w~B-yqITFtbhtrdcAUMoTpoybsQiQa5CEsXaUImuTl7tjYAnLpb-uV~x8brWz2WRyv7CJc~wdlqQ5vNm3ooqe7VVwsaguF7lSP1sK267dFQU~iczH8dCJQSR8X3epdMDWxpQddW92toZ3-qC3HuHRmGydG6L0Czaje9W5PUMQvlQ3bynFer4AB0FjZmU6fR3WyYyQKaaW7zzJ0LvqbHChVEzVijw__",
};

// ─── State to Asset Mapping ─────────────────────────────────────────────────

function getCharacterAsset(state: OmniState): string {
  switch (state) {
    case "wave":
    case "hover":
      return CHARACTER_ASSETS.wave;
    
    case "thinking":
    case "waiting":
      return CHARACTER_ASSETS.thinking;
    
    case "success":
    case "celebrate":
      return CHARACTER_ASSETS.success;
    
    case "focused":
    case "curious":
      return CHARACTER_ASSETS.focused;
    
    case "alert":
    case "concerned":
    case "error":
      return CHARACTER_ASSETS.alert;
    
    case "proud":
      return CHARACTER_ASSETS.proud;
    
    case "thumbsup":
      return CHARACTER_ASSETS.thumbsup;
    
    case "idle":
    case "relaxed":
    default:
      return CHARACTER_ASSETS.idle;
  }
}

// ─── Animation Classes ──────────────────────────────────────────────────────

function getAnimationClass(state: OmniState): string {
  switch (state) {
    case "wave":
    case "hover":
      return "animate-bounce-subtle";
    
    case "thinking":
    case "waiting":
      return "animate-pulse-subtle";
    
    case "success":
    case "celebrate":
    case "thumbsup":
      return "animate-bounce";
    
    case "focused":
      return "animate-float";
    
    case "alert":
    case "error":
    case "concerned":
      return "animate-shake";
    
    case "proud":
      return "animate-float-slow";
    
    case "idle":
    case "relaxed":
    default:
      return "animate-breathe-slow";
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

interface Character3DProps {
  state: OmniState;
  size?: number;
  badge?: boolean;
  className?: string;
}

export default function Character3D({ state, size = 120, badge, className = "" }: Character3DProps) {
  const [currentAsset, setCurrentAsset] = useState(getCharacterAsset(state));
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Handle state transitions with smooth fade
  useEffect(() => {
    const newAsset = getCharacterAsset(state);
    if (newAsset !== currentAsset) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentAsset(newAsset);
        setIsTransitioning(false);
      }, 150);
    }
  }, [state, currentAsset]);

  const animationClass = getAnimationClass(state);

  return (
    <div 
      className={`relative ${className}`} 
      style={{ width: size, height: size }}
    >
      {/* Character Image */}
      <img
        src={currentAsset}
        alt="Omni Assistant"
        className={`w-full h-full object-contain transition-all duration-300 ${animationClass} ${
          isTransitioning ? "opacity-0 scale-95" : "opacity-100 scale-100"
        }`}
        style={{
          filter: state === "error" ? "brightness(0.8) saturate(1.2)" : "none",
        }}
      />

      {/* Badge Indicator */}
      {badge && (
        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-500 animate-pulse-subtle border-2 border-white shadow-lg" />
      )}

      {/* State-specific Effects */}
      {(state === "success" || state === "celebrate") && (
        <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping-once" />
      )}
      
      {state === "alert" && (
        <div className="absolute inset-0 rounded-full bg-orange-500/20 animate-pulse" />
      )}
      
      {state === "error" && (
        <div className="absolute inset-0 rounded-full bg-red-500/20 animate-pulse" />
      )}
    </div>
  );
}
