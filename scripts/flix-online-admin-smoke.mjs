import {chromium} from 'playwright';import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost');const p=path.join('dist-public',u.pathname==='/'?'index.html':u.pathname.endsWith('/')?u.pathname+'index.html':u.pathname);try{res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.json')?'application/json':p.endsWith('.css')?'text/css':p.endsWith('.webp')?'image/webp':'text/html');res.end(fs.readFileSync(p))}catch{res.statusCode=404;res.end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{browser=await chromium.launch();const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/admin/');await page.locator('#authMessage').filter({hasText:'Firebase 연결 준비'}).waitFor();assert.ok(await page.locator('#workspace').isHidden());for(const id of ['trackEnabled','trackAuto','workHidden','manualLookup','trackReport','healthReport','viewerDashboard','statLive','statWatching','statsRefresh','studioNav','studioTitle','candidateRefresh','candidateKind','candidateSort','featured','featuredFixed','intakeAdmin','intakeReload','opsAdmin','searchBudget','trackSuggestions','healthList','healthRefresh','workSearch','editState','studioDraft','cloudStatus'])assert.equal(await page.locator('#'+id).count(),1);assert.ok(await page.locator('#loginButton').isDisabled());assert.equal(errors.length,0,errors.join('; '));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.ok(await page.locator('#authPanel').evaluate(el=>el.getBoundingClientRect().width<=innerWidth));console.log('Online admin fails closed without configuration; mobile login UI passed');
 // Exercise the real studio panel switcher using a DOM-only fixture after the
 // fail-closed assertion above. This does not authenticate or contact Firebase.
 await page.evaluate(()=>{
   document.body.classList.add('studio-authenticated');
   document.querySelector('#workspace').hidden=false;
   for(const id of ['loginForm','googleLogin'])document.getElementById(id).hidden=true;
   const account=document.querySelector('#accountInfo');account.hidden=false;
   account.textContent='계정: '+ 'long-admin-account-'.repeat(10)+'@example.test / UID: '+ 'x'.repeat(90);
   document.querySelector('#logout').hidden=false;
   document.querySelector('#authMessage').textContent='관리자 인증 완료';
   document.querySelector('#intakeStatus').textContent='테스트 데이터';
   const option=document.createElement('option');option.textContent='긴작품명'.repeat(80);document.querySelector('#works').append(option);
   const candidate=document.createElement('article');candidate.className='candidate-group';candidate.innerHTML='<div class="candidate-heading"><strong></strong></div><div class="candidate-actions"><button>선택한 연속 회차를 모두 작품에 추가</button><button>다음 수집에서 제외</button></div>';candidate.querySelector('strong').textContent='A'.repeat(180);document.querySelector('#candidates').append(candidate);
   const link=document.createElement('article');link.className='link-row';link.innerHTML='<input type="checkbox"><img alt=""><div><strong></strong></div>';link.querySelector('strong').textContent='B'.repeat(180);document.querySelector('#linkResults').append(link);
   const row=document.createElement('div');row.className='stat-row';row.innerHTML='<span></span><div class="stat-bar"></div><strong>123456789012345</strong>';row.querySelector('span').textContent='긴작품명'.repeat(50);document.querySelector('#statRank').append(row);
 });
 for(const width of [320,360,390,412,768,900,1024,1440]){
   await page.setViewportSize({width,height:844});
   for(const panel of ['overview','works','links','review','intake','ops','backup']){
     const tab=page.locator('#studioNav button[data-panel="'+panel+'"]');
     if(width<=600&&['intake','ops','backup'].includes(panel))await page.locator('#studioMore').click();
     await tab.click();
     assert.equal(await tab.getAttribute('aria-pressed'),'true');
     assert.ok(await page.locator('section[data-studio-panel="'+panel+'"]').first().isVisible());
     const result=await page.evaluate(()=>{
       const w=innerWidth;
       const selectors='#authPanel,.workspace-shell,.studio-sidebar,.studio-content,#studioNav button,#studioActions button,section[data-studio-panel],section[data-studio-panel] button,section[data-studio-panel] input,section[data-studio-panel] select,section[data-studio-panel] textarea';
       return {scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll(selectors)].filter(el=>el.getClientRects().length).map(el=>({name:el.id||el.tagName,rect:el.getBoundingClientRect()})).filter(({rect:r})=>r.left< -1||r.right>w+1).map(x=>x.name)};
     });
     assert.ok(result.scroll<=width+1 && !result.overflow.length,width+'px '+panel+': '+JSON.stringify(result));
   }
   const columns=await page.locator('.workspace-shell').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
   assert.equal(columns,width<=900?1:2);
 }

 // Mobile menu, edit dock and collapsible episode editor. Load the real
 // editor with a local catalog fixture: draft state must come from actual
 // input/change events, not a synthetic status that a blur can overwrite.
 await page.setViewportSize({width:390,height:844});
 await page.locator('#studioNav [data-panel=works]').click();
 await page.evaluate(async()=>{
   const admin=await import('/admin/admin.js');
   const items=await (await fetch('/catalog.json')).json();
   admin.setOnlineCatalog(items);
   if(!admin.selectWorkForEditing(items[0].id))throw Error('Fixture selection failed');
   document.querySelector('#publish').disabled=false;
 });
 const dock=page.locator('#studioMobileDock');
 assert.ok(await dock.isVisible());
 assert.ok(await page.locator('#mobilePublish').isDisabled());
 const existing=page.locator('#episodes article').first();
 assert.equal(await existing.locator('details').getAttribute('open'),null);
 const originalTitle=await page.locator('#editor [name=title]').inputValue();
 await page.locator('#editor [name=title]').fill(originalTitle+' 모바일 편집');
 assert.match(await page.locator('#mobileDraftState').textContent(),/미저장/);
 await page.locator('#studioNav [data-panel=review]').click();
 assert.ok(await dock.isVisible());
 assert.equal(await page.locator('#mobileSave').textContent(),'편집으로 이동');
 assert.ok(await page.locator('#mobilePublish').isDisabled());
 await page.locator('#mobileSave').click();
 assert.equal(await page.locator('#studioTitle').textContent(),'작품 및 회차');
 assert.equal(await page.locator('#editor [name=title]').inputValue(),originalTitle+' 모바일 편집');
 await page.locator('#mobileSave').click();
 await page.waitForFunction(()=>document.querySelector('#mobileDraftState').textContent==='공개 반영 대기');
 const draftTitle=await page.evaluate(async()=>{const admin=await import('/admin/admin.js');return admin.getOnlineCatalog()[0].title});
 assert.equal(draftTitle,originalTitle+' 모바일 편집');
 // Mock only the actual publishing handler; never contact production.
 await page.evaluate(()=>{const b=document.querySelector('#publish');window.testPublishCount=0;b.onclick=()=>window.testPublishCount++});
 await page.locator('#mobilePublish').click();
 assert.equal(await page.evaluate(()=>window.testPublishCount),1);
 await page.locator('#addEpisode').click();
 const episode=page.locator('#episodes article').last(),details=episode.locator('details');
 assert.equal(await details.getAttribute('open'),'');
 await episode.locator('[data-field=title]').fill('모바일 테스트 회차');
 assert.match(await episode.locator('summary').textContent(),/모바일 테스트 회차/);
 await episode.locator('summary').click();
 assert.equal(await details.getAttribute('open'),null);
 assert.ok(await episode.locator('[data-field=title]').isHidden());
 await episode.locator('summary').click();
 assert.equal(await episode.locator('[data-field=title]').inputValue(),'모바일 테스트 회차');
 await page.locator('#studioMore').click();
 assert.ok(await page.locator('#studioMoreMenu').isVisible());
 await page.keyboard.press('Escape');
 assert.ok(await page.locator('#studioMoreMenu').isHidden());
 await page.evaluate(()=>{document.activeElement.blur();window.scrollTo(0,document.documentElement.scrollHeight)});
 const nav=await page.locator('.studio-sidebar').evaluate(el=>({bottom:el.getBoundingClientRect().bottom,viewport:innerHeight,position:getComputedStyle(el).position}));
 assert.equal(nav.position,'fixed');assert.ok(Math.abs(nav.bottom-nav.viewport)<=2);

 // Use a mocked worker result, but real admin draft creation and validation.
 await page.locator('#studioNav [data-panel=links]').click();
 assert.ok(await page.locator('#seriesLookup').isVisible());
 await page.evaluate(async()=>{const admin=await import('/admin/admin.js');admin.connectOnlineLookup(async input=>{window.lookupRequest=input;return null});document.querySelector('#links').value='https://youtu.be/aaaaaaa0001'});
 await page.locator('#seriesLookup').click();
 assert.equal(await page.evaluate(()=>window.lookupRequest),'series:https://youtu.be/aaaaaaa0001');
 await page.evaluate(async()=>{const admin=await import('/admin/admin.js');const items=[1,2,3].map(n=>({title:'AI 드라마 검증작 '+n+'화',creator:'테스트 채널',videoId:'aaaaaaa000'+n,episodeHint:n,duration:'PT8M',publishedAt:'2026-11-20',source:'https://youtu.be/aaaaaaa000'+n,autoKind:'드라마'}));admin.setOnlineLookupResult({verified:true,items,rejected:[],channels:[],playlists:[],series:{matchTitle:'AI 드라마 검증작',count:3,complete:true,warnings:[]}})});
 await page.locator('#reviewed').check();
 await page.locator('#linkResults input[type=checkbox]').nth(1).uncheck();
 await page.locator('#newFromLinks').click();
 assert.match(await page.locator('#lookupStatus').textContent(),/연속된 회차/);
 await page.locator('#linkResults input[type=checkbox]').nth(1).check();
 page.once('dialog',d=>d.accept());
 await page.locator('#newFromLinks').click();
 assert.equal(await page.locator('#editor [name=title]').inputValue(),'AI 드라마 검증작');
 assert.equal(await page.locator('#episodes article').count(),3);
 assert.ok(await page.locator('#trackEnabled').isChecked());
 assert.ok(await page.locator('#trackAuto').isChecked());
 await page.locator('#mobileSave').click();
 await page.waitForFunction(()=>document.querySelector('#mobileDraftState').textContent==='공개 반영 대기');
 await page.setViewportSize({width:1280,height:800});
 assert.ok(await dock.isHidden());assert.ok(await page.locator('#studioNav [data-panel=backup]').isVisible());
 assert.equal(errors.length,0,errors.join('; '));
 console.log('Admin workspace responsive layout passed for all seven panels at eight viewport widths');
 }finally{await browser?.close();server.close()}
