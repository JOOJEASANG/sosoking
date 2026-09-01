import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');

const home = read('public/js/pages/home.js');
for (const required of [
  'async function loadPublicFeed(container)',
  'const HOME_PUBLIC_RECORD_LIMIT = 5',
  "const JURY_TARGET_KEY = 'sosoking-jury-target-case'",
  'loadSafePublicResults',
  'maxRows: HOME_PUBLIC_RECORD_LIMIT',
  'record.publicCaseDescription || record.reception || record.investigation',
  'publicFeedCard(caseId, record)',
  'data-public-jury-case-id=',
  'href="#/jury"',
  'sessionStorage.setItem(JURY_TARGET_KEY, caseId)',
  '사건 읽고 판정하기 →',
  '최근 공개 사건 5건'
]) {
  if (!home.includes(required)) errors.push(`public/js/pages/home.js: missing ${required}`);
}
if (home.includes('record.caseDescription') || home.includes('r.caseDescription')) {
  errors.push('public/js/pages/home.js: raw caseDescription is used in the active home feed');
}
const summarySource = home.split('function publicSummary(record = {}) {')[1]?.split('\n}')[0] || '';
if (summarySource.includes('record.verdict') || summarySource.includes('record.sentence')) {
  errors.push('public/js/pages/home.js: home preview can leak verdict/sentence before jury participation');
}
if (home.includes('data-public-result-link="true"') || home.includes('판결문 보기 →')) {
  errors.push('public/js/pages/home.js: old direct-verdict home card remains');
}
if (!home.includes('loadPublicFeed(container)')) {
  errors.push('public/js/pages/home.js: safe public feed is not invoked by the active renderer');
}

const loader = read('public/js/utils/public-results.js');
for (const required of [
  "where('isPublic', '==', true)",
  "where('publicDataVersion', '==', 1)",
  "orderBy('createdAt', 'desc')",
  "code.includes('failed-precondition')",
  'using client-side ordering',
  '.sort((a, b) => timestampMillis'
]) {
  if (!loader.includes(required)) errors.push(`public/js/utils/public-results.js: missing ${required}`);
}

const jury = read('public/js/pages/jury.js');
for (const required of [
  'loadSafePublicResults',
  'maxRows: 60',
  'publicCaseDescription',
  'jury-list-card',
  '판정하기',
  'response.data?.reaction',
  'result-derived indicators'
]) {
  if (!jury.includes(required) && required !== 'result-derived indicators') {
    errors.push(`public/js/pages/jury.js: missing ${required}`);
  }
}
if (!jury.includes('결과성 지표')) errors.push('public/js/pages/jury.js: pre-vote result-derived indicator notice is missing');
if (jury.includes('data?.caseDescription')) {
  errors.push('public/js/pages/jury.js: raw caseDescription is used in the public jury list');
}
if (jury.includes('jury-list-grievance') || jury.includes('억울지수')) {
  errors.push('public/js/pages/jury.js: result-derived grievance signal is visible before voting');
}

const hall = read('public/js/pages/hall.js');
for (const required of [
  'loadSafePublicResults',
  'maxRows: 100',
  '명예의 전당',
  '#/jury',
  'discussionSection(rows)',
  '토론 활발 사건'
]) {
  if (!hall.includes(required)) errors.push(`public/js/pages/hall.js: missing ${required}`);
}
if (hall.includes('grievanceSection') || hall.includes('억울지수 TOP') || hall.includes('validGrievance')) {
  errors.push('public/js/pages/hall.js: result-derived grievance ranking remains in the blind hall');
}

const app = read('public/js/app.js');
for (const moduleUrl of [
  "./pages/home.js?v=20260830-final-blind-1",
  "./pages/hall.js?v=20260830-final-blind-1",
  "./pages/jury.js?v=20260901-daily-vote-feedback-1"
]) {
  if (!app.includes(moduleUrl)) errors.push(`public/js/app.js: active module is missing: ${moduleUrl}`);
}
for (const retired of ['home-court.js', 'board.js', 'board-court.js']) {
  if (app.includes(retired)) errors.push(`public/js/app.js: retired public feed module remains: ${retired}`);
}

const index = read('public/index.html');
const worker = read('public/sw.js');
const appVersion = index.match(/<script type="module" src="\/js\/app\.js\?v=([^"']+)"/)?.[1] || '';
if (!appVersion || !worker.includes(`/js/app.js?v=${appVersion}`)) {
  errors.push('public/index.html and public/sw.js: active app cache versions are inconsistent');
}
for (const required of [
  '/js/pages/home.js?v=20260830-final-blind-1',
  '/js/pages/hall.js?v=20260830-final-blind-1',
  '/js/pages/jury.js?v=20260901-daily-vote-feedback-1',
  '/js/utils/public-results.js?v=20260730-public-records-2'
]) {
  if (!worker.includes(required)) errors.push(`public/sw.js: missing ${required}`);
}
for (const retired of ['home-court.js', '/js/pages/board.js', 'board-court.js']) {
  if (worker.includes(retired)) errors.push(`public/sw.js: retired public feed module remains cached: ${retired}`);
}
if (!/^const CACHE_NAME = 'sosoking-app-v[^']+';/m.test(worker)) {
  errors.push('public/sw.js: versioned application cache name is missing');
}

if (errors.length) {
  console.error(`Public feed validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Public feed validation passed: home, jury and hall stay blind before voting and use only sanitized public results.');
