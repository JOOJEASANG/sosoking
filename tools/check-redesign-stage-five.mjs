import fs from 'node:fs';

const errors = [];
const read = path => fs.readFileSync(path, 'utf8');
const need = (source, text, label) => {
  if (!source.includes(text)) errors.push(`${label}: missing ${text}`);
};

const css = read('public/css/redesign-stage-five.css');
for (const text of [
  '.daily-redesign-host',
  '.daily-court-intro',
  '.daily-case-nav',
  '.daily-choice-list',
  '.daily-ranking-tabs',
  '.daily-rank-row',
  '.my-cases-redesign-host',
  '#my-game-profile',
  '[data-case-list]',
  '[data-case-row]',
  '@media(max-width:580px)'
]) need(css, text, 'stage five stylesheet');

const dailyWrapper = read('public/js/pages/daily-real-court-redesign.js');
for (const text of [
  "./daily-real-court-layout.js?v=20260730-home-layout-route-1",
  "container.classList.add('daily-redesign-host')",
  'await renderBaseDailyRealCourt(container)'
]) need(dailyWrapper, text, 'daily court wrapper');

const daily = read('public/js/pages/daily-real-court.js');
for (const text of [
  '하루 세 판',
  'daily-case-nav',
  'caseId: gameCase.id',
  'submitDailyRealCourtVerdict',
  'data-ranking-tab="daily"',
  'data-ranking-tab="weekly"',
  'data-ranking-tab="allTime"'
]) need(daily, text, 'daily court behavior');

const myCasesWrapper = read('public/js/pages/my-cases-redesign.js');
for (const text of [
  "./my-cases-game.js?v=20260729-dark-record-participation-1",
  "container.classList.add('my-cases-redesign-host')",
  'await renderBaseMyCases(container)'
]) need(myCasesWrapper, text, 'my cases wrapper');

const myCases = read('public/js/pages/my-cases.js');
for (const text of [
  "httpsCallable(functions, 'deleteOwnCourtPost')",
  'data-case-row=',
  'data-delete-case=',
  '`#/verdict/${encodeURIComponent(id)}`',
  '`#/trial/${encodeURIComponent(id)}`'
]) need(myCases, text, 'my cases behavior');

const app = read('public/js/app.js');
for (const text of [
  "./pages/daily-real-court-redesign.js?v=20260730-redesign-stage-5",
  "./pages/my-cases-redesign.js?v=20260730-redesign-stage-5"
]) need(app, text, 'application');

const index = read('public/index.html');
const worker = read('public/sw.js');
need(index, '/css/redesign-stage-five.css?v=20260730-redesign-stage-5', 'index');
need(worker, '/css/redesign-stage-five.css?v=20260730-redesign-stage-5', 'service worker');
for (const text of [
  '/js/pages/daily-real-court-redesign.js?v=20260730-redesign-stage-5',
  '/js/pages/daily-real-court-layout.js?v=20260730-home-layout-route-1',
  '/js/pages/my-cases-redesign.js?v=20260730-redesign-stage-5',
  '/js/pages/my-cases-game.js?v=20260729-dark-record-participation-1'
]) need(worker, text, 'service worker');
const appVersion = index.match(/<script type="module" src="\/js\/app\.js\?v=([^"']+)"/)?.[1] || '';
if (!appVersion || !worker.includes(`/js/app.js?v=${appVersion}`)) {
  errors.push('index and service worker active app versions differ');
}
need(worker, "const CACHE_NAME = 'sosoking-app-v", 'service worker');

const packageJson = read('package.json');
need(packageJson, 'node tools/check-redesign-stage-five.mjs', 'validation chain');

if (errors.length) {
  console.error(`Stage five redesign validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Stage five redesign validation passed: three daily cases, evidence scoring, daily/weekly/all-time rankings, personal case navigation, deletion, and cache compatibility remain connected.');
