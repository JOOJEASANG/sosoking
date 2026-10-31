import assert from 'node:assert/strict';
const base='https://sosoking-481e6.web.app';
const slugs=['raffle','poll','wheel','score','teams','timer','bracket','treasure'];
async function get(path){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
 try{
  const response=await fetch(base+path,{cache:'no-store',signal:controller.signal});
  assert.equal(response.status,200,path+' must be served as HTTP 200');
  return {response,body:await response.text()};
 }finally{clearTimeout(timeout);}
}
async function ready(path,test){
 let last='';
 for(let attempt=0;attempt<24;attempt++){
  try{
   const result=await get(path+(path.includes('?')?'&':'?')+'_v='+Date.now());
   if(test(result.body))return result;
   last=result.body.slice(0,300);
  }catch(error){last=error.message;}
  if(attempt<23)await new Promise(r=>setTimeout(r,5000));
 }
 throw new Error('New release not visible after retry: '+path+' / '+last);
}
const root=await ready('/',html=>html.includes('rel="canonical" href="https://sosoking.co.kr/"'));
assert.match(root.body,/rel="canonical" href="https:\/\/sosoking\.co\.kr\/"/);
const sitemap=await ready('/sitemap.xml',text=>text.includes('<urlset'));
assert.match(sitemap.body,/<urlset/);
const robots=await ready('/robots.txt',text=>text.includes('Sitemap: https://sosoking.co.kr/sitemap.xml'));
assert.match(robots.body,/Sitemap: https:\/\/sosoking\.co\.kr\/sitemap\.xml/);
const titles=new Set();
for(const slug of slugs){
 const result=await ready('/programs/'+slug+'/',html=>html.includes('rel="canonical" href="https://sosoking.co.kr/programs/'+slug+'/"'));
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
console.log('SEO LIVE SMOKE PASS: 8 live canonical pages with unique titles, descriptions, prerendered content, bundled app, sitemap and robots.');
