import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const backend = read('functions/public-original.js');
const functionsMain = read('functions/main.js');
const workflow = read('.github/workflows/firebase-deploy.yml');
const resultPage = read('public/js/pages/result-comments.js');
const myCases = read('public/js/pages/my-cases.js');
const app = read('public/js/app.js');
const index = read('public/index.html');
const serviceWorker = read('public/sw.js');

for (const required of [
  "exports.getPublicCaseOriginal = onCall",
  'requireAppCheck(request)',
  "throw new HttpsError('unauthenticated'",
  "enforceActionRateLimit(requesterUid, 'public-original'",
  'const isOwner = Boolean(ownerUid && requesterUid === ownerUid)',
  'const isPublic = Boolean(resultSnap.exists && isSanitizedPublicResult(resultData))',
  'if (!isOwner && !isPublic)',
  'function safePublicDescription(resultData = {})',
  'const candidate = cleanText(resultData.publicCaseDescription, 600)',
  'const safety = inspectContent(candidate)',
  'PUBLIC_PRIVACY_NOTICE',
  'const original = cleanText(caseData.caseDescription, 600)',
  'caseDescription: original',
  'originalVisible: true',
  'caseDescription: safePublicDescription(resultData)',
  'originalVisible: false'
]) assert.ok(backend.includes(required), `접수 원문 서버 개인정보 경계 누락: ${required}`);

for (const required of [
  'function isSanitizedPublicResult(data = {})',
  'data.isPublic === true',
  'Number(data.publicDataVersion || 0) === 1',
  "!Object.prototype.hasOwnProperty.call(data, 'userId')",
  "!Object.prototype.hasOwnProperty.call(data, 'caseDescription')",
  "!Object.prototype.hasOwnProperty.call(data, 'nickname')"
]) assert.ok(backend.includes(required), `접수 원문 공개 데이터 검증 누락: ${required}`);

const ownerBranch = backend.split('if (isOwner) {')[1]?.split('\n  return {')[0] || '';
assert.ok(ownerBranch.includes('caseData.caseDescription'), '실제 접수 원문은 소유자 분기에서만 읽어야 합니다.');
const nonOwnerReturn = backend.split('if (isOwner) {')[1]?.split('  return {')[2] || '';
assert.ok(!nonOwnerReturn.includes('caseData.caseDescription'), '공개 이용자 응답에 실제 caseDescription을 사용하면 안 됩니다.');

assert.ok(functionsMain.includes("require('./public-original')"), '접수 원문 함수가 Functions 엔트리에서 export되어야 합니다.');
assert.ok(workflow.includes('functions:getPublicCaseOriginal'), 'Firebase 배포 대상에 접수 원문 함수가 포함되어야 합니다.');

for (const required of [
  'function addOriginalAccordion(container, caseId)',
  "judgeSummary.insertAdjacentElement('beforebegin', accordion)",
  'data-original-accordion-trigger="true"',
  '📄 접수 내용 펼쳐보기',
  "httpsCallable(functions, 'getPublicCaseOriginal')",
  'data.originalVisible',
  '작성자가 처음 접수한 원문입니다.',
  '공개용 사건 내용입니다. 작성자가 처음 입력한 원문은 공개하지 않습니다.',
  "body.textContent = data.caseDescription || '기록된 접수 내용이 없습니다.'"
]) assert.ok(resultPage.includes(required), `판결 공통 접수내용 펼침 기능 누락: ${required}`);

assert.ok(!resultPage.includes("if (!container.querySelector('#court-comment-input')) return;"), '접수내용 UI가 공개 방청석 여부에 종속되면 안 됩니다.');
assert.ok(myCases.includes("? `#/verdict/${encodeURIComponent(id)}`"), '내 사건 완료 항목의 판결 경로가 유지되어야 합니다.');
assert.ok(app.includes("hash.startsWith('#/verdict/')"), '소유자 판결 경로가 누락되었습니다.');
assert.ok(app.includes("hash.startsWith('#/result/')"), '공개 판결 경로가 누락되었습니다.');
assert.ok((app.match(/renderResult\(content, caseId\)/g) || []).length >= 2, '공개/소유자 판결은 같은 렌더러를 사용해야 합니다.');
assert.ok(app.includes("./pages/result-comments.js?v=20260830-final-audit-1"), '원문보기 결과 모듈이 최종 감사 버전이어야 합니다.');

for (const retired of [
  'original-inline-accordion-guard.js',
  'original-detail-header-guard.js'
]) {
  assert.ok(!fs.existsSync(`public/js/${retired}`), `중복 원문보기 가드가 저장소에 남아 있습니다: ${retired}`);
  assert.ok(!index.includes(retired), `index.html이 삭제된 원문보기 가드를 불러옵니다: ${retired}`);
  assert.ok(!serviceWorker.includes(retired), `서비스워커가 삭제된 원문보기 가드를 캐시합니다: ${retired}`);
}
assert.ok(serviceWorker.includes('/js/pages/result-comments.js?v=20260830-final-audit-1'), '서비스워커가 기준 원문보기 결과 모듈을 캐시해야 합니다.');

console.log('Original submission validation passed: actual submission text is owner-only, public viewers receive only safe public content, and duplicate DOM guards are removed.');
