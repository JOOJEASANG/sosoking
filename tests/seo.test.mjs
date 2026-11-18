import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('public sitemap lists only four static, canonical URLs',()=>{
 const xml=fs.readFileSync('public/sitemap.xml','utf8');
 const urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
 assert.deepEqual(urls,[
  'https://sosoking-481e6.web.app/',
  'https://sosoking-481e6.web.app/event.html',
  'https://sosoking-481e6.web.app/old-phone.html',
  'https://sosoking-481e6.web.app/guide.html'
 ]);
 assert.ok(urls.every(url=>!url.includes('?id=')));
});
test('robots allows public pages but disallows private invitation URLs',()=>{
 const r=fs.readFileSync('public/robots.txt','utf8');
 assert.match(r,/Allow: \//);
 assert.match(r,/Disallow: \/event\.html\?id=/);
 assert.match(r,/Sitemap: https:\/\/sosoking-481e6\.web\.app\/sitemap\.xml/);
});
test('public pages have independent crawl metadata, canonical, and schema',()=>{
 for(const p of ['index.html','event.html','old-phone.html','guide.html']){
  const html=fs.readFileSync('public/'+p,'utf8');
  assert.match(html,/<meta name="description"/);
  assert.match(html,/<link rel="canonical"/);
  assert.match(html,/<meta property="og:title"/);
  assert.match(html,/<script type="application\/ld\+json">/);
 }
});
