import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');

const renderer = read('functions/public-seo.js');
for (const required of [
  'renderPublicResultHtml',
  'renderStructuredDocument',
  'document-subheading',
  'document-subheading::before',
  'document-order',
  'renderSitemapXml',
  'rel="canonical"',
  'name="description"',
  'name="robots"',
  'application/ld+json',
  "'@type': 'CreativeWork'"
]) {
  if (!renderer.includes(required)) errors.push(`functions/public-seo.js: missing ${required}`);
}
if (renderer.includes("collection('cases')")) {
  errors.push('functions/public-seo.js: public SEO rendering must not read private case documents');
}

const gate = read('functions/public-seo-safe.js');
for (const required of [
  'exports.publicResultPage',
  'exports.publicSitemap',
  'isSanitizedPublicResult',
  'publicDataVersion',
  "hasOwnProperty.call(raw, 'userId')",
  "hasOwnProperty.call(raw, 'caseDescription')",
  "hasOwnProperty.call(raw, 'nickname')",
  'loadSafePublicResult',
  'listSafePublicResultEntries',
  'renderPublicResultHtml',
  'renderSitemapXml',
  'X-Robots-Tag',
  'noindex, nofollow',
  "where('isPublic', '==', true)",
  'SITEMAP_RESULT_LIMIT'
]) {
  if (!gate.includes(required)) errors.push(`functions/public-seo-safe.js: missing ${required}`);
}
if (gate.includes("collection('cases')")) {
  errors.push('functions/public-seo-safe.js: safe SEO gate must not read private case documents');
}

const main = read('functions/main.js');
if (!main.includes("require('./public-seo-safe')")) {
  errors.push('functions/main.js: sanitized public SEO functions are not exported');
}
if (main.includes("Object.assign(exports, require('./public-seo'))")) {
  errors.push('functions/main.js: unsafe direct public SEO handlers remain exported');
}
if (main.includes("require('./public-result-sanitizer')")) {
  errors.push('functions/main.js: deploy-time sanitation utility must not become an Eventarc function');
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
if (!board.includes('function resultPath(id)') || !board.includes('`#/result/${encodeURIComponent(id)}`')) {
  errors.push('public/js/pages/board.js: public cards do not open the full verdict app route');
}
if (board.includes('return `/result/${encodeURIComponent(id)}`')) {
  errors.push('public/js/pages/board.js: board cards must not leave the app before opening the full verdict record');
}

const resultComments = read('public/js/pages/result-comments.js');
if (!resultComments.includes("./result-court.js?v=20260829-tags-1")) {
  errors.push('public/js/pages/result-comments.js: styled full verdict renderer is missing');
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
if (!/await\s+putCache\(request,\s*response\)/.test(serviceWorker)) {
  errors.push('public/sw.js: network navigation responses can overwrite the index fallback cache');
}

const deploy = read('.github/workflows/firebase-deploy.yml');
for (const functionName of ['functions:publicResultPage', 'functions:publicSitemap']) {
  if (!deploy.includes(functionName)) errors.push(`firebase-deploy.yml: ${functionName} is not deployed`);
}
if (deploy.includes('functions:sanitizePublicResult')) {
  errors.push('firebase-deploy.yml: Eventarc sanitizer trigger must not block the hosting deployment');
}
if (!deploy.includes('node functions/sanitize-public-results-cli.js')) {
  errors.push('firebase-deploy.yml: existing public result sanitation is missing');
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

console.log('Public SEO validation passed: sanitized public verdicts remain indexable without requiring an Eventarc deployment dependency.');
