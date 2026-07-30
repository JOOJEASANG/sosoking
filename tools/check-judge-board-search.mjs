import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');
const need = (source, value, label) => {
  if (!source.includes(value)) errors.push(`${label}: missing ${value}`);
};

const judgeNotice = read('public/js/pages/home-judge-assignment.js');
for (const value of [
  '담당 판사는 자동 배정됩니다',
  '실제 재판에서 당사자가 담당 판사를 직접 선택하지 않는 것처럼',
  '7명의 AI 판사 중 한 명이 자동으로 배정됩니다',
  '재판이 시작될 때 확인할 수 있습니다',
  'addJudgeAssignmentNotice(container)'
]) need(judgeNotice, value, 'home judge notice');

const homeNoSearch = read('public/js/pages/home-no-search.js');
for (const value of [
  "./home-judge-assignment.js?v=20260730-judge-board-search-1",
  "container.querySelector('#feed-search')",
  'searchRow.remove()',
  'removeHomeSearch(container)'
]) need(homeNoSearch, value, 'home search removal');

const pagination = read('public/js/pages/board-search-pagination.js');
for (const value of [
  'const PAGE_SIZE = 10;',
  'id="board-search-input"',
  '판결기록 검색',
  'cards.filter(card => card.dataset.boardSearch.includes(keyword))',
  'Math.ceil(filtered.length / PAGE_SIZE)',
  'data-board-page',
  '10개씩',
  '검색 조건에 맞는 판결기록이 없습니다'
]) need(pagination, value, 'board search pagination');

const fullSearch = read('public/js/pages/board-full-content-search.js');
for (const value of [
  "./board-search-pagination.js?v=20260730-judge-board-search-1",
  'loadSafePublicResults',
  'collectPublicText(value',
  "'caseDescription'",
  'maxRows: 100',
  'fallbackRows: 200',
  'caseIdFromCard(card)',
  'card.dataset.boardSearch = normalizeSearch',
  '사건명, 사건내용, 수사·변론·판결문 전체 검색',
  '공개 판결문 전체 내용을 검색하는 중입니다'
]) need(fullSearch, value, 'full verdict content search');

const app = read('public/js/app.js');
need(app, './pages/home-no-search.js?v=20260730-search-scope-1', 'active home module');
need(app, './pages/board-full-content-search.js?v=20260730-search-scope-1', 'active board module');

const index = read('public/index.html');
const worker = read('public/sw.js');
const appVersion = index.match(/<script type="module" src="\/js\/app\.js\?v=([^"']+)"/)?.[1] || '';
if (!appVersion || !worker.includes(`/js/app.js?v=${appVersion}`)) {
  errors.push('public/index.html and public/sw.js: active application versions differ');
}
for (const value of [
  "const CACHE_NAME = 'sosoking-app-v20260730-search-scope-1';",
  '/js/pages/home-no-search.js?v=20260730-search-scope-1',
  '/js/pages/board-full-content-search.js?v=20260730-search-scope-1'
]) need(worker, value, 'active cache');

if (errors.length) {
  console.error(`Judge assignment and board search validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Judge assignment and board search validation passed: automatic judge guidance, search-free home, full verdict content search, ten-item pages, and cache wiring are active.');
