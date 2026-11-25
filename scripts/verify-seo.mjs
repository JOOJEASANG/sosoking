import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(process.argv.includes('--built')?'dist-public':'public');
const host='https://sosoking-481e6.web.app/';
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.match(html,/<html lang="ko">/);
assert.match(html,/<meta name="description" content="[^"]{30,}"/);
assert.match(html,/<title>[^<]{15,}<\/title>/);
assert.ok(html.includes('<link rel="canonical" href="'+host+'">'));
assert.ok(html.includes('<meta property="og:url" content="'+host+'">'));
const json=html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/);
assert.ok(json);
const schema=JSON.parse(json[1]);
assert.equal(schema['@context'],'https://schema.org');
assert.equal(schema.url,host);
assert.ok(schema.name.includes('소소킹'));
const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
assert.deepEqual(urls,["https://sosoking-481e6.web.app/","https://sosoking-481e6.web.app/old-phone.html","https://sosoking-481e6.web.app/event.html","https://sosoking-481e6.web.app/community.html","https://sosoking-481e6.web.app/ferry.html","https://sosoking-481e6.web.app/orders.html","https://sosoking-481e6.web.app/help.html","https://sosoking-481e6.web.app/info.html","https://sosoking-481e6.web.app/settlement.html","https://sosoking-481e6.web.app/group-plan.html","https://sosoking-481e6.web.app/memories.html","https://sosoking-481e6.web.app/tools.html","https://sosoking-481e6.web.app/election.html","https://sosoking-481e6.web.app/bus.html","https://sosoking-481e6.web.app/local-info.html"]); for(const url of urls){const file=url===host?'index.html':url.slice(host.length); assert.ok(fs.existsSync(path.join(root,file)),file);}
for(const retired of ['daily.html','loans.html'])assert.match(fs.readFileSync(path.join(root,retired),'utf8'),/noindex,follow/);
const robots=fs.readFileSync(path.join(root,'robots.txt'),'utf8');
assert.match(robots,/Sitemap: https:\/\/sosoking-481e6\.web\.app\/sitemap\.xml/);
for(const old of ['roster.html','chat.html','guide.html','shift.html']){
 assert.ok(!fs.existsSync(path.join(root,old)),'Old program should be removed: '+old);
}
console.log('Life Tools SEO passed');
