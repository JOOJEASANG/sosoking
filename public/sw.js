const CACHE_NAME = 'sosoking-app-v20260729-logo-feed-1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/site.webmanifest?v=20260728-pwa-install-1',
  '/css/main.css?v=20260728-ui-audit-2',
  '/css/brand-logo.css?v=20260729-logo-feed-1',
  '/js/app.js?v=20260729-logo-feed-1',
  '/logo.svg?v=20260729-logo-feed-1',
  '/icons/sosoking-192.png',
  '/icons/sosoking-512.png'
];
const NETWORK_FIRST = /\.(js|css|json|webmanifest)$/i;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL).catch(() => null)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith('sosoking-app-') && key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

async function putCache(request, response) {
  try {
    if (!response?.ok) return;
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch (error) {
    console.warn('service worker cache write skipped:', error);
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/admin')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(response => {
        putCache('/index.html', response);
        return response;
      }).catch(async () => (await caches.match('/index.html')) || caches.match('/'))
    );
    return;
  }

  if (NETWORK_FIRST.test(url.pathname)) {
    event.respondWith(
      fetch(request).then(response => {
        putCache(request, response);
        return response;
      }).catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    fetch(request).then(response => {
      putCache(request, response);
      return response;
    }).catch(() => caches.match(request))
  );
});
