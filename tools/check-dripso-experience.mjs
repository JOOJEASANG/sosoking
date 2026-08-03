import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sourceExports } from './check-deployed-functions.mjs';

const read = file => fs.readFileSync(file, 'utf8');
const html = read('public/dripso/index.html');
const battle = read('public/dripso/battle.js');
const battleCss = read('public/dripso/battle.css');
const navigationCss = read('public/dripso/dripso-navigation.css');
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
  '문장은 드립소가 준비합니다. 마지막 한 방만 넣으세요.',
  'data-nav="home"',
  'data-nav="browse"',
  'data-nav="popular"',
  'data-nav="hall"',
  'data-nav="create"',
  'class="site-switcher"',
  'class="site-switch-link" href="/">⚖️ 판결소</a>',
  'class="site-switch-link active" href="/dripso/#/"',
  '/dripso/battle.css?v=20260803-seven-battles-1',
  '/dripso/battle.js?v=20260803-seven-battles-1'
]) {
  assert.ok(html.includes(required), `드립소 배틀 화면 변경이 누락되었습니다: ${required}`);
}

for (const forbidden of [
  'data-nav="daily"',
  '<small>오늘의 한줄</small>',
  '<small>미친작명소</small>',
  '<small>상황드립</small>',
  '/dripso/dripso-ui-guard.js',
  '/dripso/pagination.js'
]) {
  assert.ok(!html.includes(forbidden), `종료된 드립소 구조가 남아 있습니다: ${forbidden}`);
}

for (const required of [
  'const MODE_MARKER =',
  '[[dripso-mode:',
  "if (!mode && topic?.type === 'naming') mode = 'naming'",
  "if (!mode && topic?.type === 'situation') mode = 'comeback'",
  "type: mode === 'naming' ? 'naming' : 'situation'",
  'renderBrowse',
  'renderHall',
  'filterBar',
  'modeTile',
  '이 한마디로 출전'
]) {
  assert.ok(battle.includes(required), `배틀 통합·호환 처리 누락: ${required}`);
}

for (const required of [
  '.battle-mode-grid',
  '.battle-mode-tile',
  '.battle-filter-bar',
  '.battle-rule-note',
  '@media (max-width:580px)'
]) {
  assert.ok(battleCss.includes(required), `배틀 전용 스타일 누락: ${required}`);
}

for (const required of ['.site-switcher', '.site-switch-link.active', '@media (max-width: 650px)']) {
  assert.ok(navigationCss.includes(required), `사이트 전환 스타일 누락: ${required}`);
}

assert.ok(functionsMain.includes("Object.assign(exports, require('./dripso'))"), '기존 안전한 드립소 callable 함수가 유지되어야 합니다.');
assert.ok(!functionsMain.includes("require('./dripso-daily-one-line')"), '종료된 오늘의 한줄 전용 서버 교체가 활성화되어 있습니다.');
assert.ok(!functionsMain.includes('dailyOneLineAddDripsoComment'), '오늘의 한줄 내부 구현이 메인 export에 남아 있습니다.');

const deployedSourceExports = sourceExports();
for (const functionName of ['createDripsoTopic', 'addDripsoComment', 'toggleDripsoCommentLike']) {
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

console.log('Dripso experience validation passed: seven quick battle modes replace the retired daily/category menus, legacy naming and situation posts remain readable, and the court switcher stays intact.');
