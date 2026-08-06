import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sourceExports } from './check-deployed-functions.mjs';

const read = file => fs.readFileSync(file, 'utf8');
const html = read('public/dripso/index.html');
const app = read('public/dripso/app-v4.js');
const css = read('public/dripso/app-v4.css');
const serviceNavCss = read('public/dripso/service-nav-unity.css');
const gameServer = read('functions/dripso-game.js');
const tournamentServer = read('functions/dripso-tournament.js');
const functionBundle = read('functions/dripso-bundle.js');
const functionsMain = read('functions/main.js');
const courtNav = read('public/js/components/nav.js');
const courtGuard = read('public/js/dripso-entry-guard.js');
const courtCss = read('public/css/dripso-entry.css');
const courtIndex = read('public/index.html');
const serviceWorker = read('public/sw.js');

for (const [value, label] of [
  ['blank', '빈칸채우기'], ['naming', '이름붙이기'], ['comeback', '받아치기'],
  ['wrong', '오답제출'], ['headline', '뉴스제목'], ['excuse', '변명대회'], ['manual', '사용설명서']
]) {
  assert.ok(html.includes(`value="${value}"`), `배틀 선택지 누락: ${value}`);
  assert.ok(html.includes(label), `배틀 명칭 누락: ${label}`);
  assert.ok(app.includes(`${value}: {`), `통합 앱 메타데이터 누락: ${value}`);
}

for (const required of [
  '파이널4 드립판을 열어주세요', '익명 1대1 예선 상위 네 작품이 파이널4에 진출',
  'data-nav="home"', 'data-nav="browse"', 'data-nav="create"', 'data-nav="court"', 'data-nav="account"',
  '<small>홈</small>', '<small>배틀찾기</small>', '<small>배틀열기</small>', '<small>판결소</small>', '<small>내 정보</small>',
  'id="entry-duration"', 'id="voting-duration"', 'id="finals-duration"',
  '/dripso/app-v4.css?v=20260804-dripso-v4-audit-1',
  '/dripso/service-nav-unity.css?v=20260806-unified-service-nav-1',
  '/dripso/app-v4.js?v=20260804-dripso-v4-audit-1'
]) assert.ok(html.includes(required), `드립소 v4 화면 누락: ${required}`);

for (const retired of [
  'data-nav="daily"', '<small>오늘의 한줄</small>', '<small>미친작명소</small>', '<small>상황드립</small>',
  '<script type="module" src="/dripso/battle-v2.js', '<script type="module" src="/dripso/tournament-v3.js',
  '<script type="module" src="/dripso/official-ui.js', 'class="site-switcher"', 'data-nav="popular"', 'data-nav="hall"'
]) assert.ok(!html.includes(retired), `종료된 화면 계층이 활성화됨: ${retired}`);

for (const required of [
  '오늘의 공식 경기', '처음 오셨나요?', '생각나는 방식부터 고르세요',
  '지금 출전할 수 있는 경기', '지금 심사할 수 있는 경기',
  'battle-filter-stack', "['all', '전체']", "['entry', '출전 중']", "['vote', '심사 중']", "['closed', '종료']",
  '한 계정당 한 작품만 출전합니다.', 'ANONYMOUS DUEL', 'DRIPSO CHAMPION', 'FINAL RANKING',
  'renderTournamentTopic', 'renderV2Topic', 'renderLegacyTopic', 'tournamentBracket', 'winnerShowcase',
  'clearImage', 'handleImage', 'renderCurrentRoute'
]) assert.ok(app.includes(required), `사용자 흐름 누락: ${required}`);

for (const required of [
  '.v4-hero', '.official-spotlight', '.battle-mode-grid', '.battle-filter-stack',
  '.v4-page-heading', '.v4-topic-card', '.v4-topic-detail', '.v4-empty',
  '@media (min-width: 900px)', '@media (max-width: 760px)', '@media (max-width: 390px)'
]) assert.ok(css.includes(required), `반응형 화면 스타일 누락: ${required}`);

for (const required of [
  ".site-header .site-switcher",
  ".site-header .header-actions",
  ".dripso-bottom-nav a[data-nav='create']",
  ".dripso-bottom-nav a[data-nav='court']",
  ".dripso-bottom-nav a[data-nav='account']"
]) assert.ok(serviceNavCss.includes(required), `서비스 이동 스타일 누락: ${required}`);

