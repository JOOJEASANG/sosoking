import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');
const need = (source, value, label) => {
  if (!source.includes(value)) errors.push(`${label}: missing ${value}`);
};

const home = read('public/js/pages/home.js');
for (const value of [
  'const JUDGES = [',
  "{ name: '꼰대형'",
  "{ name: '빙의형'",
  '7명의 AI 판사',
  '담당 판사는 사건마다 자동 배정',
  '비공개 접수 → 내 예상 판정 → AI 판결',
  '최근 공개 사건 5건',
  '사건 읽고 판정하기 →'
]) need(home, value, 'canonical home');
if ((home.match(/\{ name: '[^']+'/g) || []).length !== 7) {
  errors.push('canonical home: exactly seven judge definitions are required');
}
if (home.includes('운명에 맡기기')) {
  errors.push('canonical home: obsolete selectable random-judge card remains');
}

const app = read('public/js/app.js');
need(app, "import { renderHome } from './pages/home.js?v=20260830-final-blind-1';", 'application modules');
const normalizedRouteSource = app.split('function normalizedRoute() {')[1]?.split('\nfunction freshContentHost()')[0] || '';
for (const value of [
  "if (hash === '' || hash === '#')",
  "return hash || '#/'"
]) need(normalizedRouteSource, value, 'application routing');
if (normalizedRouteSource.includes("if (hash === '#/' || hash === '' || hash === '#')")) {
  errors.push('application routing: explicit home route is overwritten by pathname');
}
if (app.includes('renderDailyRealCourt') || app.includes("#/daily-court") || app.includes('daily-real-court.js')) {
  errors.push('application modules: obsolete daily-court route implementation is still referenced');
}
for (const retired of ['home-seven-judges.js', 'home-no-search.js', 'home-court.js', 'home-judge-assignment.js']) {
  if (app.includes(retired)) errors.push(`application modules: retired home wrapper remains: ${retired}`);
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
need(worker, '/js/pages/home.js?v=20260830-final-blind-1', 'active application cache');
for (const retired of ['home-seven-judges.js', 'home-no-search.js', 'home-court.js', 'home-judge-assignment.js']) {
  if (worker.includes(retired)) errors.push(`active application cache: retired home wrapper remains: ${retired}`);
}

const packageJson = read('package.json');
need(packageJson, 'node tools/check-home-layout-routing.mjs', 'validation chain');

if (errors.length) {
  console.error(`Home and routing validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Home and routing validation passed: canonical seven-judge home, blind recent-case entry, current route normalization, and cache versions are consistent.');
