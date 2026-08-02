import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');
const need = (source, value, label) => {
  if (!source.includes(value)) errors.push(`${label}: missing ${value}`);
};

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
need(app, "./pages/home-seven-judges.js?v=20260730-home-layout-route-1", 'application modules');
const normalizedRouteSource = app.split('function normalizedRoute() {')[1]?.split('\nfunction freshContentHost()')[0] || '';
for (const value of [
  "if (hash === '' || hash === '#')",
  "return hash || '#/'"
]) need(normalizedRouteSource, value, 'application routing');
if (normalizedRouteSource.includes("if (hash === '#/' || hash === '' || hash === '#')")) {
  errors.push('application routing: explicit home route is overwritten by pathname');
}
if (app.includes('renderDailyRealCourt') || app.includes("#/daily-court") || app.includes('daily-real-court.js')) {
  errors.push('application modules: obsolete route implementation is still referenced');
}

const index = read('public/index.html');
const worker = read('public/sw.js');
const appVersion = index.match(/<script type="module" src="\/js\/app\.js\?v=([^"']+)"/)?.[1] || '';
if (!appVersion) errors.push('public/index.html: active app version is missing');
if (!worker.includes(`/js/app.js?v=${appVersion}`)) {
  errors.push('public/index.html and public/sw.js: active app cache versions differ');
}
if (!worker.includes(`const CACHE_NAME = 'sosoking-app-v${appVersion}';`)) {
  errors.push('public/index.html and public/sw.js: active cache name differs from the application version');
}
need(worker, '/js/pages/home-seven-judges.js?v=20260730-home-layout-route-1', 'active application cache');

const packageJson = read('package.json');
need(packageJson, 'node tools/check-home-layout-routing.mjs', 'validation chain');

if (errors.length) {
  console.error(`Home and routing validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Home and routing validation passed: seven judge cards remain, obsolete routes are absent, and active cache versions match.');
