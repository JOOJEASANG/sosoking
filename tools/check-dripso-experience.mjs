import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sourceExports } from './check-deployed-functions.mjs';

const read = file => fs.readFileSync(file, 'utf8');
const html = read('public/dripso/index.html');
const battle = read('public/dripso/battle-v2.js');
const battleCss = read('public/dripso/battle.css');
const gameCss = read('public/dripso/battle-game.css');
const navigationCss = read('public/dripso/dripso-navigation.css');
const gameServer = read('functions/dripso-game.js');
const functionBundle = read('functions/dripso-bundle.js');
const courtGuard = read('public/js/dripso-entry-guard.js');
const courtCss = read('public/css/dripso-entry.css');
const courtIndex = read('public/index.html');
const functionsMain = read('functions/main.js');

const modes = [
  ['blank', '빈칸채우기'],
  ['naming', '이름붙이기'],
  ['comeback', '받아치기'],
  ['wrong', '오답제출'],
  ['headline', '뉴스제목'],
  ['excuse', '변명대회'],
  ['manual', '사용설명서']
];

for (const [value, label] of modes) {
  assert.ok(html.includes(`value="${value}"`), `배틀 등록 선택지 누락: ${value}`);
  assert.ok(html.includes(label), `배틀 명칭 누락: ${label}`);
  assert.ok(battle.includes(`${value}: {`), `배틀 메타데이터 누락: ${value}`);
}

for (const required of [
  '먼저 출전하고, 마감 뒤 두 작품씩 붙습니다.',
  '출전 중에는 작품이 공개되지 않습니다.',
  'data-nav="home"',
  'data-nav="browse"',
  'data-nav="popular"',
  'data-nav="hall"',
  'data-nav="create"',
  'id="entry-duration"',
  'id="voting-duration"',
  'class="site-switcher"',
  'class="site-switch-link" href="/">⚖️ 판결소</a>',
  'class="site-switch-link active" href="/dripso/#/"',
  '/dripso/battle-game.css?v=20260803-blind-duel-1',
  '/dripso/battle-v2.js?v=20260803-blind-duel-1'
]) {
  assert.ok(html.includes(required), `드립소 게임 화면 변경이 누락되었습니다: ${required}`);
}

for (const forbidden of [
  'data-nav="daily"',
  '<small>오늘의 한줄</small>',
  '<small>미친작명소</small>',
  '<small>상황드립</small>',
  '/dripso/dripso-ui-guard.js',
  '/dripso/pagination.js',
  '/dripso/battle.js?v=20260803-seven-battles-1'
]) {
  assert.ok(!html.includes(forbidden), `종료된 드립소 구조가 남아 있습니다: ${forbidden}`);
}

for (const required of [
  'const GAME_VERSION = 2',
  "if (!mode && topic?.type === 'naming') mode = 'naming'",
  "if (!mode && topic?.type === 'situation') mode = 'comeback'",
  'renderLegacyTopic',
  'renderGameTopic',
  'gameEntryComposer',
  'fillMatchup',
  'resultEntryCard',
  '블라인드 출전 중',
  '1대1 비교심사 중',
  '경기 종료',
  '한 계정당 한 작품만 출전합니다.',
  'ANONYMOUS DUEL',
  'FINAL WINNER',
  'FINAL RANKING'
]) {
  assert.ok(battle.includes(required), `블라인드 게임 흐름 누락: ${required}`);
}

for (const required of [
  '.battle-mode-grid',
  '.battle-mode-tile',
  '.battle-filter-bar',
  '@media (max-width:580px)'
]) {
  assert.ok(battleCss.includes(required), `배틀 기본 스타일 누락: ${required}`);
}
for (const required of [
  '.battle-phase-panel.recruiting',
  '.battle-phase-panel.voting',
  '.battle-duel-choice',
  '.battle-winner-showcase',
  '.game-result-card.battle-winner'
]) {
  assert.ok(gameCss.includes(required), `게임 단계 스타일 누락: ${required}`);
}