for (const required of [
  'const MAX_ENTRIES = 64', 'function entryIdFor(topicId, uid)',
  "phaseFor(topic) !== 'recruiting'", "phaseFor(topic) !== 'voting'",
  '본인이 출전한 작품이 포함된 대결에는 투표할 수 없습니다.', '이미 평가한 두 작품입니다.'
]) assert.ok(gameServer.includes(required), `게임 버전 2 서버 호환 누락: ${required}`);
for (const required of [
  'const GAME_VERSION = 3', "leftEntryId: seedIds[0], rightEntryId: seedIds[3]",
  "leftEntryId: seedIds[1], rightEntryId: seedIds[2]", 'semifinalByeEntryId',
  'championEntryId', 'runnerUpEntryId', 'return Number(match.leftSeed) <= Number(match.rightSeed)'
]) assert.ok(tournamentServer.includes(required), `파이널4 서버 규칙 누락: ${required}`);

assert.ok(functionsMain.includes("Object.assign(exports, require('./dripso-bundle'))"), '드립소 공개 함수 번들이 메인에 연결되어야 합니다.');
for (const required of [
  'exports.createDripsoTopic = legacy.createDripsoTopic',
  'exports.createDripsoBattle = game.createDripsoBattle',
  'exports.createDripsoTournamentBattle = tournament.createDripsoTournamentBattle',
  'exports.addDripsoComment = game.addDripsoComment',
  'exports.toggleDripsoCommentLike = game.toggleDripsoCommentLike'
]) assert.ok(functionBundle.includes(required), `드립소 함수 번들 누락: ${required}`);

const exports = sourceExports();
for (const name of [
  'createDripsoTopic', 'createDripsoBattle', 'submitDripsoBattleEntry', 'getDripsoBattleView',
  'getDripsoBattleMatchup', 'voteDripsoBattleMatchup', 'createDripsoTournamentBattle',
  'submitDripsoTournamentEntry', 'getDripsoTournamentView', 'getDripsoTournamentMatchup',
  'voteDripsoTournamentMatchup', 'addDripsoComment', 'toggleDripsoCommentLike'
]) assert.ok(exports.has(name), `배포 대상 함수 누락: ${name}`);

for (const required of [
  'href="/dripso/#/" class="nav-item"',
  '<span class="nav-label">드립소</span>',
  '<span class="nav-label" id="nav-account-label">내 정보</span>',
  '<span class="nav-label">사건접수</span>'
]) assert.ok(courtNav.includes(required), `판결소 하단 서비스 메뉴 누락: ${required}`);

for (const required of [
  "const SERVICE_HUB_ID = 'sosoking-service-hub'",
  "logo.textContent = '👤 내 정보'",
  "title: '판결소 활동'",
  "title: '드립소 활동'",
  "href: '/dripso/#/browse'",
  "document.getElementById(RETIRED_BUTTON_ID)?.remove()"
]) assert.ok(courtGuard.includes(required), `공통 내 정보 화면 누락: ${required}`);

for (const retired of [
  'buildQuickButton', 'buildQuickPanel', 'togglePanel', "document.body.insertBefore(button, themeToggle)",
  "entry.id = 'dripso-home-entry'", "homeContent.append(entry)"
]) assert.ok(!courtGuard.includes(retired), `종료된 서비스 이동 코드가 남아 있습니다: ${retired}`);

for (const required of [
  '.nav-service-mark', '.sosoking-service-hub', '.sosoking-service-hub-links',
  '.sosoking-service-hub-link', "[data-theme='light'] .sosoking-service-hub", '@media (prefers-reduced-motion: reduce)'
]) assert.ok(courtCss.includes(required), `공통 내 정보 스타일 누락: ${required}`);

for (const asset of [
  '/css/dripso-entry.css?v=20260806-unified-service-nav-1',
  '/js/app.js?v=20260806-unified-service-nav-1',
  '/js/dripso-entry-guard.js?v=20260806-unified-service-nav-1'
]) {
  assert.ok(courtIndex.includes(asset), `판결소 통합 서비스 자산 누락: ${asset}`);
  assert.ok(serviceWorker.includes(`'${asset}'`), `서비스워커 통합 서비스 자산 누락: ${asset}`);
}
assert.ok(serviceWorker.includes("'/dripso/service-nav-unity.css?v=20260806-unified-service-nav-1'"));

console.log('Dripso experience validation passed: court and Dripso use matching five-item bottom navigation and one shared account page without duplicate top shortcuts.');
