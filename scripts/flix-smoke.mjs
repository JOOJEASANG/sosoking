import {chromium} from 'playwright';import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost');const p=path.join('dist-public',u.pathname.endsWith('/')?u.pathname+'index.html':u.pathname);try{const data=fs.readFileSync(p);res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.json')?'application/json':p.endsWith('.css')?'text/css':p.endsWith('.webp')?'image/webp':p.endsWith('.png')?'image/png':p.endsWith('.webmanifest')?'application/manifest+json':'text/html');res.end(data)}catch{res.statusCode=404;res.end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});try{const page=await browser.newPage({viewport:{width:412,height:840},hasTouch:true});await page.route('https://i.ytimg.com/**',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360"><rect width="480" height="360" fill="#333"/></svg>'}));await page.route('https://www.youtube.com/iframe_api',route=>route.fulfill({contentType:'application/javascript',body:'window.YT={PlayerState:{PLAYING:1,PAUSED:2,ENDED:0},Player:class{constructor(id,o){this.o=o;window.mockPlayer=this;this.t=o.playerVars.start||0;setTimeout(()=>o.events.onReady(),0)}getCurrentTime(){return this.t}getDuration(){return 802}getPlayerState(){return this.state??1}destroy(){}}};window.onYouTubeIframeAPIReady();'}));const base='http://127.0.0.1:'+server.address().port;await page.goto(base+'/works/seocho-24/?ep=2');await page.locator('.shared-episode').waitFor();assert.match(await page.locator('#seoPlay').getAttribute('href'),/work=seocho-24&ep=2/);assert.equal(await page.locator('.shared-episode').getAttribute('data-episode'),'2');await page.goto(base+'/works/seocho-24/?ep=999');await page.waitForFunction(()=>document.getElementById('seoPlay')?.textContent.includes('최신 등록 상태 확인'));assert.match(await page.locator('#seoPlay').getAttribute('href'),/work=seocho-24&ep=999/);await page.goto(base+'/creators/');assert.ok(await page.locator('.seo-list a').count()>0);await page.goto(base);await page.locator('#hero').waitFor({state:'visible'});await page.getByRole('button',{name:'TV 모드',exact:true}).click();assert.ok(await page.locator('body').evaluate(x=>x.classList.contains('tv-mode')));await page.keyboard.press('Escape');assert.ok(await page.locator('#tvHelp').isHidden());await page.getByRole('button',{name:'작품 제보',exact:true}).click();assert.ok(await page.locator('#submitPanel').isVisible());await page.getByRole('button',{name:'인기 작품',exact:true}).click();assert.match(await page.locator('#pageTitle').textContent(),/인기 작품/);await page.getByRole('button',{name:'홈',exact:true}).click();await page.locator('#bingeHub').waitFor({state:'visible'});await page.getByRole('button',{name:'제작자 둘러보기',exact:true}).click();await page.locator('.creator-grid button').first().click();await page.getByRole('button',{name:'제작자 팔로우',exact:true}).click();assert.ok(await page.getByRole('button',{name:'팔로우 해제',exact:true}).isVisible());await page.getByRole('button',{name:'홈',exact:true}).click();await page.locator('[data-budget="10"]').click();assert.equal(await page.locator('[data-budget="10"]').getAttribute('aria-pressed'),'true');await page.getByRole('button',{name:'신규 회차',exact:true}).click();assert.ok(await page.locator('#calendarPanel').isVisible());await page.locator('#calendarPrev').click();await page.getByRole('button',{name:'내 보관함',exact:true}).click();assert.ok(await page.locator('#personalPanel').isVisible());await page.getByRole('button',{name:'홈',exact:true}).click();await page.locator('.brand-logo').evaluate(img=>img.decode());assert.equal(await page.locator('.brand-logo').evaluate(img=>img.naturalWidth),480);for(const [url,size] of [['/icons/ai-brand-192.png',192],['/icons/ai-brand-512.png',512],['/icons/ai-brand-maskable-512.png',512]]){const dimensions=await page.evaluate(async url=>{const img=new Image();img.src=url;await img.decode();return [img.naturalWidth,img.naturalHeight]},url);assert.deepEqual(dimensions,[size,size])}assert.ok(await page.locator('#mainNav').isVisible());assert.equal(await page.locator('#mainNav').evaluate(el=>getComputedStyle(el).position),'fixed');const verifyBottom=async()=>{const g=await page.locator('#mainNav').evaluate(el=>{const r=el.getBoundingClientRect();return {bottom:r.bottom,top:r.top,height:r.height,viewport:innerHeight,headerFilter:getComputedStyle(el.parentElement).backdropFilter,outsideHeader:!el.closest('header'),position:getComputedStyle(el).position}});assert.equal(g.position,'fixed');assert.equal(g.headerFilter,'none');assert.ok(g.outsideHeader);assert.ok(Math.abs(g.bottom-g.viewport)<=2,JSON.stringify(g));assert.ok(g.top>g.viewport/2,JSON.stringify(g))};await verifyBottom();assert.ok(await page.locator('#seoDiscovery').isHidden());assert.ok(await page.locator('#seoDiscovery a[href="/works/"]').count());assert.ok(await page.locator('#seoDiscovery a[href="/creators/"]').count());await page.evaluate(()=>window.scrollTo(0,Math.min(600,document.documentElement.scrollHeight-innerHeight)));await verifyBottom();await page.evaluate(()=>window.scrollTo(0,0));await page.setViewportSize({width:320,height:700});await verifyBottom();await page.setViewportSize({width:1280,height:800});assert.equal(await page.locator('#mainNav').evaluate(el=>getComputedStyle(el).position),'fixed');await page.setViewportSize({width:412,height:840});await verifyBottom();await page.getByRole('button',{name:'검색',exact:true}).click();await page.locator('#search').fill('오늘, 사랑');assert.equal(await page.locator('#listing .work').count(),1);
// Local search recovery must reset every constraint without another catalog request.
await page.locator('#search').fill('존재하지 않는 작품 UX 검증');
assert.match(await page.locator('#resultSummary').textContent(),/작품 0개/);
assert.ok(await page.getByRole('heading',{name:'조건에 맞는 작품이 없어요'}).isVisible());
await page.locator('#statusFilter').selectOption('완결');
await page.locator('#timeFilter').selectOption('10');
await page.locator('#listing .empty-state button').click();
assert.equal(await page.locator('#search').inputValue(),'');
assert.equal(await page.locator('#statusFilter').inputValue(),'');
assert.equal(await page.locator('#timeFilter').inputValue(),'');
assert.ok(await page.locator('#listing .work').count()>1);
assert.ok(await page.locator('#resetFilters').isHidden());
await page.locator('#search').fill('서초동');await page.locator('#clearSearch').click();
assert.equal(await page.locator('#search').inputValue(),'');
assert.equal(await page.evaluate(()=>document.activeElement.id),'search');
await page.getByRole('button',{name:'홈',exact:true}).click();await page.getByRole('button',{name:/서초동 24시 바로 시청/}).click();await page.waitForFunction(()=>!!window.mockPlayer);assert.equal(await page.locator('#full').textContent(),'극장 모드');assert.ok(await page.locator('#episodes .episode').first().isVisible());assert.ok(await page.evaluate(()=>!document.fullscreenElement&&!document.querySelector('#cinema').classList.contains('cinema-fallback')));assert.match(await page.locator('#watchTitle').textContent(),/1화/);await page.evaluate(()=>{window.mockPlayer.state=2;window.mockPlayer.o.events.onError({data:150})});assert.match(await page.locator('#playerStatus').textContent(),/외부 재생/);assert.ok(await page.locator('#skipFailed').isVisible());await page.evaluate(()=>window.mockPlayer.o.events.onStateChange({data:0}));assert.match(await page.locator('#watchTitle').textContent(),/1화/);await page.locator('#skipFailed').click();await page.waitForFunction(()=>window.mockPlayer.o.playerVars.start===802);await page.evaluate(()=>{if(document.fullscreenElement)return document.exitFullscreen()});if(await page.locator('#cinema').evaluate(el=>el.classList.contains('cinema-fallback')))await page.locator('#full').click();await page.locator('#back').click();await page.getByRole('button',{name:/서초동 24시 바로 시청/}).click();await page.waitForFunction(()=>window.mockPlayer.o.playerVars.start===0);await page.setViewportSize({width:840,height:412});await page.waitForFunction(()=>document.querySelector('#cinema').classList.contains('cinema-fallback'));assert.equal(await page.locator('#full').textContent(),'극장 모드 종료');await page.evaluate(()=>window.mockPlayer.o.events.onStateChange({data:1}));await page.locator('#cinemaBar').waitFor({state:'hidden',timeout:7000});assert.ok(await page.locator('#cinemaReveal').isVisible());const hiddenHeight=await page.locator('#playerWrap').evaluate(el=>el.clientHeight);await page.locator('#cinemaReveal').click();await page.locator('#cinemaBar').waitFor({state:'visible'});const shownHeight=await page.locator('#playerWrap').evaluate(el=>el.clientHeight);assert.ok(hiddenHeight>shownHeight);await page.evaluate(()=>{document.activeElement.blur();window.mockPlayer.state=1});await page.locator('#cinemaBar').waitFor({state:'hidden',timeout:7000});await page.evaluate(()=>{window.mockPlayer.state=2;window.mockPlayer.o.events.onStateChange({data:2})});await page.locator('#cinemaBar').waitFor({state:'visible'});await page.evaluate(()=>{window.mockPlayer.state=1;window.mockPlayer.o.events.onStateChange({data:1})});await page.locator('#cinemaBar').waitFor({state:'hidden',timeout:7000});await page.evaluate(()=>{window.mockPlayer.t=790});await page.locator('#nextPrompt').waitFor({state:'visible'});await page.locator('#nextPrompt').click();await page.waitForFunction(()=>window.mockPlayer.o.playerVars.start===802);assert.match(await page.locator('#watchTitle').textContent(),/2화/);await page.evaluate(()=>{window.mockPlayer.t=1754;window.mockPlayer.o.events.onStateChange({data:0})});await page.waitForFunction(()=>window.mockPlayer.o.playerVars.start===1754);assert.match(await page.locator('#watchTitle').textContent(),/3화/);await page.setViewportSize({width:412,height:840});await page.waitForFunction(()=>!document.querySelector('#cinema').classList.contains('cinema-fallback'));assert.ok(await page.locator('#episodes .episode').first().isVisible());assert.equal(await page.locator('#full').textContent(),'극장 모드');await page.evaluate(()=>{if(document.fullscreenElement)return document.exitFullscreen();});if(await page.locator('#cinema').evaluate(el=>el.classList.contains('cinema-fallback')))await page.locator('#full').click();await page.locator('#back').click();await page.getByRole('button',{name:'내 보관함'}).click();assert.ok(await page.locator('#listing').isVisible());await page.getByRole('button',{name:'홈',exact:true}).click();await page.setViewportSize({width:320,height:700});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.getByRole('button',{name:'작품 제보',exact:true}).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.getByRole('button',{name:'홈',exact:true}).click();await page.setViewportSize({width:820,height:600});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.evaluate(()=>{localStorage.setItem('sosoking.flix.history',JSON.stringify({'seocho-24:1':{time:802,done:true,updated:Date.now()}}))});await page.reload();await page.getByRole('button',{name:'내 보관함'}).click();await page.getByRole('button',{name:'서초동 24시 2화',exact:true}).waitFor();
 // Geometry checks cover every navigation tab, thumbnails with 4:3 source
 // attributes, long titles, spoiler placeholders and failed image loading.
 const audit=async(label)=>{
   const m=await page.evaluate(()=>{
     const vw=innerWidth, visible=el=>el.getClientRects().length>0;
     const out=[...document.querySelectorAll('main,.intro,#hero,#quickTools,#searchArea,#search,#filters,#filters select,#watch,.watch-layout,.watch-main,.episode-panel,#cinema,#playerWrap,#cinemaBar,#submitWorkForm,#submitLink,#submitKind,.site-footer,.footer-settings,#mainNav button')].filter(visible).map(el=>({id:el.id||el.className,r:el.getBoundingClientRect()})).filter(x=>x.r.left< -1||x.r.right>vw+1).map(x=>x.id);
     const thumbs=[...document.querySelectorAll('.work .art img,.episode-panel .episode img,.episode-panel .episode-placeholder,.seo-thumb')].filter(visible).map(el=>{const r=el.getBoundingClientRect();return [r.width,r.height]});
     return {vw,scroll:document.documentElement.scrollWidth,out,wrong:thumbs.filter(([w,h])=>w>0&&Math.abs(h-w*9/16)>1.5)};
   });
   assert.ok(m.scroll<=m.vw+1&&!m.out.length&&!m.wrong.length,label+' '+JSON.stringify(m));
 };
 const tabs=['home','browse','latest','search','my','creator','hall','submit'];
 for(const [width,height] of [[320,700],[360,800],[390,844],[412,840],[768,1024],[840,412],[1000,700],[1280,800],[1440,900]]){
   await page.setViewportSize({width,height});
   for(const name of tabs){
     await page.locator('button[data-tab="'+name+'"]').first().click();
     await audit(width+'x'+height+' '+name);
     if(width<=1000)await verifyBottom();
   }
   await page.getByRole('button',{name:'홈',exact:true}).click();
   await page.getByRole('button',{name:/서초동 24시 바로 시청/}).click();
   await page.waitForFunction(()=>!!window.mockPlayer);
   if(width>=1280||width<height){assert.equal(await page.locator('#full').textContent(),'극장 모드');assert.ok(await page.evaluate(()=>!document.fullscreenElement&&!document.querySelector('#cinema').classList.contains('cinema-fallback')));}
   await page.evaluate(async()=>{if(document.fullscreenElement)await document.exitFullscreen()});
   if(await page.locator('#cinema').evaluate(el=>el.classList.contains('cinema-fallback')))await page.locator('#full').click();
   await page.locator('#episodes .episode').first().waitFor();
   await audit(width+'x'+height+' watch');
   if(width===320){
     const first=page.locator('#episodes .episode').first();
     const img=first.locator('img');
     await img.evaluate(el=>{el.onerror?.();el.removeAttribute('src');el.classList.add('unavailable-thumb')});
     const oldTitle=await first.locator('.episode-copy strong').textContent();
     await first.locator('.episode-copy strong').evaluate(el=>el.textContent='긴회차제목'.repeat(35)+'A'.repeat(80));
     await audit('320px failed image + very long episode title');
     await first.locator('.episode-copy strong').evaluate((el,text)=>el.textContent=text,oldTitle);
   }
   await page.locator('#spoiler').check();
   await audit(width+'x'+height+' spoiler');
   await page.locator('#spoiler').uncheck();
   await page.locator('#reverse').check();
   await audit(width+'x'+height+' reverse');
   await page.locator('#reverse').uncheck();
   await page.locator('#ytSocial summary').click();
   await audit(width+'x'+height+' social');
   await page.locator('#back').click();
 }
 // Keep the viewer footer on the same centered shell and content edges,
 // including wide desktop monitors; mobile must still fill the viewport.
 await page.getByRole('button',{name:'홈',exact:true}).click();
 for(const width of [320,390,1000,1050,1051,1280,1440,1920,2560]){
   await page.setViewportSize({width,height:900});
   const geometry=await page.evaluate(()=>{
     const edges=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {left:r.left,right:r.right,width:r.width,contentLeft:r.left+parseFloat(s.paddingLeft),contentRight:r.right-parseFloat(s.paddingRight)}};
     return {main:edges(document.querySelector('#mainContent')),footer:edges(document.querySelector('#siteFooter')),vw:document.documentElement.clientWidth};
   });
   const {main,footer,vw}=geometry;
   assert.ok(Math.abs(main.left-footer.left)<=1&&Math.abs(main.right-footer.right)<=1&&Math.abs(main.contentLeft-footer.contentLeft)<=1&&Math.abs(main.contentRight-footer.contentRight)<=1,'footer/main alignment '+width+' '+JSON.stringify(geometry));
   assert.ok(Math.abs(main.width-Math.min(vw,width>=1051?1320:1180))<=1,'preserve viewer shell '+width+' '+JSON.stringify(geometry));
 }
 await page.setViewportSize({width:320,height:700});
 await page.goto(base+'/works/seocho-24/?ep=2');
 await page.locator('.seo-thumb').waitFor();
 await audit('320px SEO work detail');
 await page.goto(base+'/creators/');
 await audit('320px SEO creator list');

 // Touch/coarse-pointer mode also uses the bottom menu beyond the normal
 // mobile-width breakpoint (e.g. a wide foldable or tablet).
 const touch=await browser.newPage({viewport:{width:1100,height:700},hasTouch:true,isMobile:true});
 try{
   await touch.route('https://i.ytimg.com/**',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="480" height="360" fill="#333"/></svg>'}));
   await touch.goto(base);await touch.locator('#hero').waitFor({state:'visible'});
   assert.ok(await touch.evaluate(()=>matchMedia('(hover:none) and (pointer:coarse)').matches));
   for(const [width,height] of [[1100,700],[390,844],[844,390]]){
     await touch.setViewportSize({width,height});
     const g=await touch.locator('#mainNav').evaluate(el=>({bottom:el.getBoundingClientRect().bottom,height:innerHeight,position:getComputedStyle(el).position,scroll:document.documentElement.scrollWidth,width:innerWidth}));
     assert.equal(g.position,'fixed');assert.ok(Math.abs(g.bottom-g.height)<=2,JSON.stringify(g));assert.ok(g.scroll<=g.width+1,JSON.stringify(g));
   }
 }finally{await touch.close()}
  console.log('Viewer responsive geometry: nine viewport sizes, eight tabs, watch, spoiler, reverse, social and SEO detail passed');
 console.log('Mobile viewer smoke passed (mock player; no live video claim)')}finally{await browser.close();server.close()}