for (const required of [
  'const MAX_ENTRIES = 64',
  'function entryIdFor(topicId, uid)',
  "phaseFor(topic) !== 'recruiting'",
  "phaseFor(topic) !== 'voting'",
  '본인이 출전한 작품이 포함된 대결에는 투표할 수 없습니다.',
  '이미 평가한 두 작품입니다.',
  'entries: phase === \'closed\'',
  'includeNickname = true'
]) {
  assert.ok(gameServer.includes(required), `서버 게임 규칙 누락: ${required}`);
}

for (const required of ['.site-switcher', '.site-switch-link.active', '@media (max-width: 650px)']) {
  assert.ok(navigationCss.includes(required), `사이트 전환 스타일 누락: ${required}`);
}

assert.ok(functionsMain.includes("Object.assign(exports, require('./dripso-bundle'))"), '드립소 공개 함수 번들이 메인에 연결되어야 합니다.');
assert.ok(!functionsMain.includes("Object.assign(exports, require('./dripso'))"), '기존 모듈을 메인에서 직접 공개하면 중복 함수가 생깁니다.');
assert.ok(!functionsMain.includes("Object.assign(exports, require('./dripso-game'))"), '게임 모듈을 메인에서 직접 공개하면 중복 함수가 생깁니다.');
assert.ok(!functionsMain.includes("require('./dripso-daily-one-line')"), '종료된 오늘의 한줄 전용 서버 교체가 활성화되어 있습니다.');
for (const required of [
  'exports.createDripsoTopic = legacy.createDripsoTopic',
  'exports.createDripsoBattle = game.createDripsoBattle',
  'exports.addDripsoComment = game.addDripsoComment',
  'exports.toggleDripsoCommentLike = game.toggleDripsoCommentLike'
]) {
  assert.ok(functionBundle.includes(required), `드립소 공개 함수 번들 누락: ${required}`);
}

const deployedSourceExports = sourceExports();
for (const functionName of [
  'createDripsoTopic',
  'createDripsoBattle',
  'submitDripsoBattleEntry',
  'getDripsoBattleView',
  'getDripsoBattleMatchup',
  'voteDripsoBattleMatchup',
  'addDripsoComment',
  'toggleDripsoCommentLike'
]) {
  assert.ok(deployedSourceExports.has(functionName), `공개 드립소 함수가 배포 대상에서 빠졌습니다: ${functionName}`);
}
assert.ok(!deployedSourceExports.has('dailyOneLineAddDripsoComment'), '종료된 내부 구현 이름이 배포 대상 함수로 오인되고 있습니다.');

for (const required of [
  "entry.id = 'dripso-home-entry'",
  "entry.className = 'dripso-home-entry'",
  "court.textContent = '⚖️ 판결소'",
  "dripso.textContent = 'ㅋ 드립소'",
  'const homeContent = hero.parentElement || page',
  'homeContent.append(entry)'
]) {
  assert.ok(courtGuard.includes(required), `판결소 하단 사이트 전환 누락: ${required}`);
}

for (const required of [
  '.dripso-home-entry',
  'width: min(calc(100% - 40px), 560px)',
  'grid-template-columns: repeat(2, minmax(0, 1fr))',
  '.dripso-home-entry-link.active'
]) {
  assert.ok(courtCss.includes(required), `판결소 하단 전환 스타일 누락: ${required}`);
}

assert.ok(courtIndex.includes('/css/dripso-entry.css?v=20260802-dripso-bottom-entry-1'), '판결소가 최신 하단 전환 CSS를 불러와야 합니다.');
assert.ok(courtIndex.includes('/js/dripso-entry-guard.js?v=20260802-dripso-bottom-entry-1'), '판결소가 최신 하단 전환 스크립트를 불러와야 합니다.');

console.log('Dripso experience validation passed: seven quick modes now run as timed blind entry, anonymous pair voting, closed results, a single public Functions bundle, legacy compatibility, and the court switcher remains intact.');
