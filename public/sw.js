// sw.js — PWA 설치 안정성과 최신 자산 반영을 함께 관리합니다.
const CACHE = 'sosoking-v40';
const FRESH_EXTENSIONS = ['.html', '.js', '.css', '.json', '.webmanifest'];
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-192-maskable.png',
  '/icon-512-maskable.png',
];

async function cacheCoreAssets() {
  const cache = await caches.open(CACHE);
  await Promise.allSettled(CORE_ASSETS.map(async path => {
    const response = await fetch(path, { cache: 'reload' });
    if (response.ok) await cache.put(path, response);
  }));
}

self.addEventListener('install', event => {
  event.waitUntil(cacheCoreAssets().finally(() => self.skipWaiting()));
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

async function networkFirst(request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response.ok && request.mode === 'navigate') {
      const cache = await caches.open(CACHE);
      await cache.put('/index.html', response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      return (await caches.match('/index.html')) || (await caches.match('/'));
    }
    throw new Error('network unavailable');
  }
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (shouldBypass(event.request, url)) return;

  // HTML/JS/CSS/JSON/manifest는 네트워크 우선으로 최신 버전을 사용하고 실패 시 캐시로 대체합니다.
  if (shouldAlwaysFetchFresh(event.request, url)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // 이미지/아이콘 등 정적 자산은 캐시 우선으로 제공합니다.
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
