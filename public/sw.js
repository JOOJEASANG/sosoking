const CACHE_NAME = 'sosoking-app-v20260630-21';
const APP_SHELL = ['/', '/index.html', '/site.webmanifest', '/app-icon.svg'];
const NETWORK_FIRST = /\.(js|css|json|webmanifest)$/i;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL).catch(() => null)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

async function putCache(req, res) {
  try {
    if (!res || !res.ok) return;
    const cache = await caches.open(CACHE_NAME);
    await cache.put(req, res.clone());
  } catch {}
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/admin')) return;

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/index.html')));
    return;
  }

  if (NETWORK_FIRST.test(url.pathname)) {
    event.respondWith(fetch(req).then(res => { putCache(req, res); return res; }).catch(() => caches.match(req)));
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => { putCache(req, res); return res; }).catch(() => cached))
  );
});
