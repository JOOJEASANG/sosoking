const CACHE = 'sosoking-casefiles-v1';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(['/','/index.html','/css/casefiles.css?v=1','/js/casefiles-app.js?v=1','/js/casefiles-data.js'])).catch(()=>{}));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('sosoking-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const r=event.request;
  if(r.method!=='GET'||new URL(r.url).origin!==self.location.origin||new URL(r.url).pathname.startsWith('/admin'))return;
  if(r.mode==='navigate')event.respondWith(fetch(r).catch(()=>caches.match('/index.html')));
});