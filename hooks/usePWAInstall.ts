import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type DesktopOS = 'Windows' | 'Linux' | 'macOS' | 'iOS' | 'Android' | 'Desktop';

function detectOS(): DesktopOS {
  if (typeof window === 'undefined') return 'Desktop';
  const ua = window.navigator.userAgent.toLowerCase();
  const platform = ((window.navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData?.platform || window.navigator.platform || '').toLowerCase();

  if (/iphone|ipad|ipod/.test(ua)) return 'iOS';
  if (/android/.test(ua)) return 'Android';
  if (platform.includes('win') || ua.includes('windows')) return 'Windows';
  if (platform.includes('linux') || ua.includes('linux') || ua.includes('x11')) return 'Linux';
  if (platform.includes('mac') || ua.includes('macintosh')) return 'macOS';
  return 'Desktop';
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [os, setOs] = useState<DesktopOS>(() => detectOS());

  useEffect(() => {
    setOs(detectOS());

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: window-controls-overlay)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS: os === 'iOS',
    os,
    install,
  };
}
