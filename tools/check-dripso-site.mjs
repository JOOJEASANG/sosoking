import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const requiredFiles = [
  'public/dripso/index.html',
  'public/dripso/app-v4.js',
  'public/dripso/app-v4.css',
  'public/dripso/moderation.js',
  'functions/dripso.js',
  'functions/dripso-game.js',
  'functions/dripso-tournament.js',
  'functions/dripso-bundle.js'
];
for (const file of requiredFiles) assert.ok(fs.existsSync(file), `필수 파일 누락: ${file}`);

const html = read('public/dripso/index.html');
const app = read('public/dripso/app-v4.js');
const css = read('public/dripso/app-v4.css');
const sw = read('public/sw.js');
const bundle = read('functions/dripso-bundle.js');
const rules = read('firestore.rules');
const deploy = read('.github/workflows/firebase-deploy.yml');

for (const required of [
  '<title>드립소 - 블라인드 파이널4 드립배틀</title>',
  '/dripso/app-v4.css?v=20260804-dripso-v4-audit-1',
  '/dripso/app-v4.js?v=20260804-dripso-v4-audit-1',
  '/dripso/moderation.js?v=20260804-dripso-v4-audit-1',
  'id="dripso-app"', 'id="topic-dialog"', 'id="topic-form"',
  'data-nav="home"', 'data-nav="browse"', 'data-nav="popular"', 'data-nav="hall"', 'data-nav="create"',
  'value="blank"', 'value="naming"', 'value="comeback"', 'value="wrong"', 'value="headline"', 'value="excuse"', 'value="manual"'
]) assert.ok(html.includes(required), `드립소 HTML 누락: ${required}`);

for (const retired of [
  '<script type="module" src="/dripso/battle-v2.js',
  '<script type="module" src="/dripso/battle-v2-pagination.js',
  '<script type="module" src="/dripso/tournament-v3.js',
  '<script type="module" src="/dripso/official-ui.js'
]) assert.ok(!html.includes(retired), `중복 실행 스크립트가 다시 활성화됨: ${retired}`);
assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), '인라인 스크립트는 사용할 수 없습니다.');
assert.ok(!/\son[a-z]+\s*=\s*["']/i.test(html), '인라인 이벤트 속성은 사용할 수 없습니다.');

for (const mode of ['blank', 'naming', 'comeback', 'wrong', 'headline', 'excuse', 'manual']) {
  assert.ok(app.includes(`${mode}: {`), `통합 앱 종목 메타 누락: ${mode}`);
}
for (const required of [
  "httpsCallable(functions, 'createDripsoTournamentBattle')",
  "httpsCallable(functions, 'submitDripsoTournamentEntry')",
  "httpsCallable(functions, 'getDripsoTournamentView')",
  "httpsCallable(functions, 'getDripsoTournamentMatchup')",
  "httpsCallable(functions, 'voteDripsoTournamentMatchup')",
  "httpsCallable(functions, 'submitDripsoBattleEntry')",
  "httpsCallable(functions, 'getDripsoBattleView')",
  "httpsCallable(functions, 'addDripsoComment')",
  'async function fetchAllTopics', 'startAfter', "orderBy('createdAt', 'desc')",
  'async function renderHome', 'async function renderBrowse', 'async function renderPopular', 'async function renderHall',
  'async function renderTournamentTopic', 'async function renderV2Topic', 'async function renderLegacyTopic',
  'async function compressImage', 'function safeImageUrl', "topicForm.addEventListener('submit'",
  "window.dispatchEvent(new CustomEvent('dripso:rendered'"
]) assert.ok(app.includes(required), `통합 앱 기능 누락: ${required}`);
for (const forbidden of ['setDoc(', 'addDoc(', 'updateDoc(', 'deleteDoc(', 'innerHTML', 'eval(', 'new MutationObserver']) {
  assert.ok(!app.includes(forbidden), `통합 앱 직접쓰기·중복관찰 패턴 발견: ${forbidden}`);
}

for (const required of [
  '--content-width: 880px', '--page-gutter:', '.official-spotlight', '.battle-filter-stack',
  '.v4-topic-card', '.v4-topic-detail', '.topic-dialog', 'grid-template-columns: repeat(2, minmax(0, 1fr))',
  'border-radius: 24px 24px 0 0', '@media (max-width: 390px)'
]) assert.ok(css.includes(required), `통합 레이아웃 스타일 누락: ${required}`);

for (const required of [
  "exports.createDripsoTopic = legacy.createDripsoTopic",
  'exports.createDripsoBattle = game.createDripsoBattle',
  'exports.createDripsoTournamentBattle = tournament.createDripsoTournamentBattle',
  'exports.voteDripsoTournamentMatchup = tournament.voteDripsoTournamentMatchup'
]) assert.ok(bundle.includes(required), `서버 함수 번들 누락: ${required}`);

for (const required of [
  'topic.data.gameVersion != 2 && topic.data.gameVersion != 3',
  'request.time >= topic.data.finalDeadline',
  'match /dripso_tournament_matches/{topicId}/items/{matchId}',
  'allow create, update, delete: if false;'
]) assert.ok(rules.includes(required), `Firestore 보호 규칙 누락: ${required}`);

for (const name of [
  'functions:createDripsoBattle', 'functions:submitDripsoBattleEntry',
  'functions:createDripsoTournamentBattle', 'functions:submitDripsoTournamentEntry',
  'functions:getDripsoTournamentView', 'functions:getDripsoTournamentMatchup', 'functions:voteDripsoTournamentMatchup'
]) assert.ok(deploy.includes(name), `배포 함수 누락: ${name}`);

for (const asset of [
  "'/dripso/app-v4.css?v=20260804-dripso-v4-audit-1'",
  "'/dripso/app-v4.js?v=20260804-dripso-v4-audit-1'",
  "'/dripso/moderation.js?v=20260804-dripso-v4-audit-1'"
]) assert.ok(sw.includes(asset), `서비스워커 v4 자산 누락: ${asset}`);

console.log('Dripso validation passed: one consolidated responsive app serves seven modes, legacy and v2 compatibility, Final Four, moderation, protected writes, pagination, and offline assets.');
