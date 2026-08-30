import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');
const need = (source, value, label) => {
  if (!source.includes(value)) errors.push(`${label}: missing ${value}`);
};

const home = read('public/js/pages/home.js');
for (const value of [
  "{ name: '꼰대형'",
  "{ name: '냉혈형'",
  "{ name: '회피형'",
  "{ name: '추궁형'",
  "{ name: '오버형'",
  "{ name: '드립형'",
  "{ name: '빙의형'",
  '담당 판사는 사건마다 자동 배정',
  '7명의 AI 판사',
  '같은 사건도 판사의 성격에 따라'
]) need(home, value, 'canonical home judge guidance');
if ((home.match(/\{ name: '[^']+'/g) || []).length !== 7) {
  errors.push('canonical home judge guidance: judge count is not exactly seven');
}
if (home.includes('운명에 맡기기') || home.includes('판사 선택')) {
  errors.push('canonical home judge guidance: obsolete judge selection copy remains');
}

const hall = read('public/js/pages/hall.js');
for (const value of [
  'loadSafePublicResults',
  '명예의 전당',
  '민심소',
  'reactionTotal',
  'commentCount',
  'grievanceIndex'
]) need(hall, value, 'hall ranking');
if (hall.includes('hashString(`${id}:grievance`)') || hall.includes('grievance`) % 10')) {
  errors.push('hall ranking: synthetic grievance fallback remains');
}

const jury = read('public/js/pages/jury.js');
for (const value of [
  'loadSafePublicResults',
  '가려진 판결을 먼저 맞혀보세요',
  'jury-list-card',
  '원고 승',
  '피고 승',
  '쌍방 과실'
]) need(jury, value, 'jury list');
if (jury.includes('Number(data?.grievanceIndex) || 5')) {
  errors.push('jury list: synthetic grievance default remains');
}

const app = read('public/js/app.js');
need(app, "import { renderHome } from './pages/home.js?v=20260830-final-audit-1';", 'active home module');
need(app, "import { renderHall } from './pages/hall.js?v=20260829-arena-2';", 'active hall module');
need(app, "else if (hash === '#/board') renderTask = renderHall(content);", 'board compatibility route');
for (const retired of [
  'home-judge-assignment.js',
  'home-no-search.js',
  'board.js',
  'board-court.js',
  'board-search-pagination.js',
  'board-full-content-search.js'
]) {
  if (app.includes(retired)) errors.push(`public/js/app.js: retired module remains active: ${retired}`);
}

const index = read('public/index.html');
const worker = read('public/sw.js');
const appVersion = index.match(/<script type="module" src="\/js\/app\.js\?v=([^"']+)"/)?.[1] || '';
if (!appVersion || !worker.includes(`/js/app.js?v=${appVersion}`)) {
  errors.push('public/index.html and public/sw.js: active application versions differ');
}
for (const value of [
  "const CACHE_NAME = 'sosoking-app-v20260830-final-audit-1';",
  '/js/pages/home.js?v=20260830-final-audit-1',
  '/js/pages/hall.js?v=20260829-arena-2',
  '/js/pages/jury.js?v=20260830-jury-vote-fix-1'
]) need(worker, value, 'active cache');
for (const retired of [
  'home-judge-assignment.js',
  'home-no-search.js',
  '/js/pages/board.js',
  'board-search-pagination.js',
  'board-full-content-search.js',
  'judge-final-guard.js',
  'judge-runtime-guard.js'
]) {
  if (worker.includes(retired)) errors.push(`public/sw.js: retired module remains cached: ${retired}`);
}

if (errors.length) {
  console.error(`Judge and public ranking validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Judge and public ranking validation passed: seven automatic judges, canonical hall/jury flow, no synthetic grievance score, and retired board/search modules are absent.');
