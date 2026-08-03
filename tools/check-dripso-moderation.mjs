import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
for (const file of [
  'functions/dripso-moderation.js', 'public/dripso/moderation.js',
  'public/dripso/app-v4.js', 'public/admin/dripso-moderation.js'
]) assert.ok(fs.existsSync(file), `필수 파일 누락: ${file}`);

const server = read('functions/dripso-moderation.js');
const main = read('functions/main.js');
const adminActions = read('functions/admin-actions.js');
const adminUtils = read('functions/admin-utils.js');
const rules = read('firestore.rules');
const indexes = read('firestore.indexes.json');
const publicUi = read('public/dripso/moderation.js');
const app = read('public/dripso/app-v4.js');
const publicHtml = read('public/dripso/index.html');
const adminUi = read('public/admin/dripso-moderation.js');
const adminHtml = read('public/admin/index.html');
const deploy = read('.github/workflows/firebase-deploy.yml');
const hostingOnly = read('.github/workflows/hosting-only-deploy.yml');

for (const required of [
  'exports.getDripsoOwnership', 'exports.deleteOwnDripsoTopic', 'exports.deleteOwnDripsoComment',
  'exports.submitDripsoReport', 'exports.moderateDripsoReport',
  "status: 'deleting'", "status: 'hidden'", "collection('dripso_reports')",
  "collection('dripso_report_keys')", "require('firebase-admin/storage')",
  'deleteDripsoTopicData', 'deleteDripsoCommentData'
]) assert.ok(server.includes(required), `운영 서버 기능 누락: ${required}`);

assert.ok(main.includes("require('./dripso-moderation')"), '드립소 운영 모듈이 main에 연결되어야 합니다.');
assert.ok(adminActions.includes("status: 'deleting'") && adminActions.includes('isPublic: false'), '관리자 삭제 잠금이 필요합니다.');
assert.ok(adminActions.includes('requireVerifiedUser(request)'), '검증된 관리자 로그인이 필요합니다.');
assert.ok(adminUtils.includes('email_verified !== true'), '관리자 이메일 검증이 필요합니다.');

for (const required of [
  'match /dripso_reports/{reportId}', 'match /dripso_report_keys/{keyId}',
  'request.auth.token.email_verified == true',
  'match /dripso_battle_voters/{topicId}/users/{uid}/votes/{voteId}'
]) assert.ok(rules.includes(required), `운영 Firestore 규칙 누락: ${required}`);
for (const required of ['"collectionGroup": "dripso_topics"', '"collectionGroup": "dripso_reports"', '"fieldPath": "createdAt"']) {
  assert.ok(indexes.includes(required), `운영 인덱스 누락: ${required}`);
}

for (const required of [
  "httpsCallable(functions, 'getDripsoOwnership')",
  "httpsCallable(functions, 'deleteOwnDripsoTopic')",
  "httpsCallable(functions, 'deleteOwnDripsoComment')",
  "httpsCallable(functions, 'submitDripsoReport')",
  'data-dripso-action', "detail.classList.contains('official-topic')",
  "window.addEventListener('dripso:rendered'"
]) assert.ok(publicUi.includes(required), `공개 운영 UI 누락: ${required}`);

for (const required of [
  'async function fetchAllTopics', 'startAfter', "orderBy('createdAt', 'desc')",
  'async function loadLegacyComments', 'MAX_PAGES', 'card.dataset.commentId'
]) assert.ok(app.includes(required), `통합 앱 목록·댓글 운영 호환 누락: ${required}`);
for (const required of [
  '/dripso/app-v4.js?v=20260804-dripso-v4-audit-1',
  '/dripso/moderation.js?v=20260804-dripso-v4-audit-1'
]) assert.ok(publicHtml.includes(required), `공개 운영 자산 누락: ${required}`);

assert.ok(adminUi.includes("httpsCallable(functions, 'moderateDripsoReport')"));
assert.ok(adminUi.includes("collection(db, 'dripso_reports')"));
assert.ok(adminHtml.includes('/admin/dripso-moderation.js?v=20260801-audit-fixes-1'));

for (const name of [
  'functions:getDripsoOwnership', 'functions:deleteOwnDripsoTopic',
  'functions:deleteOwnDripsoComment', 'functions:submitDripsoReport', 'functions:moderateDripsoReport'
]) assert.ok(deploy.includes(name), `운영 배포 함수 누락: ${name}`);
assert.ok(deploy.includes('group: firebase-deploy-live'), '공유 배포 잠금이 필요합니다.');
assert.ok(!/\npush:\s*\n\s*branches:\s*\[main\]/.test(hostingOnly), 'hosting-only 자동 main 배포는 비활성 상태여야 합니다.');
assert.ok(hostingOnly.includes('group: firebase-deploy-live'), 'hosting-only도 공유 배포 잠금을 사용해야 합니다.');

console.log('Dripso moderation validation passed: ownership, deletion, reporting, official-topic protection, paginated lists, verified administration, and serialized deployment are connected.');
