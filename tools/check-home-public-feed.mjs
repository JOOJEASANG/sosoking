import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');

const homeCourt = read('public/js/pages/home-court.js');
for (const required of [
  'async function applySafePublicFeed(container)',
  'const HOME_PUBLIC_RECORD_LIMIT = 5',
  'loadSafePublicResults',
  'maxRows: HOME_PUBLIC_RECORD_LIMIT',
  'record.sentence || record.publicCaseDescription || record.verdict',
  'publicFeedCard(caseId, record)',
  'data-public-result-link="true"',
  'href="#/result/${encodeURIComponent(caseId)}"',
  '판결문 바로 보기 →'
]) {
  if (!homeCourt.includes(required)) errors.push(`public/js/pages/home-court.js: missing ${required}`);
}
if (homeCourt.includes('record.caseDescription') || homeCourt.includes('r.caseDescription')) {
  errors.push('public/js/pages/home-court.js: raw caseDescription is used in the active home feed');
}
if (!homeCourt.includes('await Promise.all([')
  || !homeCourt.includes('applySafePublicFeed(container)')) {
  errors.push('public/js/pages/home-court.js: safe public feed is not awaited by the active renderer');
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

const board = read('public/js/pages/board.js');
for (const required of [
  'loadSafePublicResults',
  'maxRows: 40',
  'data-public-result-link="true"',
  '`#/result/${encodeURIComponent(id)}`',
  '판결문 바로 보기'
]) {
  if (!board.includes(required)) errors.push(`public/js/pages/board.js: missing ${required}`);
}

const app = read('public/js/app.js');
for (const moduleUrl of [
  './pages/home-court.js?v=20260730-public-records-2',
  './pages/board-court.js?v=20260730-public-records-2'
]) {
  if (!app.includes(moduleUrl)) errors.push(`public/js/app.js: active module version is stale: ${moduleUrl}`);
}

const boardCourt = read('public/js/pages/board-court.js');
if (!boardCourt.includes("./board.js?v=20260730-public-records-2")) {
  errors.push('public/js/pages/board-court.js: public board module version is stale');
}

const index = read('public/index.html');
const worker = read('public/sw.js');
if (!index.includes('/js/app.js?v=20260730-public-records-2')) {
  errors.push('public/index.html: public record app cache version is missing');
}
for (const required of [
  'sosoking-app-v20260730-public-records-2',
  '/js/app.js?v=20260730-public-records-2',
  '/js/pages/home-court.js?v=20260730-public-records-2',
  '/js/pages/board-court.js?v=20260730-public-records-2',
  '/js/pages/board.js?v=20260730-public-records-2',
  '/js/utils/public-results.js?v=20260730-public-records-2'
]) {
  if (!worker.includes(required)) errors.push(`public/sw.js: missing ${required}`);
}

if (errors.length) {
  console.error(`Home public feed validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Home public feed validation passed: five recent sanitized records load resiliently and link directly to verdict content.');
