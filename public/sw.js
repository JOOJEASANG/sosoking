const CACHE = 'sosoking-v2';
const SHELL = [
  '/',
  '/css/main.css',
  '/js/app.js',
  '/js/firebase.js',
  '/js/firebase-config.js',
  '/js/components/nav.js',
  '/js/components/footer.js',
  '/js/components/theme.js',
  '/js/components/toast.js',
  '/js/pages/home.js',
  '/js/pages/topics.js',
  '/js/pages/topic-detail.js',
  '/js/pages/debate.js',
  '/js/pages/submit-topic.js',
  '/js/pages/my-history.js',
  '/js/pages/policy.js',
  '/js/pages/guide.js',
  '/js/pages/feedback.js',
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

  // 네비게이션 요청 → index.html 서빙
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match('/').then(r => r || fetch(e.request))
    );
    return;
  }

  // 정적 자산: 캐시 우선
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
