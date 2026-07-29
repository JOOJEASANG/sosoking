import fs from 'node:fs';

const errors = [];
const read = path => fs.readFileSync(path, 'utf8');
const catalog = JSON.parse(read('content/daily-real-court-cases.json'));

if (!Array.isArray(catalog) || catalog.length < 10) {
  errors.push('content/daily-real-court-cases.json: 초기 실제 판례가 10건 이상 필요합니다.');
}

const ids = new Set();
for (const [index, item] of (Array.isArray(catalog) ? catalog : []).entries()) {
  const label = `판례 ${index + 1}`;
  if (!/^[a-z0-9-]{3,80}$/.test(String(item.id || ''))) errors.push(`${label}: id 형식 오류`);
  if (ids.has(item.id)) errors.push(`${label}: 중복 id ${item.id}`);
  ids.add(item.id);
  for (const field of ['title', 'category', 'court', 'caseNumber', 'decidedAt', 'summary', 'question', 'correctChoiceId', 'reasoning', 'funLine']) {
    if (!String(item[field] || '').trim()) errors.push(`${item.id || label}: ${field} 누락`);
  }
  if (!String(item.sourceUrl || '').startsWith('https://www.law.go.kr/')) errors.push(`${item.id || label}: 공식 판례 URL 누락`);
  if (!Array.isArray(item.choices) || item.choices.length < 2) errors.push(`${item.id || label}: 선택지 부족`);
  if (!item.choices?.some(choice => choice.id === item.correctChoiceId)) errors.push(`${item.id || label}: 정답 선택지 불일치`);
  if (!Array.isArray(item.evidence) || item.evidence.length < 1) errors.push(`${item.id || label}: 증거 카드 누락`);
}

const functionsMain = read('functions/main.js');
const gameFunction = read('functions/daily-real-court.js');
const app = read('public/js/app.js');
const nav = read('public/js/components/nav.js');
const page = read('public/js/pages/daily-real-court.js');
const brand = read('public/css/brand-logo.css');
const firebase = read('firebase.json');
const rules = read('firestore.rules');
const deploy = read('.github/workflows/firebase-deploy.yml');
const sync = read('tools/sync-daily-real-court-catalog.mjs');
const submit = read('functions/submit-secure.js');
const publicConfig = read('tools/sync-public-config.mjs');
const index = read('public/index.html');
const sw = read('public/sw.js');

for (const expected of [
  "require('./daily-real-court')",
  'getDailyRealCourt',
  'submitDailyRealCourtVerdict',
  'daily_court_days',
  'daily_court_players',
  'daily_court_catalog'
]) {
  if (!(functionsMain + gameFunction).includes(expected)) errors.push(`Functions integration missing: ${expected}`);
}

for (const expected of [
  "renderDailyRealCourt",
  "#/daily-court",
  "path === '/daily-court'"
]) {
  if (!app.includes(expected)) errors.push(`public/js/app.js integration missing: ${expected}`);
}

for (const expected of ['오늘재판', '#/daily-court', 'isDailyCourt']) {
  if (!nav.includes(expected)) errors.push(`public/js/components/nav.js integration missing: ${expected}`);
}
if (!brand.includes('flex: 1 1 20%')) errors.push('public/css/brand-logo.css: five-item navigation width is missing');

for (const expected of ['증거', '실제 판결', '공식 판례 확인', 'submitDailyRealCourtVerdict']) {
  if (!page.includes(expected)) errors.push(`daily court page missing: ${expected}`);
}

if (!firebase.includes('{ "source": "/daily-court", "destination": "/index.html" }')) errors.push('firebase.json: /daily-court rewrite missing');
for (const collection of ['daily_court_catalog', 'daily_court_config', 'daily_court_days', 'daily_court_players']) {
  if (!rules.includes(`match /${collection}/`)) errors.push(`firestore.rules: ${collection} protection missing`);
}
for (const functionName of ['functions:getDailyRealCourt', 'functions:submitDailyRealCourtVerdict']) {
  if (!deploy.includes(functionName)) errors.push(`deploy workflow missing: ${functionName}`);
}
if (!deploy.includes('sync-daily-real-court-catalog.mjs') || !sync.includes('orderedCaseIds')) {
  errors.push('daily real court catalog deployment sync is incomplete');
}
if (!submit.includes('const DEFAULT_DAILY_LIMIT = 1') || !submit.includes('1, 1)')) {
  errors.push('functions/submit-secure.js: member daily case limit is not fixed to one');
}
if (!publicConfig.includes('const dailyLimit = 1')) {
  errors.push('tools/sync-public-config.mjs: public daily limit is not one');
}

const appVersion = index.match(/\/js\/app\.js\?v=([^"']+)/)?.[1] || '';
if (!appVersion || !sw.includes(`/js/app.js?v=${appVersion}`)) errors.push('index and service worker app versions differ');
const brandVersion = index.match(/\/css\/brand-logo\.css\?v=([^"']+)/)?.[1] || '';
if (!brandVersion || !sw.includes(`/css/brand-logo.css?v=${brandVersion}`)) errors.push('index and service worker brand CSS versions differ');
if (!sw.includes('/js/pages/daily-real-court.js?v=20260729-daily-real-court-1')) errors.push('service worker does not cache daily court page module');

if (errors.length) {
  console.error(`Daily real court validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Daily real court validation passed: ${catalog.length} verified cases, one-vote game flow, protected answers, and one daily AI submission.`);
