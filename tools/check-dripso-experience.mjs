import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sourceExports } from './check-deployed-functions.mjs';

const read = file => fs.readFileSync(file, 'utf8');
const html = read('public/dripso/index.html');
const uiGuard = read('public/dripso/dripso-ui-guard.js');
const navigationCss = read('public/dripso/dripso-navigation.css');
const courtGuard = read('public/js/dripso-entry-guard.js');
const courtCss = read('public/css/dripso-entry.css');
const courtIndex = read('public/index.html');
const override = read('functions/dripso-daily-one-line.js');
const functionsMain = read('functions/main.js');

for (const required of [
  '<small>미친작명소</small>',
  '<option value="naming">미친작명소</option>',
  '오늘의 한줄, 미친작명소, 상황드립',
  'class="site-switcher"',
  'class="site-switch-link" href="/">⚖️ 판결소</a>',
  'class="site-switch-link active" href="/dripso/#/"',
  '/dripso/dripso-navigation.css?v=20260802-dripso-navigation-1',
  '/dripso/dripso-ui-guard.js?v=20260802-dripso-navigation-1'
]) {
  assert.ok(html.includes(required), `드립소 HTML 변경이 누락되었습니다: ${required}`);
}

for (const required of [
  'const DAILY_MAX_LENGTH = 120',
  "textarea[name=\"text\"]",
  'area.rows = 1',
  'area.maxLength = DAILY_MAX_LENGTH',
  "area.value.replace(/[\\r\\n]+/g, ' ')",
  "if (event.key !== 'Enter' || event.isComposing) return",
  'form.requestSubmit()',
  "replaceAll('이름짓기', '미친작명소')",
  'new MutationObserver(schedule)'
]) {
  assert.ok(uiGuard.includes(required), `드립소 화면 보정이 누락되었습니다: ${required}`);
}

for (const required of [
  '.site-switcher',
  '.site-switch-link.active',
  '.daily-one-line-input',
  'white-space: nowrap!important',
  '@media (max-width: 650px)'
]) {
  assert.ok(navigationCss.includes(required), `드립소 전환/한줄 스타일이 누락되었습니다: ${required}`);
}

for (const required of [
  "topicSnap.data()?.type === 'daily'",
  "if (isDaily && /[\\r\\n]/.test(rawText))",
  'const DAILY_MAX_LENGTH = 120',
  '오늘의 한줄은 줄바꿈 없이 한 줄로 입력해 주세요.',
  "enforceActionRateLimit(uid, 'dripso-comment'",
  'dripso_comment_authors',
  'module.exports = { dailyOneLineAddDripsoComment }'
]) {
  assert.ok(override.includes(required), `오늘의 한줄 서버 검증이 누락되었습니다: ${required}`);
}
assert.ok(!override.includes('exports.dailyOneLineAddDripsoComment ='), '내부 드립소 구현이 Firebase 배포 대상 함수로 노출되면 안 됩니다.');

const baseIndex = functionsMain.indexOf("require('./dripso')");
const overrideIndex = functionsMain.indexOf("require('./dripso-daily-one-line')");
assert.ok(baseIndex >= 0 && overrideIndex > baseIndex, '오늘의 한줄 서버 구현은 기존 드립소 함수 뒤에서 addDripsoComment를 교체해야 합니다.');

const deployedSourceExports = sourceExports();
assert.ok(deployedSourceExports.has('addDripsoComment'), '공개 addDripsoComment 함수는 배포 대상에 남아 있어야 합니다.');
assert.ok(!deployedSourceExports.has('dailyOneLineAddDripsoComment'), '내부 구현 이름이 배포 대상 함수로 오인되고 있습니다.');

for (const required of [
  "entry.id = 'dripso-home-entry'",
  "entry.className = 'dripso-home-entry'",
  "court.textContent = '⚖️ 판결소'",
  "dripso.textContent = 'ㅋ 드립소'",
  'const homeContent = hero.parentElement || page',
  'homeContent.append(entry)',
  'entry !== homeContent.lastElementChild'
]) {
  assert.ok(courtGuard.includes(required), `판결소 하단 사이트 전환이 누락되었습니다: ${required}`);
}
assert.ok(!courtGuard.includes('hero.prepend(entry)'), '드립소 바로가기가 메인 상단에 다시 배치되면 안 됩니다.');

for (const required of [
  '.dripso-home-entry',
  'width: min(calc(100% - 40px), 560px)',
  'grid-template-columns: repeat(2, minmax(0, 1fr))',
  '.dripso-home-entry-link.active'
]) {
  assert.ok(courtCss.includes(required), `판결소 하단 전환 스타일이 누락되었습니다: ${required}`);
}

assert.ok(courtIndex.includes('/css/dripso-entry.css?v=20260802-dripso-bottom-entry-1'), '판결소가 최신 하단 전환 CSS를 불러와야 합니다.');
assert.ok(courtIndex.includes('/js/dripso-entry-guard.js?v=20260802-dripso-bottom-entry-1'), '판결소가 최신 하단 전환 스크립트를 불러와야 합니다.');

console.log('Dripso experience validation passed: daily comments are one-line only, naming is branded as 미친작명소, the court switcher is full-width at the home bottom, and internal helpers are excluded from Firebase deployment.');
