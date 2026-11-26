import { useCallback, useEffect, useState } from 'react';
import { requestNotificationPermission, subscribeToPush, unsubscribeFromPush } from '../lib/notify';

/**
 * unsupported   this browser cannot do web push at all
 * unconfigured  the app has no VAPID key (VITE_VAPID_PUBLIC_KEY)
 * ios-install   iPhone / iPad in a normal Safari tab: push only works from the home-screen app
 * default       not asked yet
 * denied        blocked in the browser settings
 * off           allowed, but this device is not subscribed (turned off, or never saved)
 * on            subscribed
 */
export type PushState = 'unsupported' | 'unconfigured' | 'ios-install' | 'default' | 'denied' | 'off' | 'on';

export const isIosDevice = () => {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

export const isStandaloneApp = () =>
  window.matchMedia?.('(display-mode: standalone)').matches === true || (navigator as Navigator & { standalone?: boolean }).standalone === true;

async function readState(): Promise<PushState> {
  if (isIosDevice() && !isStandaloneApp()) return 'ios-install';
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
  if (!import.meta.env.VITE_VAPID_PUBLIC_KEY) return 'unconfigured';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'default') return 'default';
  try {
    const reg = await navigator.serviceWorker.ready;
    return (await reg.pushManager.getSubscription()) ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

export function usePushState(userId: string) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void readState().then((s) => live && setState(s));
    return () => {
      live = false;
    };
  }, []);

  /** Must run inside a tap: the permission prompt needs a user gesture (and iOS is strict about it). */
  const enable = useCallback(async (): Promise<PushState> => {
    setBusy(true);
    let next: PushState;
    const perm = await requestNotificationPermission();
    if (perm === 'granted') next = (await subscribeToPush(userId)) ? 'on' : 'off';
    else next = perm === 'denied' ? 'denied' : perm === 'unsupported' ? 'unsupported' : 'default';
    setState(next);
    setBusy(false);
    return next;
  }, [userId]);

  const disable = useCallback(async () => {
    setBusy(true);
    await unsubscribeFromPush();
    setState(await readState());
    setBusy(false);
  }, []);

  return { state, busy, enable, disable };
}
