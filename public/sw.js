// Retire the old app shell. Network-first avoids serving old services or withdrawn news.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())await caches.delete(key);await self.clients.claim();await self.registration.unregister();})()));
