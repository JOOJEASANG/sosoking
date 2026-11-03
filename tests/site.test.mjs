import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {Script} from 'node:vm';
const html=readFileSync('index.html','utf8');
const scripts=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
assert.equal(scripts.length,1,'Expect exactly one browser inline script');
for(const [,content] of scripts)new Script(content,{filename:'homepage.inline.js'});
for(const id of ['convert-btn','bulk-file','bulk-run','bulk-download','memory-form','memory-list','chat-form','screen','live-status','room-controls','live-screen','story-form','privacy']){
 assert.ok(html.includes('id="'+id+'"'),'Missing '+id);
}
assert.ok(html.includes('찾았'), 'Brand headline missing');
assert.ok(html.includes('현재 가입자 확인 아님')||html.includes('현재 번호인지'),'Privacy disclaimer missing');
assert.ok(html.includes('reconnect-preview/bootstrap-live.js'),'Chat bootstrap missing');
assert.ok(existsSync('site-assets/site.webmanifest'),'Manifest missing');
assert.ok(existsSync('site-assets/brand-mark.svg'),'Icon missing');
assert.ok(existsSync('site-assets/sitemap.xml'),'Sitemap missing');
assert.equal(JSON.parse(readFileSync('site-assets/site.webmanifest','utf8')).short_name,'추억킹');
console.log('Portal structure and browser JavaScript syntax OK');
