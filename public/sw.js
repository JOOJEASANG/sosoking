const CACHE_NAME = 'sosoking-play-v20260817-naming-1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/game/',
  '/game/index.html',
  '/game/game.css?v=20260816-play-brand-1',
  '/game/theme.css?v=20260817-light-contrast-1',
  '/game/theme.js?v=20260816-play-brand-1',
  '/game/install.js?v=20260816-play-brand-1',
  '/game/game-night.css?v=20260817-naming-1',
  '/game/game-night.js?v=20260817-naming-1',
  '/game/party.css?v=20260811-party-games-1',
  '/game/fun-pack.css?v=20260817-naming-1',
  '/game/fun-pack.js?v=20260817-naming-1',
  '/game/fun-room-reload.js?v=20260812-fun-pack-1',
  '/game/member-profile.css?v=20260812-game-guide-polish-1',
  '/game/member-profile.js?v=20260817-naming-1',
  '/game/game-master.css?v=20260816-auto-gm-1',
  '/game/game-master.js?v=20260816-auto-gm-1',
  '/game/grid/index.html',
  '/game/grid/grid.css?v=20260817-grid-2',
  '/game/grid/grid-core.js?v=20260817-grid-2',
  '/game/grid/grid.js?v=20260817-grid-2',
  '/game/vault/index.html',
  '/game/vault/vault.css?v=20260812-vault-run-1',
  '/game/vault/vault.js?v=20260817-grid-2',
  '/game/chosung/index.html',
  '/game/chosung/chosung.css?v=20260811-chosung-party-2',
  '/game/chosung/chosung.js?v=20260817-grid-2',
  '/game/chosung/restart-cleanup.js?v=20260817-grid-2',
  '/game/mind/index.html',
  '/game/mind/mind.js?v=20260817-grid-2',
  '/game/naming/index.html',
  '/game/naming/naming.css?v=20260817-naming-1',
  '/game/naming/naming-core.js?v=20260817-naming-1',
  '/game/naming/naming.js?v=20260817-naming-1',
  '/js/theme-init.js?v=20260816-play-brand-1',
  '/js/firebase.js?v=20260729-auth-session-1',
  '/js/firebase-config.js',
  '/site.webmanifest?v=20260816-play-brand-1',
  '/logo.png?v=20260816-play-brand-1',
  '/icons/sosoking-192.png?v=20260816-play-brand-1',
  '/icons/sosoking-512.png?v=20260816-play-brand-1',
  '/icons/sosoking-maskable-512.png?v=20260816-play-brand-1',
  '/icons/favicon-32.png?v=20260816-play-brand-1',
  '/icons/favicon-48.png?v=20260816-play-brand-1',
  '/og-image.png?v=20260816-play-brand-1'
];

const GAME_FALLBACKS = [
  ['/game/grid', '/game/grid/index.html'],
  ['/game/vault', '/game/vault/index.html'],
  ['/game/chosung', '/game/chosung/index.html'],
  ['/game/mind', '/game/mind/index.html'],
  ['/game/naming', '/game/naming/index.html'],
  ['/game', '/game/index.html']
];

const STATIC_ASSET = /\.(?:js|css|svg|png|webp|jpg|jpeg|woff2)$/i;
const NETWORK_FIRST = /\.(?:json|webmanifest)$/i;

async function cacheResponse(request, response) {
  if (!response?.ok || response.type === 'opaque') return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
}

async function networkFirst(request, fallback) {
  try {
    const response = await fetch(request);
    await cacheResponse(request, response);
    return response;
  } catch (error) {
    const cached = await caches.match(request) || (fallback ? await caches.match(fallback) : null);
    if (cached) return cached;
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const network = fetch(request).then(async response => {
    await cacheResponse(request, response);
    return response;
  }).catch(() => null);
  if (cached) {
    void network;
    return cached;
  }
  const response = await network;
  if (response) return response;
  throw new Error('Network and cache unavailable');
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => Promise.allSettled(APP_SHELL.map(url => cache.add(url)))));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('sosoking-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    const route = GAME_FALLBACKS.find(([prefix]) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`));
    event.respondWith(networkFirst(request, route?.[1] || '/index.html'));
    return;
  }

  if (STATIC_ASSET.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
  if (NETWORK_FIRST.test(url.pathname)) event.respondWith(networkFirst(request));
});
