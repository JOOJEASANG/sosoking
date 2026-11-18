import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(process.argv.includes('--built') ? 'dist-public' : 'public');
const host = 'https://sosoking-481e6.web.app';
const pages = [
  {path:'index.html',url:host+'/'},
  {path:'event.html',url:host+'/event.html'},
  {path:'old-phone.html',url:host+'/old-phone.html'},
  {path:'guide.html',url:host+'/guide.html'}
];
const robots = fs.readFileSync(path.join(root,'robots.txt'),'utf8');
assert.match(robots,/User-agent: \*/i);
assert.match(robots,/Allow: \//);
assert.match(robots,/Disallow: \/event\.html\?id=/);
assert.match(robots,/Sitemap: https:\/\/sosoking-481e6\.web\.app\/sitemap\.xml/);
const sitemap = fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
assert.deepEqual(urls,pages.map(p=>p.url));
assert.ok(!sitemap.includes('?id='),'Private invitation URLs must not appear in public sitemap');
for (const p of pages){
 const source = fs.readFileSync(path.join(root,p.path),'utf8');
 assert.match(source,/<html lang="ko">/);
 assert.match(source,/<meta name="description" content="[^"]{30,}"/);
 assert.match(source,/<title>[^<]{15,}<\/title>/);
 assert.ok(source.includes('<link rel="canonical" href="'+p.url+'">'),p.path+' canonical');
 assert.ok(source.includes('<meta property="og:url" content="'+p.url+'">'),p.path+' social URL');
 assert.ok(source.includes('<meta property="og:image" content="'+host+'/icons/sosoking-512.png">'));
 assert.ok(source.includes('<meta name="robots" content="index,follow,max-image-preview:large">'));
 const match=source.match(/<script type="application\/ld\+json">([^<]+)<\/script>/);
 assert.ok(match,p.path+' JSON-LD');
 const data=JSON.parse(match[1]);
 assert.equal(data['@context'],'https://schema.org');
 assert.ok(['SoftwareApplication','WebSite'].includes(data['@type']));
 assert.ok(data.url===p.url);
}
console.log('SEO passed: 4 canonical pages, sitemap, crawl rules, metadata, structured data.');
