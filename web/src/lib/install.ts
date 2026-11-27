// Installable app (PWA): register the service worker and keep Android's install prompt for the profile button.
import { useSyncExternalStore } from 'react';

interface InstallPrompt extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
let deferred: InstallPrompt | null = null;
const subs = new Set<() => void>();
const ping = () => subs.forEach((f) => f());

export function setupInstall() {
  if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as InstallPrompt; ping(); });
  window.addEventListener('appinstalled', () => { deferred = null; ping(); });
}

const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

/** 'installed' | 'prompt' (Android/desktop Chrome can install now) | 'ios' (show Share → Add to Home Screen) | 'none' */
export function useInstall() {
  const ready = useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => deferred);
  const state = standalone() ? 'installed' : ready ? 'prompt' : isIos() ? 'ios' : 'none';
  const install = async () => { if (!deferred) return; await deferred.prompt(); await deferred.userChoice; deferred = null; ping(); };
  return { state, install } as const;
}
