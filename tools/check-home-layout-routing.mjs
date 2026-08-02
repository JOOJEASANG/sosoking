import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');
const need = (source, value, label) => {
  if (!source.includes(value)) errors.push(`${label}: missing ${value}`);
};

const dailyLayout = read('public/js/pages/daily-real-court-layout.js');
for (const value of [
  "./daily-real-court.js?v=20260730-daily-three-ranking-1",
  ".container.daily-court-page",
  "padding-right: 20px",
  "padding-left: 20px",
  "await renderBaseDailyRealCourt(container)"
]) need(dailyLayout, value, 'daily court layout');

const homeJudges = read('public/js/pages/home-seven-judges.js');
for (const value of [
  "./home-no-search.js?v=20260730-search-scope-1",
  "name === '운명에 맡기기'",
  "icon === '🎲'",
  "card.remove()",
  "heading.textContent = '7명의 AI 판사'",
  "사건을 접수하면 7명 중 한 명이 자동으로 배정됩니다."
]) need(homeJudges, value, 'seven-judge home');

const app = read('public/js/app.js');
for (const value of [
  "./pages/home-seven-judges.js?v=20260730-home-layout-route-1",
  "./pages/daily-real-court-layout.js?v=20260730-home-layout-route-1"
]) need(app, value, 'application modules');
const normalizedRouteSource = app.split('function normalizedRoute() {')[1]?.split('\nfunction freshContentHost()')[0] || '';
for (const value of [
  "if (hash === '' || hash === '#')",
  "return hash || '#/'"
]) need(normalizedRouteSource, value, 'application routing');
if (normalizedRouteSource.includes("if (hash === '#/' || hash === '' || hash === '#')")) {
  errors.push('application routing: explicit #/ home route is still overwritten by the current pathname');
}

const index = read('public/index.html');
const worker = read('public/sw.js');
const appVersion = index.match(/<script type="module" src="\/js\/app\.js\?v=([^"']+)"/)?.[1] || '';
if (!appVersion) {
  errors.push('public/index.html: active app version is missing');
}
if (!worker.includes(`/js/app.js?v=${appVersion}`)) {
  errors.push('public/index.html and public/sw.js: active app cache versions differ');
}
if (!worker.includes(`const CACHE_NAME = 'sosoking-app-v${appVersion}';`)) {
  errors.push('public/index.html and public/sw.js: active cache name differs from the application version');
}
for (const value of [
  '/js/pages/home-seven-judges.js?v=20260730-home-layout-route-1',
  '/js/pages/daily-real-court-layout.js?v=20260730-home-layout-route-1'
]) need(worker, value, 'active application cache');

const packageJson = read('package.json');
need(packageJson, 'node tools/check-home-layout-routing.mjs', 'validation chain');

if (errors.length) {
  console.error(`Home, layout, and routing validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Home, layout, and routing validation passed: seven judge cards remain, daily court uses shared page gutters, active cache versions match, and explicit home navigation overrides deep-link paths.');
