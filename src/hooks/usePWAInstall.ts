import { useEffect, useState, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const INSTALLED_STORAGE_KEY = 'sportstats_pwa_installed_v1';

// Captura global temprana por si Chrome dispara beforeinstallprompt antes de que el componente monte
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    promptListeners.forEach((listener) => listener());
  });

  window.addEventListener('appinstalled', () => {
    globalDeferredPrompt = null;
    try {
      localStorage.setItem(INSTALLED_STORAGE_KEY, 'true');
    } catch {
      // Ignore storage errors in private mode
    }
    promptListeners.forEach((listener) => listener());
  });
}

function checkIsInstalled(): boolean {
  if (typeof window === 'undefined') return false;

  const isStandaloneDisplay =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    document.referrer.includes('android-app://');

  if (isStandaloneDisplay) {
    try {
      localStorage.setItem(INSTALLED_STORAGE_KEY, 'true');
    } catch {
      // Ignore storage errors
    }
    return true;
  }

  try {
    if (localStorage.getItem(INSTALLED_STORAGE_KEY) === 'true') {
      return true;
    }
  } catch {
    // Ignore storage errors
  }

  return false;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => globalDeferredPrompt);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => checkIsInstalled());
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isAndroid, setIsAndroid] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    setIsInstalled(checkIsInstalled());

    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(userAgent);
    const androidDevice = /android/.test(userAgent);
    setIsIOS(iosDevice);
    setIsAndroid(androidDevice);
    setIsMobile(iosDevice || androidDevice || /mobile/.test(userAgent));

    const syncPromptState = () => {
      setDeferredPrompt(globalDeferredPrompt);
      setIsInstalled(checkIsInstalled());
    };

    promptListeners.add(syncPromptState);

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        try {
          localStorage.setItem(INSTALLED_STORAGE_KEY, 'true');
        } catch {
          // Ignore
        }
        setIsInstalled(true);
      }
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleMediaChange);
    }

    return () => {
      promptListeners.delete(syncPromptState);
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', handleMediaChange);
      }
    };
  }, []);

  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    const activePrompt = deferredPrompt || globalDeferredPrompt;
    if (!activePrompt) return 'unavailable';

    try {
      await activePrompt.prompt();
      const { outcome } = await activePrompt.userChoice;
      if (outcome === 'accepted') {
        globalDeferredPrompt = null;
        setDeferredPrompt(null);
        setIsInstalled(true);
        try {
          localStorage.setItem(INSTALLED_STORAGE_KEY, 'true');
        } catch {
          // Ignore
        }
        return 'accepted';
      }
      return 'dismissed';
    } catch {
      return 'unavailable';
    }
  }, [deferredPrompt]);

  const markAsInstalledManually = useCallback(() => {
    try {
      localStorage.setItem(INSTALLED_STORAGE_KEY, 'true');
    } catch {
      // Ignore
    }
    setIsInstalled(true);
  }, []);

  return {
    isInstallable: Boolean(deferredPrompt || globalDeferredPrompt),
    isInstalled,
    isIOS,
    isAndroid,
    isMobile,
    install,
    markAsInstalledManually,
  };
}
