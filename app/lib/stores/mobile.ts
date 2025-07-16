import { atom } from 'nanostores';

// Mobile UI state management for CodeCraft Studio
export const mobileStore = {
  // Mobile sidebar state
  isSidebarOpen: atom(false),
  
  // Mobile workbench state  
  isWorkbenchOpen: atom(false),
  
  // Device detection
  isMobileDevice: atom(false),
  isTabletDevice: atom(false),
  
  // Touch interactions
  isTouchDevice: atom(false),
  
  // Mobile navigation
  showMobileMenu: atom(false),
  
  // Mobile chat state
  isChatFullscreen: atom(false),
  
  // Actions
  toggleSidebar: () => {
    mobileStore.isSidebarOpen.set(!mobileStore.isSidebarOpen.get());
  },
  
  toggleWorkbench: () => {
    mobileStore.isWorkbenchOpen.set(!mobileStore.isWorkbenchOpen.get());
  },
  
  closeSidebar: () => {
    mobileStore.isSidebarOpen.set(false);
  },
  
  closeWorkbench: () => {
    mobileStore.isWorkbenchOpen.set(false);
  },
  
  toggleMobileMenu: () => {
    mobileStore.showMobileMenu.set(!mobileStore.showMobileMenu.get());
  },
  
  toggleChatFullscreen: () => {
    mobileStore.isChatFullscreen.set(!mobileStore.isChatFullscreen.get());
  },
  
  // Initialize mobile detection
  initMobileDetection: () => {
    const checkDevice = () => {
      const width = window.innerWidth;
      const isMobile = width <= 768;
      const isTablet = width > 768 && width <= 1024;
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      mobileStore.isMobileDevice.set(isMobile);
      mobileStore.isTabletDevice.set(isTablet);
      mobileStore.isTouchDevice.set(isTouch);
      
      // Auto-close overlays when switching to desktop
      if (!isMobile && !isTablet) {
        mobileStore.isSidebarOpen.set(false);
        mobileStore.isWorkbenchOpen.set(false);
        mobileStore.showMobileMenu.set(false);
      }
    };
    
    checkDevice();
    window.addEventListener('resize', checkDevice);
    
    return () => window.removeEventListener('resize', checkDevice);
  }
};