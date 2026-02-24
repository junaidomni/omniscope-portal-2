import { useState, useEffect } from "react";
import { OmniState } from "./OmniAvatar";

// ─── 3D Character Asset URLs ────────────────────────────────────────────────

// New transparent background assets (WebP compressed for web performance)
const CHARACTER_ASSETS: Record<string, string> = {
  idle: "https://private-us-east-1.manuscdn.com/sessionFile/DDiMkLGQBY3PBFwVfZsFZ9/sandbox/hZJqZGpG6dU8Weo1Fj8NZd_1771975340546_na1fn_b21uaS1jaGFyYWN0ZXItaWRsZS10cmFuc3BhcmVudA.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvRERpTWtMR1FCWTNQQkZ3VmZac0ZaOS9zYW5kYm94L2haSnFaR3BHNmRVOFdlbzFGajhOWmRfMTc3MTk3NTM0MDU0Nl9uYTFmbl9iMjF1YVMxamFHRnlZV04wWlhJdGFXUnNaUzEwY21GdWMzQmhjbVZ1ZEEucG5nP3gtb3NzLXByb2Nlc3M9aW1hZ2UvcmVzaXplLHdfMTkyMCxoXzE5MjAvZm9ybWF0LHdlYnAvcXVhbGl0eSxxXzgwIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzk4NzYxNjAwfX19XX0_&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=Bod3VZfZvslE6VyUoU4ELDY0wU8qOVo6jLQjwUv7ZrBZubgxlpOg-mJQhAz6PCBKJFeT-vKBBSxdg6SLdr2-78-S5vM1lSFdPpx-uPNvRUjbN2QtHwkk~Um6QcQXZTpp8JUzn4BOequu85GemOmcDHOtNAb-S2MO~eAr23fdJez8R1973bRfH-JTTCRSQiWI9bY2HM17BFtRJRgDXU04elvl7UjM97qaXXC-9xkYckDrfpCpGzQHEncArcPaMakn1zqDffn~YD0pVNM0Ip~A4y44zKaStfMaVU8zDuoWGUayNXwo1gudaQwyusd5-L26IbbGhXYs~y6T-h~2g4prLQ__",
  wave: "https://private-us-east-1.manuscdn.com/sessionFile/DDiMkLGQBY3PBFwVfZsFZ9/sandbox/hZJqZGpG6dU8Weo1Fj8NZd_1771975340547_na1fn_b21uaS1jaGFyYWN0ZXItd2F2ZS10cmFuc3BhcmVudA.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvRERpTWtMR1FCWTNQQkZ3VmZac0ZaOS9zYW5kYm94L2haSnFaR3BHNmRVOFdlbzFGajhOWmRfMTc3MTk3NTM0MDU0N19uYTFmbl9iMjF1YVMxamFHRnlZV04wWlhJdGQyRjJaUzEwY21GdWMzQmhjbVZ1ZEEucG5nP3gtb3NzLXByb2Nlc3M9aW1hZ2UvcmVzaXplLHdfMTkyMCxoXzE5MjAvZm9ybWF0LHdlYnAvcXVhbGl0eSxxXzgwIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzk4NzYxNjAwfX19XX0_&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=dyMN1xSebIGrBlwedOE46A1w4m4xn1Xv25IaEKdkNieC98ims7GUbKewSN~FridhWx~qM9GrVMjphBxS-MLWt4VJr~adpJ0MkFFQUjfcEOineTmz4BdkbH9iH0vY8CEzRRVQQ2LP4PFwx9L~dseTAdDmy7w6d3orgWbdZgKLePDMax4EC0T6wPy~H3kUYwbX4Qm8IUxT11MjWOaFtgh2d5SkMcnH7-G5JXXZRCVr8boNQMQ1SZN~AqvqgjeUDdiw4Xs4MqCdn7o6admSlVOOtnfjuk34kexrM3g6J81qOVozOWAGKdbzSA5G9r-fkrzNyOwYKPInrJgT8G-0BTZkdQ__",
  thinking: "https://private-us-east-1.manuscdn.com/sessionFile/DDiMkLGQBY3PBFwVfZsFZ9/sandbox/hZJqZGpG6dU8Weo1Fj8NZd_1771975340548_na1fn_b21uaS1jaGFyYWN0ZXItdGhpbmtpbmctdHJhbnNwYXJlbnQ.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvRERpTWtMR1FCWTNQQkZ3VmZac0ZaOS9zYW5kYm94L2haSnFaR3BHNmRVOFdlbzFGajhOWmRfMTc3MTk3NTM0MDU0OF9uYTFmbl9iMjF1YVMxamFHRnlZV04wWlhJdGRHaHBibXRwYm1jdGRISmhibk53WVhKbGJuUS5wbmc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=aUpwAYVsyPBh6V4dpUXqWnq9buXqYzsunEnwo8FgCgIiFUAlcVQ~F2OkiUtljpQUJkFc2tAoTymyW~gSM7gOvTPhi63P1lXznSOSMwnBXOKnFt9D1OFBAdOfIjG5vMUs6b~xdKAtFCOHrDGtSlRGx-was4E7AdVvzCBrhDMRQytKUgbNSkenTd2e8XFu44DKajbeBwx4cDH1SQsOCnt8NVwUmx42L4kpwFtqaf1ag0tuW3KX-bp51v4G0RtyjusSn-qR87qvNk9LZnSZLQaEnWSgH~mIojQ3Z-lIb6K7o~yvHB0mHHWAOeVDSsMYheUyDsuMgMppgYhh5pBoIqZSQQ__",
  success: "https://private-us-east-1.manuscdn.com/sessionFile/DDiMkLGQBY3PBFwVfZsFZ9/sandbox/hZJqZGpG6dU8Weo1Fj8NZd_1771975340549_na1fn_b21uaS1jaGFyYWN0ZXItc3VjY2Vzcy10cmFuc3BhcmVudA.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvRERpTWtMR1FCWTNQQkZ3VmZac0ZaOS9zYW5kYm94L2haSnFaR3BHNmRVOFdlbzFGajhOWmRfMTc3MTk3NTM0MDU0OV9uYTFmbl9iMjF1YVMxamFHRnlZV04wWlhJdGMzVmpZMlZ6Y3kxMGNtRnVjM0JoY21WdWRBLnBuZz94LW9zcy1wcm9jZXNzPWltYWdlL3Jlc2l6ZSx3XzE5MjAsaF8xOTIwL2Zvcm1hdCx3ZWJwL3F1YWxpdHkscV84MCIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5ODc2MTYwMH19fV19&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=gxMBJ-zgwUevemX3IxWm0rrwEzzkxEf41SiGZKMqzYwLipyz0t0W-vbsTFW7lkp~QC40~ysQGUT9PJj56ox9Aum-tec3qc-KpjJXx7cavl9TTK2b4bvkE01I2uhaaomg6mLeKy0bIeJltS7Xcns5B4IykSU1UccVjNrmZjF4Mn2ftyjijBKNbKMDq4A2T~3ORmR4mI1Sbjs1iNPJMXTeLdeQQLegrwjRmsqHt5L-9~5KoEJrq3IPSSvwxkJmxseR67gK~0DdVeRZcT3ZNMq4jRCBg2UlaSnpIoUTSvBHmxuvDclQVRWjs5PUzx4Bh9nyJ7a1ORTU-aSLMwMctRQUCg__",
  focused: "https://private-us-east-1.manuscdn.com/sessionFile/DDiMkLGQBY3PBFwVfZsFZ9/sandbox/hZJqZGpG6dU8Weo1Fj8NZd_1771975340550_na1fn_b21uaS1jaGFyYWN0ZXItZm9jdXNlZC10cmFuc3BhcmVudA.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvRERpTWtMR1FCWTNQQkZ3VmZac0ZaOS9zYW5kYm94L2haSnFaR3BHNmRVOFdlbzFGajhOWmRfMTc3MTk3NTM0MDU1MF9uYTFmbl9iMjF1YVMxamFHRnlZV04wWlhJdFptOWpkWE5sWkMxMGNtRnVjM0JoY21WdWRBLnBuZz94LW9zcy1wcm9jZXNzPWltYWdlL3Jlc2l6ZSx3XzE5MjAsaF8xOTIwL2Zvcm1hdCx3ZWJwL3F1YWxpdHkscV84MCIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5ODc2MTYwMH19fV19&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=HCCSjrsNTOaNoKv1hNT-3DCF8Yan13nDCXJMoailKUG1~nE465PKTkSNoG6~Y8AvgwXAIbZzT~7Kc7fBvKt4-aGx9tx4WNES8pPjNfbhWJIt23kKYdqX20VGC-QjT26UnmVAR3xgUAeILvMX~w7EvRwl-Ukg-ZyAvkArxGocPm1vx1-j7P8dBAOR-tBMe5YaoPsdPHBFKt6a-jWvoJjtxROrjVeZkATiz4d06MsGvQEFYZJKoHZbRnTkOAC1zx-n5eVvFz5rDu~7naEVREfNVoJoUgs1CmH3jMdpgVyS5R7cXdpkdRU-wmM~6bQHG12o226nNo3~ODhUPvv0b5FKpA__",
  alert: "https://private-us-east-1.manuscdn.com/sessionFile/DDiMkLGQBY3PBFwVfZsFZ9/sandbox/R9SIgaMLpSOI5LaUBFcc6v_1771975410170_na1fn_b21uaS1jaGFyYWN0ZXItYWxlcnQtdHJhbnNwYXJlbnQ.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvRERpTWtMR1FCWTNQQkZ3VmZac0ZaOS9zYW5kYm94L1I5U0lnYU1McFNPSTVMYVVCRmNjNnZfMTc3MTk3NTQxMDE3MF9uYTFmbl9iMjF1YVMxamFHRnlZV04wWlhJdFlXeGxjblF0ZEhKaGJuTndZWEpsYm5RLnBuZz94LW9zcy1wcm9jZXNzPWltYWdlL3Jlc2l6ZSx3XzE5MjAsaF8xOTIwL2Zvcm1hdCx3ZWJwL3F1YWxpdHkscV84MCIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5ODc2MTYwMH19fV19&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=tADlViyjsa7i00~p~ROjaRuCedchObVpO8XVzyZYcagU0dWQOxgraWaOeBOln9DWnxxcsxFGOSJDUJeGqs7b48Bq6TFWksKpnoHW~IsnkdE43q2T0uJDmR2V9QuSAOjI2CDn95puH1sLB60pMlblow5flDwcwBt6QFzR8FN4BW3O-lmJS-AmbJ1g2tznTDCsPa6q1LzxS0GtZT9G-5rA2b2Zo6eUUvFKHQfxYg-2q8YjtdR1Pci4rtGdlUc7nAGxvXXYpRvCDBa25XduES9z-PzPagFA2zTilnd~5kjD6nCNknf46TY8dTxpUdSK0OtkO7nQFL6yFG8O1mozHL9EVA__",
  proud: "https://private-us-east-1.manuscdn.com/sessionFile/DDiMkLGQBY3PBFwVfZsFZ9/sandbox/R9SIgaMLpSOI5LaUBFcc6v_1771975410171_na1fn_b21uaS1jaGFyYWN0ZXItcHJvdWQtdHJhbnNwYXJlbnQ.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvRERpTWtMR1FCWTNQQkZ3VmZac0ZaOS9zYW5kYm94L1I5U0lnYU1McFNPSTVMYVVCRmNjNnZfMTc3MTk3NTQxMDE3MV9uYTFmbl9iMjF1YVMxamFHRnlZV04wWlhJdGNISnZkV1F0ZEhKaGJuTndZWEpsYm5RLnBuZz94LW9zcy1wcm9jZXNzPWltYWdlL3Jlc2l6ZSx3XzE5MjAsaF8xOTIwL2Zvcm1hdCx3ZWJwL3F1YWxpdHkscV84MCIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5ODc2MTYwMH19fV19&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=PpIaayTg9AZ4GHZqq4of6RnmikqnM4pt4Prah0gyJlpgcB97MtdyQNumLe63G7MA~ja27JMApjLoTVLyY96nC6F5muyxBb5XcYtc9JdFqm9XlnWzv796BnlxlNDQBMjFE1Tzor8W0LyKR7VG~gf8rNnj5HpBq0Gf7bxxwcw9vYkzGVjdOW4sr4GLaR15QtIyfAgpA0ISxCo1NCSnHOebSoU4MEofGbLCY2GcfgjFcPHu9d1vzhTmvT1mzSV1ZAUPO2tgWE162Ot59KlPSJ4Ib6SO0t2pljzg~osmvFPLX3LjHkc~1sUW9LDXc2xUiZZat4vvxsFXcwRfBeVccfhEnw__",
  thumbsup: "https://private-us-east-1.manuscdn.com/sessionFile/DDiMkLGQBY3PBFwVfZsFZ9/sandbox/R9SIgaMLpSOI5LaUBFcc6v_1771975410172_na1fn_b21uaS1jaGFyYWN0ZXItdGh1bWJzdXAtdHJhbnNwYXJlbnQ.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvRERpTWtMR1FCWTNQQkZ3VmZac0ZaOS9zYW5kYm94L1I5U0lnYU1McFNPSTVMYVVCRmNjNnZfMTc3MTk3NTQxMDE3Ml9uYTFmbl9iMjF1YVMxamFHRnlZV04wWlhJdGRHaDFiV0p6ZFhBdGRISmhibk53WVhKbGJuUS5wbmc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=XX7JoHzfZZBRcf0VKFatSBAhmrB0FOO-AuzQDJVjGdHXMAhIbKd9FVUIz8WYKn1IqjuGPuXHel-d08jT50DTmHkwZF0u2P105e8xuwnMS19NudVu-QJQuD6nLfhwNkNI0vt7yEX~2lYnGahNpvR45Ae8bvQgqa5ctw~YfrGTDPq4ALfxudYdAqcggrltSeXvwExKQ63KRCYf8HCXcEA6Y8Uwi1fwpCKIVV-I3z7Gx2BJy5qxjeUQnBh7AhzpFu3enUegEfXA7E4YQcTVYIHhhxT8ReSNW8jQrxLOSiociUaOh3st-2QG~4mj7Sct4cHfKfzUK1p0wzPQBFO7tuxxxw__",
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
      return "animate-celebrate";
    
    case "thumbsup":
      return "animate-bounce-subtle";
    
    case "focused":
    case "curious":
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
