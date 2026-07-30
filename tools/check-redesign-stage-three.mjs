import fs from 'node:fs';

const errors = [];
const read = path => fs.readFileSync(path, 'utf8');
const need = (source, text, label) => {
  if (!source.includes(text)) errors.push(`${label}: missing ${text}`);
};

const css = read('public/css/redesign-stage-three.css');
for (const text of [
  '.result-redesign-host',
  '.result-cover.card',
  '.judge-summary',
  '.result-paper.card',
  '.result-actions',
  '.board-redesign-host',
  '#court-board-intro',
  '#board-search-panel',
  '.court-board-row',
  '#board-pagination',
  '@media (max-width:640px)'
]) need(css, text, 'stage three stylesheet');

const result = read('public/js/pages/result-comments.js');
for (const text of [
  "./result-court.js?v=20260729-dark-record-participation-1",
  "container.classList.add('result-redesign-host')",
  'stripJuryVote(container)',
  'addEntertainmentNotice(container)',
  'addDiscussionLink(container, caseId)'
]) need(result, text, 'verdict decorator');

const board = read('public/js/pages/board-full-content-search.js');
for (const text of [
  "./board-search-pagination.js?v=20260730-judge-board-search-1",
  "container.classList.add('board-redesign-host')",
  "intro.querySelector('.arena-rank-tabs')?.remove()",
  "title.textContent = '공개 판결기록'",
  'installFullContentSearch(container)',
  'applyBoardRedesign(container)'
]) need(board, text, 'records decorator');
for (const privateKey of ['userId', 'nickname', 'caseDescription', 'email', 'phoneNumber', 'authorUid', 'ownerUid']) {
  need(board, `'${privateKey}'`, 'records privacy exclusions');
}

const app = read('public/js/app.js');
for (const text of [
  "./pages/result-comments.js?v=20260730-redesign-stage-3",
  "./pages/board-full-content-search.js?v=20260730-redesign-stage-3"
]) need(app, text, 'application');

const index = read('public/index.html');
const worker = read('public/sw.js');
need(index, '/css/redesign-stage-three.css?v=20260730-redesign-stage-3', 'index');
need(worker, '/css/redesign-stage-three.css?v=20260730-redesign-stage-3', 'service worker');
for (const text of [
  '/js/pages/result-comments.js?v=20260730-redesign-stage-3',
  '/js/pages/board-full-content-search.js?v=20260730-redesign-stage-3',
  '/js/pages/result-comments.js?v=20260730-discussion-court-1',
  '/js/pages/board-full-content-search.js?v=20260730-search-scope-1'
]) need(worker, text, 'service worker');
const appVersion = index.match(/<script type="module" src="\/js\/app\.js\?v=([^"']+)"/)?.[1] || '';
if (!appVersion || !worker.includes(`/js/app.js?v=${appVersion}`)) {
  errors.push('index and service worker active app versions differ');
}
need(worker, "const CACHE_NAME = 'sosoking-app-v", 'service worker');

const packageJson = read('package.json');
need(packageJson, 'node tools/check-redesign-stage-three.mjs', 'validation chain');

if (errors.length) {
  console.error(`Stage three redesign validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Stage three redesign validation passed: verdict documents, public record search, pagination, privacy exclusions, discussion links, and cache compatibility remain connected.');
