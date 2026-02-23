/**
 * Mobile and PWA detection utilities
 */

/**
 * Check if the app is running in standalone/PWA mode
 */
export function isPWA(): boolean {
  // Check if running in standalone mode (PWA installed)
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const isInApp = (window.navigator as any).standalone === true; // iOS
  
  return isStandalone || isInApp;
}

/**
 * Check if the device is mobile based on screen size and touch capability
 */
export function isMobileDevice(): boolean {
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(userAgent);
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth <= 768;
  
  return isMobileUA || (isTouchDevice && isSmallScreen);
}

/**
 * Check if the app should use mobile UI
 * (PWA mode OR mobile device)
 */
export function shouldUseMobileUI(): boolean {
  return isPWA() || isMobileDevice();
}
