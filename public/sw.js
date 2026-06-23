// sw.js — 배포 후 오래된 정적 자산이 남지 않도록 캐시 버전을 관리합니다.
const CACHE = 'sosoking-v211-king-relaunch';
const FRESH_EXTENSIONS = ['.html', '.js', '.css', '.json', '.webmanifest', '.xml'];

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function shouldBypass(request, url) {
  if (request.method !== 'GET') return true;
  return (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('cloudfunctions.net') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('kakao')
  );
}

function shouldAlwaysFetchFresh(request, url) {
  if (request.mode === 'navigate') return true;
  if (url.origin !== self.location.origin) return false;
  return FRESH_EXTENSIONS.some(ext => url.pathname.endsWith(ext)) || url.pathname === '/manifest.json';
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (shouldBypass(event.request, url)) return;

  if (shouldAlwaysFetchFresh(event.request, url)) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }).catch(() => fetch(event.request)));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
