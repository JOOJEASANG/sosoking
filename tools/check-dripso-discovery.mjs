import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');

const dripso = read('public/dripso/index.html');
for (const required of [
  '<meta name="robots" content="index,follow',
  '<link rel="canonical" href="https://sosoking.co.kr/dripso/">',
  '<meta property="og:url" content="https://sosoking.co.kr/dripso/">',
  '<meta property="og:site_name" content="드립소">',
  '<meta name="twitter:card" content="summary_large_image">',
  'itemscope itemtype="https://schema.org/WebApplication"',
  'itemprop="description"',
  '빈칸채우기·이름붙이기·받아치기·오답제출·뉴스제목·변명대회·사용설명서',
  'href="/dripso/#/browse"',
  'href="/dripso/#/create"'
]) {
  if (!dripso.includes(required)) errors.push(`public/dripso/index.html: missing ${required}`);
}
if (dripso.includes('content="noindex')) {
  errors.push('public/dripso/index.html: Dripso must not be marked noindex');
}

const safeSeo = read('functions/public-seo-safe.js');
for (const required of [
  "const DRIPSO_CANONICAL_URL = 'https://sosoking.co.kr/dripso/'",
  'function renderSafeSitemapXml(entries)',
  '.send(renderSafeSitemapXml(entries))',
  'renderSafeSitemapXml: { value: renderSafeSitemapXml'
]) {
  if (!safeSeo.includes(required)) errors.push(`functions/public-seo-safe.js: missing ${required}`);
}

const court = read('public/index.html');
for (const required of [
  '/css/dripso-quick-launch.css?v=20260804-dripso-quick-launch-1',
  '/js/dripso-quick-launch.js?v=20260804-dripso-quick-launch-1'
]) {
  if (!court.includes(required)) errors.push(`public/index.html: missing ${required}`);
}
if (court.includes('<link rel="stylesheet" href="/css/dripso-entry.css?v=20260802-dripso-bottom-entry-1">')) {
  errors.push('public/index.html: retired bottom Dripso switcher CSS is still active');
}
if (court.includes('<script type="module" src="/js/dripso-entry-guard.js?v=20260802-dripso-bottom-entry-1"></script>')) {
  errors.push('public/index.html: retired bottom Dripso switcher script is still active');
}

const launch = read('public/js/dripso-quick-launch.js');
for (const required of [
  "const BUTTON_ID = 'dripso-quick-launch'",
  "const PANEL_ID = 'dripso-quick-panel'",
  "button.setAttribute('aria-controls', PANEL_ID)",
  "button.setAttribute('aria-expanded', 'false')",
  "description.textContent = '빈칸채우기·이름붙이기·받아치기",
  "link.href = DRIPSO_PATH",
  "link.textContent = 'ㅋ 드립소 바로가기'",
  "document.getElementById('dripso-home-entry')?.remove()",
  "window.addEventListener('hashchange', scheduleEnsure)"
]) {
  if (!launch.includes(required)) errors.push(`public/js/dripso-quick-launch.js: missing ${required}`);
}
if (launch.includes('innerHTML')) errors.push('public/js/dripso-quick-launch.js: innerHTML must not be used');

const launchCss = read('public/css/dripso-quick-launch.css');
for (const required of [
  '.dripso-quick-launch',
  'right: 60px',
  '.dripso-quick-panel',
  '.dripso-quick-panel-link',
  "[data-theme='light'] .dripso-quick-launch",
  '@media (max-width: 390px)',
  '@media (prefers-reduced-motion: reduce)'
]) {
  if (!launchCss.includes(required)) errors.push(`public/css/dripso-quick-launch.css: missing ${required}`);
}

const robots = read('public/robots.txt');
if (!robots.includes('Sitemap: https://sosoking.co.kr/sitemap.xml')) {
  errors.push('public/robots.txt: sitemap declaration is missing');
}

if (errors.length) {
  console.error(`Dripso discovery validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Dripso discovery validation passed: indexable metadata, sitemap inclusion, crawlable copy, and the home quick-launch panel are connected.');
