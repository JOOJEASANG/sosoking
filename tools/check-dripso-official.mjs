import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { MODE_ORDER, OFFICIAL_BATTLES, BY_MODE } = require('../functions/dripso-official-pool.js');
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

const html = read('public/dripso/index.html');
const app = read('public/dripso/app-v4.js');
const moderation = read('public/dripso/moderation.js');
const bundle = read('functions/dripso-bundle.js');
const main = read('functions/main.js');
const server = read('functions/dripso-official.js');
const deploy = read('.github/workflows/firebase-deploy.yml');
const obsolete = read('tools/list-obsolete-deployed-functions.mjs');
const adminIndex = read('public/admin/index.html');
const adminManual = read('public/admin/dripso-manual-official.js');
const reset = read('functions/reset-dripso-data-cli.js');

for (const required of [
  '/dripso/app-v4.css?v=20260804-dripso-v4-audit-1',
  '/dripso/app-v4.js?v=20260804-dripso-v4-audit-1'
]) assert.ok(html.includes(required), `드립소 통합 자산 누락: ${required}`);

for (const required of [
  'createDripsoTopic',
  'createDripsoBattle',
  'createDripsoTournamentBattle'
]) assert.ok(bundle.includes(required), `일반 회원 직접 등록 함수 누락: ${required}`);
assert.ok(app.includes('createDripsoBattle') || app.includes('createDripsoTournamentBattle'), '드립소 사용자 직접 배틀 등록 UI가 서버 함수와 연결되어야 합니다.');

assert.ok(main.includes('exports.createOfficialDripsoBattleNow = dripsoOfficial.createOfficialDripsoBattleNow'), '관리자 공식 주제 수동 생성 함수가 main에 연결되어야 합니다.');
assert.ok(!main.includes('publishDailyOfficialDripsoBattle'), '자동 공식 주제 스케줄 export가 남아 있습니다.');
assert.ok(!server.includes('onSchedule'), '공식 드립소 주제가 스케줄러로 자동 생성되면 안 됩니다.');
assert.ok(!server.includes("schedule: '0 9 * * *'"), '매일 9시 자동 생성 규칙이 남아 있습니다.');
for (const required of [
  'exports.createOfficialDripsoBattleNow = onCall',
  'requireVerifiedUser(request)',
  'isAdminAuth(request.auth)',
  "officialKind: 'admin-manual'",
  "const MANUAL_STATE_REF = 'dripso_official_state/manual'",
  'nextIndex: currentIndex + 1'
]) assert.ok(server.includes(required), `관리자 수동 공식 주제 규칙 누락: ${required}`);

assert.ok(adminIndex.includes('/admin/dripso-manual-official.js?v=20260810-dripso-manual-1'), '관리자 드립소 수동 생성 UI 모듈이 로드되어야 합니다.');
for (const required of [
  "httpsCallable(functions, 'createOfficialDripsoBattleNow')",
  '공식 주제 1개 생성',
  '드립소 직접 등록 화면',
  '일반 회원과 관리자 모두 드립소 화면에서 직접 주제·배틀을 등록'
]) assert.ok(adminManual.includes(required), `관리자 드립소 수동 UI 누락: ${required}`);

assert.ok(deploy.includes('functions:createOfficialDripsoBattleNow'), '관리자 수동 공식 주제 함수가 배포 목록에 있어야 합니다.');
assert.ok(!deploy.includes('functions:publishDailyOfficialDripsoBattle'), '자동 공식 주제 스케줄 함수가 배포 목록에 남아 있습니다.');
assert.ok(!deploy.includes('ensure-official-dripso-battle-cli.js'), '배포 직후 자동 공식 주제 생성 단계가 남아 있습니다.');
assert.ok(deploy.includes('node functions/reset-dripso-data-cli.js'), '기존 드립소 데이터 1회 초기화가 배포 흐름에 연결되어야 합니다.');
assert.ok(obsolete.includes("'publishDailyOfficialDripsoBattle'"), '운영에 남은 자동 스케줄 함수를 폐기 목록으로 정리해야 합니다.');

for (const required of [
  "const RESET_ID = 'dripso-full-reset-20260810-v1'",
  "const STORAGE_BUCKET = 'sosoking-481e6.firebasestorage.app'",
  'initializeApp({ storageBucket: STORAGE_BUCKET })',
  "collectionRef.id.startsWith('dripso_')",
  'await db.recursiveDelete(collectionRef)',
  'getStorage().bucket(STORAGE_BUCKET)',
  "await bucket.deleteFiles({ prefix: 'dripso/', force: true })",
  "await bucket.getFiles({ prefix: 'dripso/', maxResults: 1 })",
  'Dripso Firestore reset incomplete',
  'Dripso Storage reset incomplete',
  "status: 'completed'"
]) assert.ok(reset.includes(required), `드립소 전체 초기화 보호장치 누락: ${required}`);

assert.ok(moderation.includes("detail.classList.contains('official-topic')"), '공식 주제가 일반 신고 버튼으로 처리되지 않도록 보호해야 합니다.');

console.log('Dripso official validation passed: users and admins register manually, official pool creation is admin-only, scheduled publishing is removed, and the one-time full Dripso reset is deployment-wired with an explicit Storage bucket and post-delete verification.');
