import { supabase } from './supabase';

type ToastKind = 'info' | 'success' | 'error' | 'alert';
export interface ToastItem { id: number; text: string; kind: ToastKind }

type Listener = (t: ToastItem) => void;
const listeners = new Set<Listener>();
let seq = 0;

export function onToast(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function toast(text: string, kind: ToastKind = 'info') {
  const item = { id: ++seq, text, kind };
  listeners.forEach((l) => l(item));
}

/** Silent in-class alert: vibration + toast, and a system notification if the tab is hidden. */
export async function alertIncoming(title: string, body: string, tag: string) {
  try {
    navigator.vibrate?.([70, 40, 70]);
  } catch {
    /* iOS Safari has no vibrate */
  }
  toast(`${title} · ${body}`, 'alert');
  if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
    const options = { body, tag, icon: '/icons/icon-192.png', dir: 'rtl', lang: 'he' } as const;
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      void reg.showNotification(title, options); // sw.js focuses / opens the app on click
    } else {
      const n = new Notification(title, options);
      n.onclick = () => {
        window.focus();
        n.close();
      };
    }
  }
}

/**
 * Registers the service worker and keeps installed copies fresh:
 *  - sw.js is never served from the HTTP cache, and is re-checked every time the app comes to the foreground;
 *  - sw.js takes over immediately (skipWaiting + clients.claim). When that happens to an app that is already open,
 *    it reloads the next time it returns to the foreground, never while someone is typing.
 */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  try {
    const hadController = !!navigator.serviceWorker.controller; // false on the very first install: nothing to refresh
    const reg = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
    let newVersionReady = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) newVersionReady = true;
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      if (newVersionReady) location.reload();
      else void reg.update().catch(() => { /* offline */ });
    });
    void reg.update().catch(() => { /* offline */ });
  } catch (e) {
    console.warn('SW registration failed', e);
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Subscribes to Web Push (only if a VAPID key is configured) and stores the subscription. true = saved. */
export async function subscribeToPush(userId: string): Promise<boolean> {
  const vapid = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapid || !('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapid) }));
    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return false;
    // the RPC also moves a device that switched accounts; a plain upsert is refused by RLS for a row someone else owned
    const { error } = await supabase.rpc('save_push_subscription', {
      p_endpoint: json.endpoint,
      p_p256dh: json.keys.p256dh,
      p_auth: json.keys.auth,
      p_user_agent: navigator.userAgent.slice(0, 300),
    });
    if (!error) return true;
    const { error: e2 } = await supabase.from('push_subscriptions').upsert(
      { endpoint: json.endpoint, user_id: userId, p256dh: json.keys.p256dh, auth: json.keys.auth, user_agent: navigator.userAgent.slice(0, 300) },
      { onConflict: 'endpoint' },
    );
    return !e2;
  } catch (e) {
    console.warn('push subscribe failed', e);
    return false;
  }
}

/** Turns push off on this device: unsubscribes the browser and forgets the row. */
export async function unsubscribeFromPush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  } catch (e) {
    console.warn('push unsubscribe failed', e);
  }
}
