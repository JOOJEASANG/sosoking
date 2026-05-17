/* sw.js — 소소킹 서비스 워커
 *
 * 전략:
 *  - JS / CSS / HTML → SW에서 절대 캐시 안 함. 브라우저가 서버와 직접 통신.
 *    (Firebase Hosting이 이미 Cache-Control: no-cache 헤더를 보냄)
 *  - 이미지·아이콘·폰트 → 캐시 우선 (성능)
 *  - CACHE 이름에 날짜 포함 → 매일 구버전 캐시 자동 소거
 */

const TODAY = new Date().toISOString().slice(0, 10); // '2025-05-17'
const CACHE  = `sosoking-${TODAY}`;

/* ── 설치: 즉시 활성화 ── */
self.addEventListener('install', () => {
  self.skipWaiting();
});

/* ── 활성화: 오늘 캐시 외 전부 삭제 ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* ── 요청 처리 ── */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  /* 외부 도메인 (Firebase, Google API, CDN 등) → SW 제외 */
  if (url.hostname !== self.location.hostname) return;

  const path = url.pathname;

  /* JS · CSS · HTML · JSON → SW에서 절대 안 건드림
   * 브라우저가 서버의 Cache-Control: no-cache 헤더를 따라 매번 신선도 확인 */
  if (
    path.endsWith('.js') ||
    path.endsWith('.css') ||
    path.endsWith('.html') ||
    path.endsWith('.json') ||
    path === '/' ||
    e.request.mode === 'navigate'
  ) return;

  /* 이미지·아이콘·SVG → 캐시 우선 (자주 안 바뀜) */
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached || new Response('', { status: 408 }));
    })
  );
});
