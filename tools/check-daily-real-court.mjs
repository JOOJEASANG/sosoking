import fs from 'node:fs';

const errors = [];
const read = path => fs.readFileSync(path, 'utf8');
const catalog = JSON.parse(read('content/daily-real-court-cases.json'));

if (!Array.isArray(catalog) || catalog.length < 3) {
  errors.push('content/daily-real-court-cases.json: 하루 3건 출제를 위해 판례가 3건 이상 필요합니다.');
}
if (Array.isArray(catalog) && catalog.length > 500) {
  errors.push('content/daily-real-court-cases.json: 판례는 최대 500건까지 지원합니다.');
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
const indexes = JSON.parse(read('firestore.indexes.json'));
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
  'const DAILY_CASE_COUNT = 3;',
  'dailyCaseIndexes',
  'daily_court_days',
  'daily_court_weeks',
  'daily_court_players',
  'daily_court_catalog',
  'loadRankings',
  "where('completed', '==', true).orderBy(scoreField, 'desc')",
  "completed: raw.completed === true"
]) {
  if (!(functionsMain + gameFunction).includes(expected)) errors.push(`Functions integration missing: ${expected}`);
}

for (const expected of [
  'renderDailyRealCourt',
  '#/daily-court',
  "path === '/daily-court'"
]) {
  if (!app.includes(expected)) errors.push(`public/js/app.js integration missing: ${expected}`);
}

for (const expected of ['오늘재판', '#/daily-court', 'isDailyCourt']) {
  if (!nav.includes(expected)) errors.push(`public/js/components/nav.js integration missing: ${expected}`);
}
if (!brand.includes('flex: 1 1 20%')) errors.push('public/css/brand-logo.css: five-item navigation width is missing');

for (const expected of [
  '하루 세 판',
  'daily-case-nav',
  '판사 랭킹',
  'data-ranking-tab',
  '오늘의 3건 판결 완료',
  'caseId: gameCase.id',
  'submitDailyRealCourtVerdict'
]) {
  if (!page.includes(expected)) errors.push(`daily court page missing: ${expected}`);
}

if (!firebase.includes('{ "source": "/daily-court", "destination": "/index.html" }')) errors.push('firebase.json: /daily-court rewrite missing');
for (const collection of ['daily_court_catalog', 'daily_court_config', 'daily_court_days', 'daily_court_weeks', 'daily_court_players']) {
  if (!rules.includes(`match /${collection}/`)) errors.push(`firestore.rules: ${collection} protection missing`);
}
const completedScoreIndex = indexes.indexes?.some(item => item.collectionGroup === 'votes'
  && item.fields?.some(field => field.fieldPath === 'completed' && field.order === 'ASCENDING')
  && item.fields?.some(field => field.fieldPath === 'score' && field.order === 'DESCENDING'));
if (!completedScoreIndex) errors.push('firestore.indexes.json: completed daily ranking index missing');

for (const functionName of ['functions:getDailyRealCourt', 'functions:submitDailyRealCourtVerdict']) {
  if (!deploy.includes(functionName)) errors.push(`deploy workflow missing: ${functionName}`);
}
for (const expected of ['orderedCaseIds', 'dailyCaseCount: 3', 'targetSize: 500', 'cases.length > 500']) {
  if (!sync.includes(expected)) errors.push(`daily real court catalog sync missing: ${expected}`);
}

// AI 생활사건 접수 한도는 오늘의 재판 3건 참여 규칙과 별개이며 관리자 설정을 따른다.
for (const expected of [
  'const dailyLimitEnabled = settings.dailyLimitEnabled === true;',
  'if (dailyLimitEnabled && count >= dailyLimit)',
  'clampNumber(settings.dailyLimit, DEFAULT_DAILY_LIMIT, 1, 1000)'
]) {
  if (!submit.includes(expected)) errors.push(`functions/submit-secure.js: configurable AI case limit missing ${expected}`);
}
for (const expected of [
  'const dailyLimitEnabled = data.dailyLimitEnabled === true;',
  'numberInRange(data.dailyLimit, 3, 1, 1000)'
]) {
  if (!publicConfig.includes(expected)) errors.push(`tools/sync-public-config.mjs: configurable public limit sync missing ${expected}`);
}
if (submit.includes('1, 1)') || publicConfig.includes('const dailyLimit = 1')) {
  errors.push('AI 생활사건 접수 한도가 다시 하루 1회로 고정되었습니다.');
}

const appVersion = index.match(/\/js\/app\.js\?v=([^"']+)/)?.[1] || '';
if (!appVersion || !sw.includes(`/js/app.js?v=${appVersion}`)) errors.push('index and service worker app versions differ');
const brandVersion = index.match(/\/css\/brand-logo\.css\?v=([^"']+)/)?.[1] || '';
if (!brandVersion || !sw.includes(`/css/brand-logo.css?v=${brandVersion}`)) errors.push('index and service worker brand CSS versions differ');
if (!sw.includes('/js/pages/daily-real-court.js?v=20260730-daily-three-ranking-1')) errors.push('service worker does not cache the three-case daily court module');

if (errors.length) {
  console.error(`Daily real court validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Daily real court validation passed: ${catalog.length} verified cases, three daily judgments, completed-only daily ranking query, protected scores, and daily/weekly/all-time rankings.`);
