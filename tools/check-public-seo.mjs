import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');

const server = read('functions/public-seo.js');
for (const required of [
  'exports.publicResultPage',
  'exports.publicSitemap',
  "raw.isPublic !== true",
  'renderPublicResultHtml',
  'renderSitemapXml',
  'rel="canonical"',
  'name="description"',
  'name="robots"',
  'application/ld+json',
  "'@type': 'CreativeWork'",
  'X-Robots-Tag',
  'noindex, nofollow',
  'where(\'isPublic\', \'==\', true)',
  'SITEMAP_RESULT_LIMIT'
]) {
  if (!server.includes(required)) errors.push(`functions/public-seo.js: missing ${required}`);
}
if (server.includes('userId') || server.includes('collection(\'cases\')')) {
  errors.push('functions/public-seo.js: public SEO rendering must not expose owner IDs or read private case documents');
}

const main = read('functions/main.js');
if (!main.includes("require('./public-seo')")) {
  errors.push('functions/main.js: public SEO functions are not exported');
}

const firebase = JSON.parse(read('firebase.json'));
const rewrites = firebase.hosting?.rewrites || [];
const sitemapRewrite = rewrites.find(item => item.source === '/sitemap.xml');
const resultRewrite = rewrites.find(item => item.source === '/result/**');
if (sitemapRewrite?.function?.functionId !== 'publicSitemap' || sitemapRewrite.function.region !== 'asia-northeast3') {
  errors.push('firebase.json: /sitemap.xml is not routed to publicSitemap in asia-northeast3');
}
if (resultRewrite?.function?.functionId !== 'publicResultPage' || resultRewrite.function.region !== 'asia-northeast3') {
  errors.push('firebase.json: /result/** is not routed to publicResultPage in asia-northeast3');
}
if (fs.existsSync('public/sitemap.xml')) {
  errors.push('public/sitemap.xml: static file would override the dynamic sitemap rewrite');
}

const robots = read('public/robots.txt');
if (!robots.includes('Sitemap: https://sosoking.co.kr/sitemap.xml')) {
  errors.push('public/robots.txt: dynamic sitemap URL is missing');
}

const board = read('public/js/pages/board.js');
if (!board.includes('function publicResultPath(id)') || !board.includes('`/result/${encodeURIComponent(id)}`')) {
  errors.push('public/js/pages/board.js: public cards do not use clean result URLs');
}
if (board.includes('href="#/result/')) {
  errors.push('public/js/pages/board.js: fragment result links remain');
}

const resultCourt = read('public/js/pages/result-court.js');
if (!resultCourt.includes('`${location.origin}/result/${encodeURIComponent(caseId)}`')) {
  errors.push('public/js/pages/result-court.js: shared public URL is not canonical');
}

const serviceWorker = read('public/sw.js');
if (!serviceWorker.includes("url.pathname.startsWith('/result/')")
  || !serviceWorker.includes('event.respondWith(fetch(request))')) {
  errors.push('public/sw.js: server-rendered public result navigations are intercepted by the app shell');
}
if (!serviceWorker.includes('await putCache(request, response)')) {
  errors.push('public/sw.js: network navigation responses can overwrite the index fallback cache');
}

const deploy = read('.github/workflows/firebase-deploy.yml');
for (const functionName of ['functions:publicResultPage', 'functions:publicSitemap']) {
  if (!deploy.includes(functionName)) errors.push(`firebase-deploy.yml: ${functionName} is not deployed`);
}

const packageJson = read('package.json');
if (!packageJson.includes('node tools/check-public-seo.mjs')) {
  errors.push('package.json: public SEO static validation is not in the check chain');
}
if (!packageJson.includes('node functions/check-public-seo.js')) {
  errors.push('package.json: public SEO emulator validation is not in the test chain');
}

if (errors.length) {
  console.error(`Public SEO validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Public SEO validation passed: clean URLs, server HTML, public-only data, canonical metadata, dynamic sitemap, cache isolation, and deployment.');
