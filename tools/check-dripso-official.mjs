import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { MODE_ORDER, OFFICIAL_BATTLES, BY_MODE } = require('../functions/dripso-official-pool.js');
const { officialSelection } = require('../functions/dripso-official.js');
const read = file => fs.readFileSync(file, 'utf8');

assert.equal(MODE_ORDER.length, 7, '공식 배틀 종목은 일곱 개여야 합니다.');
assert.equal(OFFICIAL_BATTLES.length, 1400, '공식 배틀 데이터는 1,400개여야 합니다.');
assert.equal(new Set(OFFICIAL_BATTLES.map(item => item.id)).size, 1400, '공식 배틀 ID는 중복되면 안 됩니다.');
assert.equal(new Set(OFFICIAL_BATTLES.map(item => `${item.mode}\u0000${item.prompt}`)).size, 1400, '공식 배틀 문제는 중복되면 안 됩니다.');

for (const mode of MODE_ORDER) {
  assert.equal(BY_MODE[mode].length, 200, `${mode} 공식 배틀은 200개여야 합니다.`);
}

const blocked = /(시발|씨발|병신|개새끼|죽어|자살|주민등록번호|실명 공개)/i;
for (const item of OFFICIAL_BATTLES) {
  assert.ok(MODE_ORDER.includes(item.mode), `지원하지 않는 종목: ${item.mode}`);
  assert.ok(item.title.length >= 2 && item.title.length <= 60, `제목 길이 오류: ${item.id}`);
  assert.ok(item.prompt.length >= 4 && item.prompt.length <= 260, `문제 길이 오류: ${item.id}`);
  assert.ok(!blocked.test(`${item.title}\n${item.prompt}`), `공개하기 어려운 표현 발견: ${item.id}`);
  assert.equal(item.official, true, `공식 표시 누락: ${item.id}`);
}

const selections = Array.from({ length: 14 }, (_, index) => officialSelection(new Date(Date.UTC(2026, 7, 1 + index, 3))));
assert.equal(new Set(selections.slice(0, 7).map(item => item.mode)).size, 7, '일주일 동안 일곱 종목이 순환해야 합니다.');
assert.equal(new Set(selections.map(item => item.item.id)).size, 14, '연속 게시 문제는 중복되면 안 됩니다.');

const html = read('public/dripso/index.html');
const css = read('public/dripso/battle.css');
const officialUi = read('public/dripso/official-ui.js');
const main = read('functions/main.js');
const officialServer = read('functions/dripso-official.js');
const deploy = read('.github/workflows/firebase-deploy.yml');
const sw = read('public/sw.js');

for (const required of [
  '/dripso/battle.css?v=20260804-official-layout-1',
  '/dripso/official-ui.js?v=20260804-official-layout-1'
]) assert.ok(html.includes(required), `드립소 공식 UI 자산 누락: ${required}`);

for (const required of [
  '.official-battle-badge',
  '.battle-page-heading{align-items:center',
  'flex-direction:column;align-items:stretch',
  '.battle-page-heading .write-button{width:auto'
]) assert.ok(css.includes(required), `모바일 배틀찾기 레이아웃 보호 누락: ${required}`);

for (const required of [
  "where('official', '==', true)",
  "badge.textContent = '👑 드립소 공식 배틀'",
  "card.classList.add('official-battle-card')",
  'decorateDetail()',
  "owner.textContent = '공식 운영'"
]) assert.ok(officialUi.includes(required), `공식 배틀 화면 표시 누락: ${required}`);

assert.ok(main.includes("exports.publishDailyOfficialDripsoBattle = dripsoOfficial.publishDailyOfficialDripsoBattle"), '공식 배틀 스케줄 함수가 main에 연결되어야 합니다.');
for (const required of [
  "schedule: '0 9 * * *'",
  "timeZone: TIME_ZONE",
  "official: true",
  "nickname: '드립소 공식'",
  "entryMinutes: ENTRY_MINUTES",
  "tournamentRound: 'prelim'"
]) assert.ok(officialServer.includes(required), `공식 배틀 서버 규칙 누락: ${required}`);

assert.ok(deploy.includes('functions:publishDailyOfficialDripsoBattle'), '공식 배틀 스케줄 함수가 배포 목록에 있어야 합니다.');
assert.ok(deploy.includes('node functions/ensure-official-dripso-battle-cli.js'), '배포 직후 공식 배틀 생성 단계가 필요합니다.');
assert.ok(sw.includes("'/dripso/official-ui.js?v=20260804-official-layout-1'"), '공식 배틀 UI가 오프라인 캐시에 있어야 합니다.');
assert.ok(sw.includes("'/dripso/battle.css?v=20260804-official-layout-1'"), '수정된 배틀 CSS가 오프라인 캐시에 있어야 합니다.');

console.log('Dripso official validation passed: 1,400 unique prompts, seven-mode rotation, daily publishing, immediate deployment seed, official badges, and compact mobile browse layout.');
