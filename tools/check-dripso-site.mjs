import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const requiredFiles = [
  'public/dripso/index.html',
  'public/dripso/app-v4.js',
  'public/dripso/app-v4.css',
  'public/dripso/service-nav-unity.css',
  'public/dripso/moderation.js',
  'public/js/components/nav.js',
  'public/js/dripso-entry-guard.js',
  'public/css/dripso-entry.css',
  'functions/dripso.js',
  'functions/dripso-game.js',
  'functions/dripso-tournament.js',
  'functions/dripso-bundle.js'
];
for (const file of requiredFiles) assert.ok(fs.existsSync(file), `필수 파일 누락: ${file}`);

const html = read('public/dripso/index.html');
const app = read('public/dripso/app-v4.js');
const css = read('public/dripso/app-v4.css');
const serviceNavCss = read('public/dripso/service-nav-unity.css');
const courtNav = read('public/js/components/nav.js');
const accountGuard = read('public/js/dripso-entry-guard.js');
const accountCss = read('public/css/dripso-entry.css');
const courtIndex = read('public/index.html');
const sw = read('public/sw.js');
const bundle = read('functions/dripso-bundle.js');
const rules = read('firestore.rules');
const deploy = read('.github/workflows/firebase-deploy.yml');
const courtAppAsset = courtIndex.match(/<script type="module" src="(\/js\/app\.js\?v=[^"']+)"/)?.[1] || '';
assert.ok(courtAppAsset, '판결소 현재 앱 자산 경로를 찾을 수 없습니다.');

for (const required of [
  '<title>드립소 - 블라인드 파이널4 드립배틀</title>',
  '/dripso/app-v4.css?v=20260804-dripso-v4-audit-1',
  '/dripso/service-nav-unity.css?v=20260806-unified-service-nav-1',
  '/dripso/app-v4.js?v=20260804-dripso-v4-audit-1',
  '/dripso/moderation.js?v=20260804-dripso-v4-audit-1',
  'id="dripso-app"', 'id="topic-dialog"', 'id="topic-form"',
  'id="open-topic-dialog" type="button" hidden aria-hidden="true" tabindex="-1"',
  'data-nav="home"', 'data-nav="browse"', 'data-nav="create"', 'data-nav="court"', 'data-nav="account"',
  'href="/#/" data-nav="court"', 'href="/#/auth" data-nav="account"',
  '<small>판결소</small>', '<small>내 정보</small>',
  'value="blank"', 'value="naming"', 'value="comeback"', 'value="wrong"', 'value="headline"', 'value="excuse"', 'value="manual"'
]) assert.ok(html.includes(required), `드립소 HTML 누락: ${required}`);

for (const retired of [
  '<script type="module" src="/dripso/battle-v2.js',
  '<script type="module" src="/dripso/battle-v2-pagination.js',
  '<script type="module" src="/dripso/tournament-v3.js',
  '<script type="module" src="/dripso/official-ui.js',
  'class="write-fab"',
  'class="site-switcher"',
  'data-nav="popular"',
  'data-nav="hall"'
]) assert.ok(!html.includes(retired), `중복 또는 종료된 화면 계층이 활성화됨: ${retired}`);
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
  "grid-template-columns: minmax(0, 1fr) !important",
  ".site-header .site-switcher",
  ".site-header .header-actions",
  ".dripso-bottom-nav a[data-nav='create']",
  ".dripso-bottom-nav a[data-nav='court']",
  ".dripso-bottom-nav a[data-nav='account']"
]) assert.ok(serviceNavCss.includes(required), `서비스 통합 내비게이션 스타일 누락: ${required}`);

for (const required of [
  'href="/dripso/#/" class="nav-item"',
  '<span class="nav-label">드립소</span>',
  '<span class="nav-label" id="nav-account-label">내 정보</span>',
  '<span class="nav-label">사건접수</span>',
  "nav.setAttribute('aria-label', '판결소 메뉴')"
]) assert.ok(courtNav.includes(required), `판결소 통합 하단 메뉴 누락: ${required}`);

for (const required of [
  "const SERVICE_HUB_ID = 'sosoking-service-hub'",
  "logo.textContent = '👤 내 정보'",
  "title: '판결소 활동'",
  "title: '드립소 활동'",
  "href: '/dripso/#/browse'",
  "document.getElementById(RETIRED_BUTTON_ID)?.remove()"
]) assert.ok(accountGuard.includes(required), `공통 내 정보 구성 누락: ${required}`);
for (const retired of [
  'buildQuickButton', 'buildQuickPanel', 'togglePanel', "document.body.insertBefore(button, themeToggle)"
]) assert.ok(!accountGuard.includes(retired), `종료된 상단 드립소 버튼 코드가 남아 있습니다: ${retired}`);

for (const required of [
  '.nav-service-mark', '.sosoking-service-hub', '.sosoking-service-hub-links',
  '.sosoking-service-hub-link', "[data-theme='light'] .sosoking-service-hub", '@media (max-width: 380px)'
]) assert.ok(accountCss.includes(required), `공통 내 정보 스타일 누락: ${required}`);

for (const asset of [
  '/css/dripso-entry.css?v=20260806-unified-service-nav-1',
  courtAppAsset,
  '/js/dripso-entry-guard.js?v=20260806-unified-service-nav-1'
]) assert.ok(courtIndex.includes(asset), `판결소 통합 자산 누락: ${asset}`);

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
  "'/dripso/service-nav-unity.css?v=20260806-unified-service-nav-1'",
  "'/dripso/app-v4.js?v=20260804-dripso-v4-audit-1'",
  "'/dripso/moderation.js?v=20260804-dripso-v4-audit-1'",
  "'/css/dripso-entry.css?v=20260806-unified-service-nav-1'",
  `'${courtAppAsset}'`,
  "'/js/dripso-entry-guard.js?v=20260806-unified-service-nav-1'",
  "'/js/components/nav.js?v=20260806-unified-service-nav-1'",
  "'/js/components/header-icons.js?v=20260806-unified-service-nav-1'"
]) assert.ok(sw.includes(asset), `서비스워커 통합 자산 누락: ${asset}`);

console.log('Dripso validation passed: one consolidated responsive app keeps one create entry and uses matching five-item bottom navigation with the court and shared account.');
