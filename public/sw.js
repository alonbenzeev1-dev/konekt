/* KONEKT service worker — app-shell cache + Web Push */
const CACHE = 'konekt-v5'; // bump on every UI release: assets under /assets and /icons are cache-first, old caches are deleted on activate
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png', '/icons/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Never cache Supabase / API traffic.
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first, fall back to cached shell (offline).
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/')));
    return;
  }
  // Hashed static assets: cache-first.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(req).then((hit) =>
        hit ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        }),
      ),
    );
  }
});

// Web Push (sent by supabase/functions/send-push).
// Two payload shapes arrive here:
//  - standard:  { title, body, tag, url }
//  - iOS 18.4+ Declarative Web Push: { web_push: 8030, notification: { title, body, navigate, tag, ... } }
//    (Safari can show those by itself; when it hands one to us we show the same notification, same tag, so there is one.)
function readPush(event) {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data ? event.data.text() : '' }; }
  const n = d && d.web_push === 8030 && d.notification ? d.notification : d;
  return {
    title: n.title || d.title || 'KONEKT',
    body: n.body || d.body || '',
    tag: n.tag || d.tag || 'konekt',
    url: n.navigate || n.url || d.url || '/?tab=chats',
  };
}

self.addEventListener('push', (event) => {
  const p = readPush(event);
  event.waitUntil(
    self.registration.showNotification(p.title, {
      body: p.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      dir: 'rtl',
      lang: 'he',
      tag: p.tag,
      renotify: true,
      vibrate: [80, 40, 80],
      data: { url: p.url },
    }),
  );
});

// Tap: focus the open app and tell it where to go (no reload); otherwise open the link.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.url) || '/';
  const target = new URL(raw, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (list) => {
      const mine = list.find((c) => new URL(c.url).origin === self.location.origin);
      if (mine) {
        mine.postMessage({ type: 'konekt:navigate', url: target });
        return mine.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
