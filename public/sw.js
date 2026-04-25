const CACHE = 'sosoking-v5';
const SHELL = [
  '/',
  '/logo.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Firebase, Google API, CDN은 SW 캐시 제외
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('cloudfunctions.net') ||
    url.hostname.includes('firestore.googleapis.com')
  ) return;

  // 네비게이션 요청 → SPA index.html 서빙 (단, /admin은 제외)
  if (e.request.mode === 'navigate') {
    if (url.pathname.startsWith('/admin')) return;
    e.respondWith(
      caches.match('/').then(r => r || fetch(e.request))
    );
    return;
  }

  // JS / CSS → 네트워크 우선 (항상 최신 코드 반영, 오프라인 시 캐시 폴백)
  if (url.origin === self.location.origin &&
      (url.pathname.endsWith('.js') || url.pathname.endsWith('.css'))) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // 그 외 정적 자산 (이미지, SVG 등) → 캐시 우선
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok && url.origin === self.location.origin) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
