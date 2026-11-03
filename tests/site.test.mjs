import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {Script} from 'node:vm';
const html=readFileSync('index.html','utf8');
const scripts=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
assert.equal(scripts.length,1,'Expect exactly one browser inline script');
for(const [,content] of scripts)new Script(content,{filename:'homepage.inline.js'});
for(const id of ['convert-btn','bulk-file','bulk-run','bulk-download','memory-form','memory-list','chat-form','screen','live-status','room-controls','live-screen','story-form','privacy','who-knows','find-nickname','find-kind','find-memory','find-message','find-copy','find-share']){
 assert.ok(html.includes('id="'+id+'"'),'Missing '+id);
}
assert.ok(html.includes('찾았'), 'Brand headline missing');
assert.ok(html.includes('절대 보이스피싱이 아닙니다~^^'),'Missing nostalgic warning tagline');
assert.ok(html.includes('누가 그 사람을'),'Missing reunion prompt');
assert.ok(html.includes('개인 연락처를 공개하지는 말아 주세요'),'Missing privacy-first sharing text');
assert.ok(html.includes('현재 가입자 확인 아님')||html.includes('현재 번호인지'),'Privacy disclaimer missing');
assert.ok(html.includes('reconnect-preview/bootstrap-live.js'),'Chat bootstrap missing');
assert.ok(existsSync('site-assets/site.webmanifest'),'Manifest missing');
assert.ok(existsSync('site-assets/brand-mark.svg'),'Icon missing');
assert.ok(existsSync('site-assets/sitemap.xml'),'Sitemap missing');
assert.equal(JSON.parse(readFileSync('site-assets/site.webmanifest','utf8')).short_name,'추억킹');
console.log('Portal structure and browser JavaScript syntax OK');
