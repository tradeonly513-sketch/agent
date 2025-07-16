// Enhanced mobile detection utilities
export function isMobile() {
  // Use 768px as the mobile breakpoint for better mobile experience  
  return globalThis.innerWidth <= 768;
}

export function isTablet() {
  // Detect tablet devices (769px to 1024px)
  return globalThis.innerWidth > 768 && globalThis.innerWidth <= 1024;
}

export function isTouchDevice() {
  // Detect touch-capable devices
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
}

export function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (isMobile()) return 'mobile';
  if (isTablet()) return 'tablet';
  return 'desktop';
}

export function useResponsiveLayout() {
  const deviceType = getDeviceType();
  const isTouchCapable = isTouchDevice();
  
  return {
    deviceType,
    isMobile: deviceType === 'mobile',
    isTablet: deviceType === 'tablet',
    isDesktop: deviceType === 'desktop',
    isTouchCapable,
    shouldUseMobileLayout: deviceType === 'mobile',
    shouldUseTabletLayout: deviceType === 'tablet'
  };
}
