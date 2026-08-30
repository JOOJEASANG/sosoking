const CACHE_NAME = 'sosoking-app-v20260830-jury-vote-fix-1';

const APP_SHELL = [
  '/',
  '/index.html',
  '/site.webmanifest?v=20260729-pwa-icon-center-1',
  '/css/main.css?v=20260829-tags-1',
  '/css/brand-logo.css?v=20260802-remove-daily-court-2',
  '/css/game-entry.css?v=20260811-game-hub-1',
  '/css/home-light.css?v=20260729-light-home-1',
  '/css/layout-spacing.css?v=20260729-spacing-flow-2',
  '/css/sans-font.css?v=20260729-sans-font-1',
  '/css/result-dark-contrast.css?v=20260731-dark-verdict-stamp-1',
  '/css/jury.css?v=20260830-final-audit-1',
  '/js/theme-init.js?v=20260729-script-csp-1',
  '/js/auth-google-login-state-guard.js?v=20260731-google-login-message-1',
  '/js/document-display-guard.js?v=20260802-original-button-layout-1',
  '/js/verdict-number-line-guard.js?v=20260801-verdict-number-lines-2',
  '/js/app.js?v=20260830-final-audit-1',
  '/js/result-link-share.js?v=20260811-result-share-1',
  '/js/submit-draft-guard.js?v=20260807-submit-draft-1',
  '/js/service-hub-guard.js?v=20260829-jury-1',
  '/js/avatar-fallback.js?v=20260829-avatar-1',
  '/js/firebase.js?v=20260729-auth-session-1',
  '/js/firebase-config.js',
  '/js/admin-access.js?v=20260730-admin-redirect-1',
  '/js/pages/home.js?v=20260830-final-audit-1',
  '/js/pages/submit.js?v=20260830-final-audit-1',
  '/js/pages/trial.js?v=20260810-current-judges-1',
  '/js/pages/result-comments.js?v=20260830-final-audit-1',
  '/js/pages/result-court.js?v=20260829-arena-1',
  '/js/pages/result.js?v=20260829-jury-content-1',
  '/js/pages/discussion.js?v=20260730-discussion-court-1',
  '/js/pages/policy.js?v=20260830-final-audit-1',
  '/js/pages/my-cases-game.js?v=20260810-mycase-light-1',
  '/js/pages/my-cases.js?v=20260810-mycase-light-1',
  '/js/pages/guide.js?v=20260830-final-audit-1',
  '/js/pages/auth2.js?v=20260829-avatar-1',
  '/js/pages/hall.js?v=20260829-arena-2',
  '/js/pages/jury.js?v=20260830-jury-vote-fix-1',
  '/js/utils/sanitize.js?v=20260630-3',
  '/js/utils/public-results.js?v=20260730-public-records-2',
  '/js/utils/jury-seen.js?v=20260829-jury-content-1',
  '/js/utils/avatar.js?v=20260829-avatar-1',
  '/js/utils/photo-upload.js?v=20260829-avatar-1',
  '/js/components/footer.js?v=20260729-brand-policy-1',
  '/js/components/theme.js?v=20260729-theme-global-2',
  '/js/components/court-design.js?v=20260729-light-home-1',
  '/js/components/nav.js?v=20260829-arena-1',
  '/js/components/header-icons.js?v=20260829-arena-1',
  '/js/components/toast.js?v=20260630-3',
  '/js/components/report-dialog.js?v=20260729-report-moderation-1',
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
    await Promise.all(keys
      .filter(key => key.startsWith('sosoking-app-') && key !== CACHE_NAME)
      .map(key => caches.delete(key)));

    const cache = await caches.open(CACHE_NAME);
    const allowed = appShellUrls();
    const cachedRequests = await cache.keys();
    await Promise.all(cachedRequests
      .filter(request => !allowed.has(request.url))
      .map(request => cache.delete(request)));
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
  if (NETWORK_FIRST.test(url.pathname)) event.respondWith(networkFirst(request));
});
