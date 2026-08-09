import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const backend = read('functions/public-original.js');
const functionsMain = read('functions/main.js');
const workflow = read('.github/workflows/firebase-deploy.yml');
const resultPage = read('public/js/pages/result-comments.js');
const cacheGuard = read('public/js/original-inline-accordion-guard.js');
const detailGuard = read('public/js/original-detail-header-guard.js');
const index = read('public/index.html');
const serviceWorker = read('public/sw.js');

for (const required of [
  "exports.getPublicCaseOriginal = onCall",
  "const isOwner = Boolean(requesterUid && ownerUid && requesterUid === ownerUid)",
  "const isPublic = Boolean(resultSnap.exists && isSanitizedPublicResult(resultData))",
  "if (!isOwner && !isPublic)",
  "if (!isOwner) {",
  "const safety = inspectContent(caseDescription);",
  "개인정보 보호를 위해 이 접수 원문은 공개할 수 없습니다.",
  "caseDescription"
]) {
  assert.ok(backend.includes(required), `접수 원문 함수의 소유자·공개 권한 안전장치가 누락되었습니다: ${required}`);
}

for (const required of [
  "function isSanitizedPublicResult(data = {})",
  "data.isPublic === true",
  "Number(data.publicDataVersion || 0) === 1",
  "!Object.prototype.hasOwnProperty.call(data, 'userId')",
  "!Object.prototype.hasOwnProperty.call(data, 'caseDescription')",
  "!Object.prototype.hasOwnProperty.call(data, 'nickname')"
]) {
  assert.ok(backend.includes(required), `접수 원문 공개 데이터 정제 검증이 누락되었습니다: ${required}`);
}

assert.ok(functionsMain.includes("require('./public-original')"), '접수 원문 함수가 Functions 엔트리에서 export되어야 합니다.');
assert.ok(workflow.includes('functions:getPublicCaseOriginal'), 'Firebase 배포 대상에 접수 원문 함수가 포함되어야 합니다.');

for (const required of [
  "if (!container.querySelector('#court-comment-input')) return;",
  "addOriginalAccordion(container, caseId)",
  "judgeSummary.insertAdjacentElement('beforebegin', accordion)",
  "data-original-accordion-trigger=\"true\"",
  "httpsCallable(functions, 'getPublicCaseOriginal')",
  "AI가 정리한 사건접수보고서가 아니라"
]) {
  assert.ok(resultPage.includes(required), `공개 판결 원문 펼침 기능이 누락되었습니다: ${required}`);
}

for (const required of [
  "createOriginalControl(cover, judgeSummary, caseId)",
  "accordion.dataset.originalSource = 'detail-header-guard'",
  "bindPrivateOrOwnerControl(accordion, caseId)",
  "httpsCallable(functions, 'getPublicCaseOriginal')",
  "toolbar.className = 'result-cover-toolbar'",
  "toolbar.appendChild(trigger)",
  "trigger.dataset.originalHeaderPosition = 'cover-top-right'",
  ".result-document-page .result-cover-toolbar",
  "position:absolute!important",
  "top:18px!important",
  "right:22px!important",
  "padding-top:70px!important",
  "new MutationObserver(schedule)"
]) {
  assert.ok(detailGuard.includes(required), `판결기록 상세 원문보기 버튼 보호가 누락되었습니다: ${required}`);
}

for (const required of [
  "const caseId = currentCaseId();",
  "if (!caseId) return;",
  "createAccordion(page, caseId)",
  "positionOriginalHeaderButton(page)",
  "toolbar.dataset.originalHeaderToolbar = 'true'",
  "trigger.dataset.originalHeaderPosition = 'top-right'",
  "accordion.classList.toggle('is-open', !panel.hidden)",
  "httpsCallable(functions, 'getPublicCaseOriginal')",
  "attributeFilter: ['aria-expanded', 'hidden']"
]) {
  assert.ok(cacheGuard.includes(required), `개인·공개 판결 공통 원문보기 보호가 누락되었습니다: ${required}`);
}
assert.ok(!cacheGuard.includes('const isPublicResult = Boolean('), '원문보기 보호 스크립트가 공개 판결만 대상으로 제한되면 안 됩니다.');
assert.ok(!cacheGuard.includes('if (!isPublicResult) return;'), '비공개 개인 판결에서 원문보기 생성을 중단하면 안 됩니다.');

const publicGuardVersion = '20260802-original-header-button-1';
const publicGuardAsset = `/js/original-inline-accordion-guard.js?v=${publicGuardVersion}`;
assert.ok(index.includes(publicGuardAsset), 'index.html이 판결 원문보기 보호 스크립트를 불러와야 합니다.');
assert.ok(serviceWorker.includes(`'${publicGuardAsset}'`), '서비스워커가 판결 원문보기 보호 스크립트를 현재 버전으로 캐시해야 합니다.');
assert.ok(index.includes('/js/original-detail-header-guard.js'), 'index.html이 판결기록 상세 원문 헤더 보호 스크립트를 불러와야 합니다.');

console.log('Original submission validation passed: public records require sanitized public data while owner-only private verdicts keep the same original-view control.');
