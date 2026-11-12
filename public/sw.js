// Service worker CKMoney : rend l'appli installable et ouvre l'écran d'accueil hors ligne.
// Les données (Firebase) ne sont JAMAIS mises en cache : elles passent toujours par le réseau.
const CACHE = 'ckmoney-v3';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

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
  // Seules les ressources de l'appli elle-même passent par le cache.
  if (url.origin !== self.location.origin) return;

  // Pages : réseau d'abord (toujours la dernière version), cache en secours.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        // Seule l'appli sert de secours hors ligne (pas les pages publiques des jeux).
        .then((res) => { if (res.ok && !['/jambo', '/bac', '/wiseman'].includes(url.pathname)) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('/', copy)); } return res; })
        .catch(() => caches.match('/')),
    );
    return;
  }

  // Fichiers versionnés (JS, CSS, icônes) : cache d'abord, puis réseau.
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/'))) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    })),
  );
});

// Notifications push (Firebase Cloud Messaging, messages « data » envoyés par le serveur).
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }
  const d = payload.data || payload.notification || {};
  const title = d.title || 'CKMoney';
  event.waitUntil(self.registration.showNotification(title, {
    body: d.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: d.tag || undefined,
    data: { url: d.url || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.startsWith(self.location.origin) && 'focus' in w) { w.navigate(url); return w.focus(); }
      }
      return self.clients.openWindow(url);
    }),
  );
});
