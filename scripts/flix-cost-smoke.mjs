import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const items=JSON.parse(fs.readFileSync('dist-public/catalog.json','utf8'));
const first=items.find(w=>!w.hidden),added={...first,id:'regression-new-work',title:'비용 개선 회귀 검증 작품'};
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost'),p=path.join('dist-public',u.pathname.endsWith('/')?u.pathname+'index.html':u.pathname);
 try{res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.json')?'application/json':p.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(p))}catch{res.statusCode=404;res.end()}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
const cloud=`let calls=0;export function readPublicCatalog(){calls++;return calls===1?new Promise(r=>window.resolveCatalog=r):Promise.resolve(window.manualCatalog)}export async function readRecommendations(){return null}`;
async function viewer(options={}){
 const page=await browser.newPage({viewport:{width:900,height:500},...options});
 await page.route('https://**',r=>r.abort());
 await page.route('**/cloud-catalog.js',r=>r.fulfill({contentType:'text/javascript',body:cloud}));
 await page.route('https://www.youtube.com/iframe_api',r=>r.fulfill({contentType:'text/javascript',body:`window.YT={PlayerState:{PLAYING:1,PAUSED:2,ENDED:0},Player:class{constructor(id,o){this.o=o;window.mockPlayer=this;window.playerStarts=(window.playerStarts||0)+1;this.t=o.playerVars.start||0;setTimeout(()=>o.events.onReady(),0)}getCurrentTime(){return this.t}getDuration(){return 802}getPlayerState(){return 1}destroy(){}}};window.onYouTubeIframeAPIReady();`}));
 return page;
}
try{
 browser=await chromium.launch();const base='http://127.0.0.1:'+server.address().port;
 const page=await viewer(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(id=>localStorage.setItem('sosoking.flix.saved',JSON.stringify([id])),added.id);
 await page.goto(base+'/?work='+first.id+'&ep='+first.episodes[0].number);
 await page.getByRole('button',{name:'▶ 공유 회차 시청하기',exact:true}).waitFor();
 assert.ok(await page.evaluate(id=>JSON.parse(localStorage.getItem('sosoking.flix.saved')).includes(id),added.id),'provisional catalog must preserve favorites missing from the static snapshot');
 await page.setViewportSize({width:1280,height:800});assert.equal(await page.locator('#mainNav').evaluate(e=>getComputedStyle(e).position),'static');await page.setViewportSize({width:900,height:500});
 await page.getByRole('button',{name:'▶ 공유 회차 시청하기',exact:true}).click();
 await page.waitForFunction(()=>window.mockPlayer);
 assert.equal(await page.locator('#cinema').evaluate(e=>e.classList.contains('cinema-fallback')),false,'small desktop must not enter cinema automatically');
 await page.evaluate(data=>window.resolveCatalog(data),[...items,added]);
 await page.waitForFunction(()=>document.querySelector('#genres button'));
 assert.equal(await page.evaluate(()=>window.playerStarts),1,'late catalog must not restart unchanged video');
 await page.locator('#back').click();
 await page.getByRole('button',{name:'검색',exact:true}).click();await page.locator('#search').fill(added.title);
 await page.locator('#listing .work').filter({hasText:added.title}).waitFor();
 // A catalog published in another tab removes a hidden currently playing work.
 await page.goto(base+'/?work='+first.id+'&ep='+first.episodes[0].number);
 await page.getByRole('button',{name:'▶ 공유 회차 시청하기',exact:true}).click();
 await page.waitForFunction(()=>window.mockPlayer);
 await page.evaluate(async data=>{const m=await import('/data-cache.js');m.cachePublicValue(m.CATALOG_CACHE,data);window.dispatchEvent(new StorageEvent('storage',{key:m.CATALOG_CACHE}));},items.map(w=>w.id===first.id?{...w,hidden:true}:w));
 await page.locator('#watch').waitFor({state:'hidden'});assert.match(await page.locator('#notice').textContent(),/공개 목록이 변경/);
 assert.equal(errors.length,0,errors.join('; '));await page.close();

 // Cloud arrives while the fallback fetch is still pending: fallback must not win later.
 const delayed=await viewer();let release;
 const gate=new Promise(r=>release=r);await delayed.route('**/catalog.json',async r=>{await gate;await r.fulfill({json:items})});
 await delayed.goto(base);await delayed.waitForFunction(()=>typeof window.resolveCatalog==='function');
 await delayed.waitForTimeout(3700);await delayed.evaluate(data=>window.resolveCatalog(data),[added]);
 await delayed.locator('#hero').filter({hasText:added.title}).waitFor();const staticResponse=delayed.waitForResponse(r=>r.url().endsWith('/catalog.json'));release();
 await staticResponse;
 await delayed.evaluate(()=>new Promise(r=>setTimeout(r,100)));
 assert.match(await delayed.locator('#hero').textContent(),new RegExp(added.title));
 await delayed.evaluate(data=>window.manualCatalog=data,items);
 await delayed.locator('#refreshCatalog').click();await delayed.locator('#catalogRefreshStatus').filter({hasText:'최신 목록을 확인했습니다'}).waitFor();
 await delayed.locator('#refreshCatalog').click();assert.match(await delayed.locator('#catalogRefreshStatus').textContent(),/방금 확인/);await delayed.close();

 const admin=await browser.newPage();await admin.route('https://**',r=>r.abort());admin.on('dialog',d=>d.accept());
 await admin.goto(base+'/admin/');await admin.locator('#authMessage').filter({hasText:'Firebase 연결 준비'}).waitFor();
 await admin.evaluate(async items=>{
  document.body.classList.add('studio-authenticated');document.querySelector('#workspace').hidden=false;
  const a=await import('/admin/admin.js');a.setOnlineCatalog(items);a.selectWorkForEditing(items[0].id);
  const cs=[1,2].map(n=>({title:'AI 드라마 잠금 검증작 '+n+'화',creator:'테스트 채널',channelId:'UC'+'a'.repeat(22),videoId:'bbbbbbb000'+n,checkedAt:new Date().toISOString(),publishedAt:'2026-11-20',duration:'PT8M',verifiedPublic:true,autoKind:'드라마',typeHint:'review',discoveryKind:'series'}));
  a.setOnlineCandidates(cs);a.connectQuickPublish(async selections=>{await new Promise((resolve,reject)=>{window.finishPublish=resolve;window.failPublish=()=>reject(Error('연결 실패'))});const q=await import('/admin/quick-review.js'),plan=q.quickReviewPlan(a.getOnlineCatalog(),q.currentReviewGroups(cs).filter(g=>selections.some(x=>x.key===g.key)));a.acceptQuickCatalog(plan.items);return plan.published});
 },items);
 await admin.locator('#studioNav [data-panel=review]').click();await admin.locator('#quickAll').click();await admin.locator('#quickRegister').click();
 await admin.waitForFunction(()=>document.querySelector('#workspace').inert);
 assert.ok(await admin.locator('#publishProgress').isVisible());
 await assert.rejects(admin.locator('#studioNav [data-panel=works]').click({timeout:300}),/Timeout/);
 await admin.evaluate(()=>window.failPublish());await admin.waitForFunction(()=>!document.querySelector('#workspace').inert);
 assert.match(await admin.locator('#curationStatus').textContent(),/연결 실패/);
 await admin.locator('#quickRegister').click();await admin.waitForFunction(()=>document.querySelector('#workspace').inert);
 await admin.evaluate(()=>window.finishPublish());await admin.waitForFunction(()=>!document.querySelector('#workspace').inert);
 assert.match(await admin.locator('#curationStatus').textContent(),/공개 완료/);assert.ok(await admin.locator('#publishProgress').isHidden());
 assert.ok(await admin.evaluate(async()=>(await import('/admin/admin.js')).getOnlineCatalog().some(w=>w.title==='AI 드라마 잠금 검증작')));
 await admin.close();
 console.log('Cost/reliability browser regressions passed: late response, fallback race, playback, desktop cinema, refresh, cross-tab publication, editor lock and unlock');
}finally{await browser?.close();server.close()}
