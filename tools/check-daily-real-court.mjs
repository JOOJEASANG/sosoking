import fs from 'node:fs';

const errors = [];
const read = path => fs.readFileSync(path, 'utf8');
const main = read('functions/main.js');
const server = read('functions/daily-community-court.js');
const app = read('public/js/app.js');
const home = read('public/js/pages/home-community-court.js');
const layout = read('public/js/pages/daily-real-court-layout.js');
const page = read('public/js/pages/daily-community-court.js');
const guide = read('public/js/pages/guide.js');
const nav = read('public/js/components/nav.js');
const firebase = read('firebase.json');
const rules = read('firestore.rules');
const indexes = JSON.parse(read('firestore.indexes.json'));
const deploy = read('.github/workflows/firebase-deploy.yml');
const index = read('public/index.html');
const sw = read('public/sw.js');

for (const expected of [
  "require('./daily-community-court')",
  'getDailyRealCourt',
  'submitDailyRealCourtVerdict',
  "const MODE = 'community-v1';",
  'const DAILY_COUNT = 3;',
  "where('isPublic', '==', true)",
  "where('publicDataVersion', '==', 1)",
  "data.source === 'user'",
  "id: 'plaintiff'",
  "id: 'defendant'",
  "id: 'both'",
  'SEEDS',
  'daily_court_days',
  'daily_court_weeks',
  'daily_court_players',
  'aligned ? 100 : 70',
  'data.mode === MODE',
  '원고 주장',
  '피고 주장'
]) {
  if (!(main + server).includes(expected)) errors.push(`community court server missing: ${expected}`);
}

if (main.includes("require('./daily-real-court')")) {
  errors.push('functions/main.js: legacy precedent callable must not be loaded into production exports');
}
if (!fs.existsSync('functions/daily-real-court.js')) {
  errors.push('functions/daily-real-court.js: rollback source must remain preserved');
}

for (const forbidden of ['law.go.kr', 'LAW_OPEN_API_OC', 'daily_court_catalog', 'correctChoiceId']) {
  if (server.includes(forbidden) || page.includes(forbidden)) errors.push(`active community court depends on legacy precedent data: ${forbidden}`);
}

for (const expected of [
  'home-community-court.js?v=20260802-community-court-1',
  'daily-real-court-layout.js?v=20260802-community-court-1',
  '#/daily-court',
  "path === '/daily-court'"
]) {
  if (!app.includes(expected)) errors.push(`app integration missing: ${expected}`);
}
if (!layout.includes("daily-community-court.js?v=20260802-community-court-1")) {
  errors.push('daily route wrapper does not load the community court page');
}

for (const expected of [
  'COMMUNITY COURT · 하루 세 판',
  '다른 사람의 생활사건을 직접 판결합니다',
  '글쓰기는 사건접수 한 곳에서만 합니다',
  'AI 판결문 전체 보기',
  'AI 판단은 정답이나 법률상담이 아니며',
  '내 사건 접수하기',
  '오늘의 3건 판결 완료',
  'submitDailyRealCourtVerdict'
]) {
  if (!page.includes(expected)) errors.push(`community court page missing: ${expected}`);
}
for (const forbidden of ['<textarea', 'contenteditable', 'addCourtComment', 'commentText', '증거 열람하기', '공식 판례 확인']) {
  if (page.includes(forbidden)) errors.push(`community court must remain selection-only: ${forbidden}`);
}

for (const expected of [
  '직접 글을 작성하는 곳은 사건접수 한 곳뿐',
  '원고·피고·쌍방 중 선택하기',
  '공개를 허용한 익명 유저 사건',
  'AI 판결은 비교 기준일 뿐 정답이 아닙니다'
]) {
  if (!guide.includes(expected)) errors.push(`guide missing community flow: ${expected}`);
}
for (const expected of ['오늘의 공개 생활사건', '오늘의 선택재판', "strong.textContent = '3판'"]) {
  if (!home.includes(expected)) errors.push(`home community copy missing: ${expected}`);
}
for (const expected of ['오늘재판', '#/daily-court', 'isDailyCourt']) {
  if (!nav.includes(expected)) errors.push(`navigation integration missing: ${expected}`);
}

if (!firebase.includes('{ "source": "/daily-court", "destination": "/index.html" }')) errors.push('firebase daily-court rewrite missing');
for (const collection of ['daily_court_days', 'daily_court_weeks', 'daily_court_players']) {
  if (!rules.includes(`match /${collection}/`)) errors.push(`firestore rules missing: ${collection}`);
}
const resultIndex = indexes.indexes?.some(item => item.collectionGroup === 'results'
  && item.fields?.some(field => field.fieldPath === 'isPublic' && field.order === 'ASCENDING')
  && item.fields?.some(field => field.fieldPath === 'publicDataVersion' && field.order === 'ASCENDING')
  && item.fields?.some(field => field.fieldPath === 'createdAt' && field.order === 'DESCENDING'));
if (!resultIndex) errors.push('safe public result query index missing');
const voteIndex = indexes.indexes?.some(item => item.collectionGroup === 'votes'
  && item.fields?.some(field => field.fieldPath === 'completed' && field.order === 'ASCENDING')
  && item.fields?.some(field => field.fieldPath === 'score' && field.order === 'DESCENDING'));
if (!voteIndex) errors.push('completed daily ranking index missing');
for (const functionName of ['functions:getDailyRealCourt', 'functions:submitDailyRealCourtVerdict']) {
  if (!deploy.includes(functionName)) errors.push(`deploy workflow missing: ${functionName}`);
}

const appVersion = index.match(/\/js\/app\.js\?v=([^"']+)/)?.[1] || '';
if (!appVersion) errors.push('index application version is missing');
if (appVersion && !sw.includes(`/js/app.js?v=${appVersion}`)) errors.push('index and service worker app versions differ');
for (const asset of [
  '/js/pages/home-community-court.js?v=20260802-community-court-1',
  '/js/pages/daily-real-court-layout.js?v=20260802-community-court-1',
  '/js/pages/daily-community-court.js?v=20260802-community-court-1'
]) {
  if (!sw.includes(asset)) errors.push(`service worker asset missing: ${asset}`);
}

if (errors.length) {
  console.error(`Daily community court validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}
console.log('Daily community court validation passed: one writing entry, anonymous public cases, fixed choices, AI comparison, and protected rankings.');
