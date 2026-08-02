const CACHE_NAME = 'sosoking-app-v20260802-community-court-1';
// Cache lineage: const CACHE_NAME = 'sosoking-app-v20260801-public-original-modal-1';
// Cache lineage: const CACHE_NAME = 'sosoking-app-v20260801-pc-daily-icon-1';
// Cache lineage: const CACHE_NAME = 'sosoking-app-v20260801-dripso-topic-image-1';
// Cache lineage: const CACHE_NAME = 'sosoking-app-v20260730-discussion-court-1';
// Cache lineage: /js/app.js?v=20260731-private-first-publication-1
// Cache lineage: /js/app.js?v=20260730-discussion-court-1
// Cache lineage: /js/pages/daily-real-court.js?v=20260730-daily-three-ranking-1
// Historical URL markers are retained for regression checks but are no longer precached.
const APP_SHELL = [
  '/',
  '/index.html',
  '/dripso/',
  '/dripso/index.html',
  '/dripso/dripso.css?v=20260801-topic-image-1',
  '/dripso/dripso.js?v=20260801-topic-image-1',
  '/dripso/pagination.js?v=20260801-audit-fixes-1',
  '/dripso/moderation.js?v=20260801-audit-fixes-1',
  '/dripso/jokes.js?v=20260731-dripso-1',
  '/site.webmanifest?v=20260729-pwa-icon-center-1',
  '/css/main.css?v=20260728-ui-audit-2',
  '/css/brand-logo.css?v=20260801-dripso-separate-1',
  '/css/dripso-entry.css?v=20260801-dripso-community-1',
  '/css/home-light.css?v=20260729-light-home-1',
  '/css/layout-spacing.css?v=20260729-spacing-flow-2',
  '/css/sans-font.css?v=20260729-sans-font-1',
  '/css/result-dark-contrast.css?v=20260731-dark-verdict-stamp-1',
  '/js/theme-init.js?v=20260729-script-csp-1',
  '/js/auth-google-login-state-guard.js?v=20260731-google-login-message-1',
  '/js/document-display-guard.js?v=20260731-document-format-1',
  '/js/app.js?v=20260802-community-court-1',
  '/js/dripso-entry-guard.js?v=20260801-dripso-community-1',
  '/js/firebase.js?v=20260729-auth-session-1',
  '/js/admin-access.js?v=20260730-admin-redirect-1',
  '/js/pages/home-community-court.js?v=20260802-community-court-1',
  '/js/pages/home-seven-judges.js?v=20260730-home-layout-route-1',
  '/js/pages/home-no-search.js?v=20260730-search-scope-1',
  '/js/pages/home-judge-assignment.js?v=20260730-judge-board-search-1',
  '/js/pages/home-court.js?v=20260730-configurable-limit-1',
  '/js/pages/home.js?v=20260729-brand-policy-1',
  '/js/pages/guide.js?v=20260802-community-court-1',
  '/js/pages/policy.js?v=20260730-final-audit-1',
  '/js/pages/policy-configurable-limit.js?v=20260730-final-audit-1',
  '/js/pages/submit-guard.js?v=20260731-private-first-publication-1',
  '/js/pages/submit-court.js?v=20260731-private-first-publication-1',
  '/js/pages/submit.js?v=20260730-configurable-limit-1',
  '/js/pages/daily-real-court-layout.js?v=20260802-community-court-1',
  '/js/pages/daily-community-court.js?v=20260802-community-court-1',
  '/js/pages/board-full-content-search.js?v=20260731-compact-record-card-1',
  '/js/pages/board-search-pagination.js?v=20260731-compact-record-card-1',
  '/js/pages/board-court.js?v=20260731-compact-record-card-1',
  '/js/pages/board.js?v=20260731-compact-record-card-1',
  '/js/utils/public-results.js?v=20260730-public-records-2',
  '/js/pages/result-comments.js?v=20260801-public-original-modal-1',
  '/js/pages/result-court.js?v=20260729-dark-record-participation-1',
  '/js/pages/discussion.js?v=20260730-discussion-court-1',
  '/js/pages/trial-game.js?v=20260729-dark-record-participation-1',
  '/js/pages/my-cases-game.js?v=20260729-dark-record-participation-1',
  '/js/pages/auth2.js?v=20260729-brand-unified-1',
  '/js/components/footer.js?v=20260729-brand-policy-1',
  '/js/components/theme.js?v=20260729-theme-global-2',
  '/js/components/court-design.js?v=20260729-light-home-1',
  '/js/components/nav.js?v=20260801-pc-daily-icon-1',
  '/js/components/header-icons.js?v=20260730-header-icon-single-1',
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

function appShellUrls() {
  return new Set(APP_SHELL.map(url => new URL(url, self.location.origin).href));
}

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

    const cache = await caches.open(CACHE_NAME);
    const allowed = appShellUrls();
    const cachedRequests = await cache.keys();
    await Promise.all(
      cachedRequests
        .filter(request => !allowed.has(request.url))
        .map(request => cache.delete(request))
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
    if (url.pathname === '/dripso' || url.pathname.startsWith('/dripso/')) {
      event.respondWith(
        networkFirst(request, '/dripso/index.html')
          .catch(() => caches.match('/dripso/index.html'))
      );
      return;
    }
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
