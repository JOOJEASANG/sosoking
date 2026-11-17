import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('dist-public');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
assert.equal(manifest.id,'/');
assert.equal(manifest.start_url,'/');
assert.equal(manifest.scope,'/');
assert.equal(manifest.display,'standalone');
assert.equal(manifest.theme_color,'#122e43');
assert.ok(manifest.name.includes('소소킹'));
const icons=[
  ['favicon-32.png',32],['icons/sosoking-180.png',180],
  ['icons/sosoking-192.png',192],['icons/sosoking-512.png',512],
  ['icons/sosoking-maskable-512.png',512]
];
for(const [file,size] of icons){
 const buffer=fs.readFileSync(path.join(root,file));
 assert.equal(buffer.subarray(0,8).toString('hex'),'89504e470d0a1a0a',file+' PNG signature');
 assert.equal(buffer.readUInt32BE(16),size,file+' width');
 assert.equal(buffer.readUInt32BE(20),size,file+' height');
 assert.ok(buffer.length>1000,file+' unexpectedly small');
}
for(const icon of manifest.icons) assert.ok(fs.existsSync(path.join(root,icon.src.replace(/^\//,''))));
for(const page of ['index.html','event.html','old-phone.html']){
 const html=fs.readFileSync(path.join(root,page),'utf8');
 assert.match(html,/rel="manifest"/,page);
 assert.match(html,/apple-touch-icon/,page);
 assert.match(html,/class="brand-symbol" src="\/icons\/sosoking.svg"/,page);
 assert.match(html,/data-install-app/,page);
 assert.match(html,/\/js\/pwa-install\.js/,page);
}
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
assert.match(sw,/request\.method !== 'GET'/);
assert.match(sw,/url\.origin !== self\.location\.origin/);
assert.match(sw,/staticPaths\.has\(url\.pathname\)/);
console.log('SOSOKING PWA verified: consistent logo, manifest, PNG sizes, install controls and cache policy.');
