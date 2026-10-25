// exposed by desktop/preload.cjs when running inside the desktop app
interface DesktopBridge {
  isDesktop: true;
  close: () => void;
}

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}

export const desktop = typeof window !== 'undefined' ? window.desktop : undefined;
