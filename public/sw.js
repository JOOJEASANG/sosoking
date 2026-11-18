/* SOSOKING application shell only. No user data, event submissions or Firebase APIs are cached. */
const CACHE = 'sosoking-static-v2';
const STATIC = [
  '/', '/index.html', '/event.html', '/old-phone.html', '/guide.html', '/roster.html', '/orders.html', '/chat.html',
  '/css/site.css', '/js/pwa-install.js', '/js/event.js', '/js/phone.js', '/js/home.js', '/js/roster.js', '/js/orders.js', '/js/chat.js',
  '/manifest.webmanifest', '/icons/sosoking.svg',
  '/icons/sosoking-192.png', '/icons/sosoking-512.png',
  '/icons/sosoking-maskable-512.png', '/icons/sosoking-180.png',
  '/favicon-32.png'
];
const staticPaths = new Set(STATIC);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(STATIC)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('sosoking-static-') && k !== CACHE).map(k => caches.delete(k)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !staticPaths.has(url.pathname)) return;
  // Network first: new deployment wins. Offline: only publicly accessible static app shell.
  event.respondWith(
    fetch(request).then(response => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then(cache => cache.put(url.pathname, copy)));
      }
      return response;
    }).catch(async () => (await caches.match(url.pathname)) || Response.error())
  );
});
