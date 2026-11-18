import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('dist-public');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
assert.equal(manifest.id,'/');
assert.equal(manifest.start_url,'/');
assert.equal(manifest.scope,'/');
assert.equal(manifest.display,'standalone');
assert.ok(manifest.name.includes('소소킹'));
for(const [file,size] of [['favicon-32.png',32],['icons/sosoking-180.png',180],['icons/sosoking-192.png',192],['icons/sosoking-512.png',512],['icons/sosoking-maskable-512.png',512]]){
 const binary=fs.readFileSync(path.join(root,file));
 assert.equal(binary.subarray(0,8).toString('hex'),'89504e470d0a1a0a',file);
 assert.equal(binary.readUInt32BE(16),size,file);
 assert.equal(binary.readUInt32BE(20),size,file);
}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const required of ['src="/js/daily.js"','rel="manifest"','apple-touch-icon','data-install-app','id="dailyGrid"','id="catalogGrid"']){
 assert.ok(html.includes(required),required);
}
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
assert.match(sw,/request.method !== 'GET'/);
assert.match(sw,/staticPaths.has\(url.pathname\)/);
console.log('Daily Check PWA passed');
