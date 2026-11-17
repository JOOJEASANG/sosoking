import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const dir=path.resolve('public');
test('One icon and app installation controls are shared by every program',()=>{
 for(const page of ['index.html','event.html','old-phone.html']){
  const html=fs.readFileSync(path.join(dir,page),'utf8');
  assert.match(html,/href="\/manifest\.webmanifest"/);
  assert.match(html,/src="\/icons\/sosoking\.svg"/);
  assert.match(html,/data-install-app/);
  assert.match(html,/src="\/js\/pwa-install\.js"/);
  assert.doesNotMatch(html,/class="brand-symbol">S<\/span>/);
 }
});
test('PWA manifest uses site root and separate normal/maskable sizes',()=>{
 const m=JSON.parse(fs.readFileSync(path.join(dir,'manifest.webmanifest'),'utf8'));
 assert.equal(m.display,'standalone');
 assert.equal(m.id,'/');
 assert.equal(m.start_url,'/');
 assert.equal(m.scope,'/');
 assert.ok(m.icons.some(i=>i.sizes==='192x192'&&i.purpose==='any'));
 assert.ok(m.icons.some(i=>i.sizes==='512x512'&&i.purpose==='maskable'));
});
test('Service worker cannot cache user submissions or external Firebase APIs',()=>{
 const sw=fs.readFileSync(path.join(dir,'sw.js'),'utf8');
 assert.match(sw,/staticPaths\.has\(url\.pathname\)/);
 assert.match(sw,/url\.origin !== self\.location\.origin/);
 assert.doesNotMatch(sw,/indexedDB|firestore\.googleapis\.com|identitytoolkit\.googleapis\.com/);
});
