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
for (const mode of MODE_ORDER) assert.equal(BY_MODE[mode].length, 200, `${mode} 공식 배틀은 200개여야 합니다.`);

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
const app = read('public/dripso/app-v4.js');
const css = read('public/dripso/app-v4.css');
const moderation = read('public/dripso/moderation.js');
const main = read('functions/main.js');
const server = read('functions/dripso-official.js');
const deploy = read('.github/workflows/firebase-deploy.yml');
const sw = read('public/sw.js');

for (const required of [
  '/dripso/app-v4.css?v=20260804-dripso-v4-audit-1',
  '/dripso/app-v4.js?v=20260804-dripso-v4-audit-1'
]) assert.ok(html.includes(required), `공식 배틀 통합 자산 누락: ${required}`);
assert.ok(!html.includes('<script type="module" src="/dripso/official-ui.js'), '공식 배틀 보정 오버레이가 다시 활성화되었습니다.');

for (const required of [
  '오늘의 공식 경기', 'official-spotlight-section', 'official-spotlight',
  "el('span', 'official-battle-badge', '👑 드립소 공식 배틀')",
  "topic.official ? '공식 운영'", "topic.official ? `👑 드립소 공식",
  'Number(b.official) - Number(a.official)'
]) assert.ok(app.includes(required), `통합 앱 공식 배틀 표시 누락: ${required}`);
for (const required of ['.official-spotlight', '.official-guide', '.official-spotlight .v4-topic-card', '.topic-label-row .official-battle-badge']) {
  assert.ok(css.includes(required), `공식 배틀 레이아웃 누락: ${required}`);
}
assert.ok(moderation.includes("detail.classList.contains('official-topic')"), '공식 주제가 일반 신고 버튼으로 처리되지 않도록 보호해야 합니다.');

assert.ok(main.includes('exports.publishDailyOfficialDripsoBattle = dripsoOfficial.publishDailyOfficialDripsoBattle'), '공식 배틀 스케줄 함수가 main에 연결되어야 합니다.');
for (const required of [
  "schedule: '0 9 * * *'", 'timeZone: TIME_ZONE', 'official: true',
  "nickname: '드립소 공식'", 'entryMinutes: ENTRY_MINUTES', "tournamentRound: 'prelim'"
]) assert.ok(server.includes(required), `공식 배틀 서버 규칙 누락: ${required}`);

assert.ok(deploy.includes('functions:publishDailyOfficialDripsoBattle'), '공식 배틀 스케줄 함수가 배포 목록에 있어야 합니다.');
assert.ok(deploy.includes('node functions/ensure-official-dripso-battle-cli.js'), '배포 직후 공식 배틀 생성 단계가 필요합니다.');
for (const asset of [
  "'/dripso/app-v4.js?v=20260804-dripso-v4-audit-1'",
  "'/dripso/app-v4.css?v=20260804-dripso-v4-audit-1'",
  "'/dripso/battle.css?v=20260804-official-layout-1'"
]) assert.ok(sw.includes(asset), `공식 배틀 오프라인 자산 누락: ${asset}`);

console.log('Dripso official validation passed: 1,400 unique prompts, seven-mode rotation, daily publishing, immediate seed, native official spotlight, protected moderation, and responsive layout are connected.');
