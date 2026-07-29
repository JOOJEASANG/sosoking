const CACHE_NAME = 'sosoking-app-v20260730-public-feed-1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/site.webmanifest?v=20260729-pwa-icon-center-1',
  '/css/main.css?v=20260728-ui-audit-2',
  '/css/brand-logo.css?v=20260729-sans-font-1',
  '/css/home-light.css?v=20260729-light-home-1',
  '/css/layout-spacing.css?v=20260729-spacing-flow-2',
  '/css/sans-font.css?v=20260729-sans-font-1',
  '/js/theme-init.js?v=20260729-script-csp-1',
  '/js/app.js?v=20260730-public-feed-1',
  '/js/pages/home-court.js?v=20260730-public-feed-1',
  '/js/pages/home.js?v=20260729-brand-policy-1',
  '/js/pages/guide.js?v=20260729-brand-policy-1',
  '/js/pages/policy.js?v=20260729-brand-policy-1',
  '/js/pages/daily-real-court.js?v=20260729-daily-real-court-1',
  '/js/pages/board-court.js?v=20260729-full-verdict-comments-1',
  '/js/pages/board.js?v=20260729-full-verdict-comments-1',
  '/js/pages/result-comments.js?v=20260729-full-verdict-comments-1',
  '/js/pages/result-court.js?v=20260729-dark-record-participation-1',
  '/js/pages/trial-game.js?v=20260729-dark-record-participation-1',
  '/js/pages/my-cases-game.js?v=20260729-dark-record-participation-1',
  '/js/components/footer.js?v=20260729-brand-policy-1',
  '/logo.png?v=20260729-brand-unified-1',
  '/icons/sosoking-192.png?v=20260729-pwa-icon-center-1',
  '/icons/sosoking-512.png?v=20260729-pwa-icon-center-1',
  '/icons/sosoking-maskable-512.png?v=20260729-pwa-icon-center-1',
  '/icons/favicon-32.png',
  '/icons/favicon-48.png',
  '/og-image.png'
];
const STATIC_ASSET = /\.(?:js|css|svg|png|webp|jpg|jpeg|woff2)$/i;
const NETWORK_FIRST = /\.(?:json|webmanifest)$/i;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const results = await Promise.allSettled(APP_SHELL.map(url => cache.add(url)));
    const failed = results.filter(result => result.status === 'rejected').length;
    if (failed) console.warn(`service worker shell cache skipped ${failed} resource(s)`);
  })());
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => key.startsWith('sosoking-app-') && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

async function putCache(request, response) {
  try {
    if (!response?.ok || response.type === 'opaque') return;
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch (error) {
    console.warn('service worker cache write skipped:', error);
  }
}

async function networkFirst(request, fallbackRequest = request) {
  try {
    const response = await fetch(request);
    await putCache(request, response);
    return response;
  } catch (error) {
    const cached = await caches.match(request) || await caches.match(fallbackRequest);
    if (cached) return cached;
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const network = fetch(request)
    .then(async response => {
      await putCache(request, response);
      return response;
    })
    .catch(() => null);

  if (cached) {
    void network;
    return cached;
  }
  const response = await network;
  if (response) return response;
  throw new Error('Network and cache unavailable');
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/__/auth/')) return;

  if (request.mode === 'navigate') {
    if (url.pathname.startsWith('/result/')) {
      event.respondWith(fetch(request));
      return;
    }
    event.respondWith(networkFirst(request, '/index.html').catch(() => caches.match('/')));
    return;
  }

  if (STATIC_ASSET.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (NETWORK_FIRST.test(url.pathname)) {
    event.respondWith(networkFirst(request));
  }
});
