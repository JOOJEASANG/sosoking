import assert from 'node:assert/strict';
const base='https://sosoking-481e6.web.app';
const slugs=['raffle','poll','wheel','score','teams','timer','bracket'];
async function get(path){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
 try{
  const response=await fetch(base+path,{cache:'no-store',signal:controller.signal});
  assert.equal(response.status,200,path+' must be served as HTTP 200');
  return {response,body:await response.text()};
 }finally{clearTimeout(timeout);}
}
const root=await get('/');
assert.match(root.body,/rel="canonical" href="https:\/\/sosoking\.co\.kr\/"/);
const sitemap=await get('/sitemap.xml');
assert.match(sitemap.body,/<urlset/);
const robots=await get('/robots.txt');
assert.match(robots.body,/Sitemap: https:\/\/sosoking\.co\.kr\/sitemap\.xml/);
const titles=new Set();
for(const slug of slugs){
 const result=await get('/programs/'+slug+'/');
 const html=result.body;
 assert.match(html,/<meta name="description" content=".+">/,'Unique description '+slug);
 assert.match(html,new RegExp('<link rel="canonical" href="https:\\/\\/sosoking\\.co\\.kr\\/programs\\/'+slug+'\\/">'));
 assert.equal((html.match(/rel="canonical"/g)||[]).length,1,'One canonical '+slug);
 assert.match(html,/<script type="application\/ld\+json">/,'Structured data '+slug);
 assert.match(html,/<h1>[^<]+<\/h1>/,'Pre-rendered content '+slug);
 assert.match(html,/<script type="module" crossorigin src="\/assets\//,'Live app bundles load '+slug);
 const title=html.match(/<title>([^<]+)<\/title>/)?.[1];
 assert.ok(title,'Title exists '+slug);
 assert.ok(!titles.has(title),'Unique title '+slug);titles.add(title);
 assert.ok(sitemap.body.includes('https://sosoking.co.kr/programs/'+slug+'/'),'Sitemap URL '+slug);
}
console.log('SEO LIVE SMOKE PASS: 7 live canonical pages with unique titles, descriptions, prerendered content, bundled app, sitemap and robots.');
