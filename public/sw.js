/* Cache only public static app shell, never user diaries, Firestore data or authentication. */
const CACHE='sosoking-life-shell-v2';
const STATIC=['/','/index.html','/daily.html','/old-phone.html','/event.html','/community.html','/ferry.html','/orders.html','/shift.html','/loans.html','/my.html','/help.html','/css/life.css','/js/life.js','/js/phone.js','/js/phone-rules.js','/css/site.css','/js/daily.js','/js/pwa-install.js',
 '/manifest.webmanifest','/icons/sosoking.svg','/icons/sosoking-180.png',
 '/icons/sosoking-192.png','/icons/sosoking-512.png','/icons/sosoking-maskable-512.png','/favicon-32.png'];
const staticPaths=new Set(STATIC);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(STATIC)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([
 caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&(k.startsWith('sosoking-static-')||k.startsWith('sosoking-daily-')||k.startsWith('sosoking-life-'))).map(k=>caches.delete(k)))),
 self.clients.claim()
])));
self.addEventListener('fetch',event=>{
 const request=event.request;if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.search||url.origin!==self.location.origin||!staticPaths.has(url.pathname))return;
 event.respondWith(fetch(request).then(response=>{
  if(response.ok&&response.type==='basic'){
   const copy=response.clone();
   event.waitUntil(caches.open(CACHE).then(cache=>cache.put(url.pathname,copy)));
  }
  return response;
 }).catch(async()=>(await caches.match(url.pathname))||Response.error()));
});
