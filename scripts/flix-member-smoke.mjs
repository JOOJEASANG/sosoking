import {chromium} from 'playwright';import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost');const p=path.join('dist-public',u.pathname.endsWith('/')?u.pathname+'index.html':u.pathname);try{res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.json')?'application/json':p.endsWith('.css')?'text/css':p.endsWith('.webp')?'image/webp':p.endsWith('.png')?'image/png':'text/html');res.end(fs.readFileSync(p))}catch{res.statusCode=404;res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch();const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base='http://127.0.0.1:'+server.address().port;
 await page.route('https://i.ytimg.com/**',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="480" height="360" fill="#333"/></svg>'}));
 // First test the actual bundled adapter: missing configuration cannot stop guest viewing.
 await page.goto(base);await page.locator('#hero').waitFor({state:'visible'});await page.locator('#memberAccount').click();
 await page.waitForFunction(()=>document.querySelector('#memberStatus').textContent.includes('준비하지 못했습니다'));
 assert.ok(await page.locator('#memberGoogle').isDisabled());await page.locator('#memberClose').click();
 assert.ok(await page.locator('#hero').isVisible());
 // Mock only Firebase authentication; never create a real account.
 await page.route('**/member-auth.js',r=>r.fulfill({contentType:'text/javascript',body:`export async function connectMember(onChange){window.mockMemberChange=onChange;onChange(null);return {async signIn(){if(window.blockMember){const e=new Error();e.code='auth/popup-blocked';throw e}onChange({name:'테스트 Google 프로필',photo:'https://lh3.googleusercontent.com/test-photo'})},async signOut(){onChange(null)}}}`}));
 await page.route('https://lh3.googleusercontent.com/**',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#78aaee"/></svg>'}));
 await page.reload();await page.locator('#hero').waitFor({state:'visible'});
 await page.locator('#memberAccount').click();await page.waitForFunction(()=>!document.querySelector('#memberGoogle').disabled);
 assert.equal(await page.locator('#memberDialog input[type=password],#memberDialog input[type=email]').count(),0);
 await page.evaluate(()=>window.blockMember=true);await page.locator('#memberGoogle').click();await page.waitForFunction(()=>document.querySelector('#memberStatus').textContent.includes('팝업 차단'));
 await page.evaluate(()=>window.blockMember=false);await page.locator('#memberGoogle').click();await page.locator('#memberLargeAvatar').waitFor({state:'visible'});
 assert.equal(await page.locator('#memberName').textContent(),'테스트 Google 프로필');assert.ok(await page.locator('#memberGoogle').isHidden());
 await page.locator('#memberClose').click();await page.locator('#memberAvatar').waitFor({state:'visible'});
 assert.equal(await page.locator('#memberAvatar').getAttribute('src'),'https://lh3.googleusercontent.com/test-photo');
 for(const [width,height] of [[320,700],[390,844],[844,390],[1280,800]]){
  await page.setViewportSize({width,height});const g=await page.locator('#memberAccount').evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:innerWidth,scroll:document.documentElement.scrollWidth}});assert.ok(g.left>=0&&g.right<=g.width+1&&g.scroll<=g.width+1,JSON.stringify(g));
 }
 await page.evaluate(()=>window.mockMemberChange({name:'사진 없는 계정',photo:'https://googleusercontent.com.evil.invalid/photo'}));
 assert.ok(await page.locator('#memberAvatar').isHidden());assert.ok(await page.locator('#memberIcon').isVisible());assert.equal(await page.locator('#memberAvatar').getAttribute('src'),null);
 await page.locator('#memberAccount').click();await page.locator('#memberLogout').click();await page.locator('#memberGoogle').waitFor({state:'visible'});
 assert.equal(await page.locator('#memberLabel').textContent(),'로그인');await page.locator('#memberClose').click();assert.ok(await page.locator('#hero').isVisible());assert.equal(errors.length,0,errors.join('; '));console.log('Google-only optional member UI passed: guest viewing, configuration failure, popup error, avatar, mobile layout, safe fallback and logout (mock auth)');
}finally{await browser?.close();server.close()}
