// 버전 변경 시 이 숫자를 올리면 모든 SW 캐시가 삭제되고 갱신됩니다
const CACHE = 'sosoking-v4';

self.addEventListener('install', e => {
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

  // HTML, JS, CSS: 항상 네트워크 최신본 사용 (SW 캐시 저장 안 함)
  // firebase.json에서 이미 no-cache, no-store 설정 → CDN이 항상 최신본 제공
  if (
    e.request.mode === 'navigate' ||
    (url.origin === self.location.origin &&
     (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')))
  ) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // 이미지, 아이콘 등 정적 자산: 캐시 우선 (변경 빈도 낮음)
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
