import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const backend = read('functions/public-original.js');
const functionsMain = read('functions/main.js');
const workflow = read('.github/workflows/firebase-deploy.yml');
const resultPage = read('public/js/pages/result-comments.js');
const myCases = read('public/js/pages/my-cases.js');
const app = read('public/js/app.js');
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
]) assert.ok(backend.includes(required), `접수 원문 서버 안전장치 누락: ${required}`);

for (const required of [
  "function isSanitizedPublicResult(data = {})",
  "data.isPublic === true",
  "Number(data.publicDataVersion || 0) === 1",
  "!Object.prototype.hasOwnProperty.call(data, 'userId')",
  "!Object.prototype.hasOwnProperty.call(data, 'caseDescription')",
  "!Object.prototype.hasOwnProperty.call(data, 'nickname')"
]) assert.ok(backend.includes(required), `접수 원문 공개 데이터 검증 누락: ${required}`);

assert.ok(functionsMain.includes("require('./public-original')"), '접수 원문 함수가 Functions 엔트리에서 export되어야 합니다.');
assert.ok(workflow.includes('functions:getPublicCaseOriginal'), 'Firebase 배포 대상에 접수 원문 함수가 포함되어야 합니다.');

for (const required of [
  "addOriginalAccordion(container, caseId)",
  "judgeSummary.insertAdjacentElement('beforebegin', accordion)",
  "data-original-accordion-trigger=\"true\"",
  "📄 접수 원문 펼쳐보기",
  "httpsCallable(functions, 'getPublicCaseOriginal')",
  "AI가 정리한 사건접수보고서가 아니라"
]) assert.ok(resultPage.includes(required), `판결 공통 원문 펼침 기능 누락: ${required}`);

assert.ok(!resultPage.includes("function addOriginalAccordion(container, caseId) {\n  // 공개 판결에서만 생성되는 방청석 입력창을 공개 상태 판별 기준으로 사용한다."), '원문 UI가 공개 판결 전용이면 안 됩니다.');
assert.ok(!resultPage.includes("function addOriginalAccordion(container, caseId) {\n  if (!container.querySelector('#court-comment-input')) return;"), '원문 UI가 방청석 입력창에 종속되면 안 됩니다.');
assert.ok(myCases.includes("? `#/verdict/${encodeURIComponent(id)}`"), '내 사건 완료 항목의 판결 경로가 유지되어야 합니다.');
assert.ok(app.includes("hash.startsWith('#/verdict/')"), '소유자 판결 경로가 누락되었습니다.');
assert.ok(app.includes("hash.startsWith('#/result/')"), '공개 판결 경로가 누락되었습니다.');
assert.ok((app.match(/renderResult\(content, caseId\)/g) || []).length >= 2, '공개/소유자 판결은 같은 렌더러를 사용해야 합니다.');
assert.ok(app.includes("./pages/result-comments.js?v=20260829-tags-1"), '원문보기 결과 모듈 캐시 버전이 갱신되어야 합니다.');

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
  "const host = document.body;",
  "normalize(document);",
  "window.addEventListener('hashchange', schedule)",
  "new MutationObserver(schedule)"
]) assert.ok(detailGuard.includes(required), `판결 상세 원문보기 보호 누락: ${required}`);

for (const required of [
  "const caseId = currentCaseId();",
  "if (!caseId) return;",
  "createAccordion(page, caseId)",
  "positionOriginalHeaderButton(page)",
  "toolbar.dataset.originalHeaderToolbar = 'true'",
  "trigger.dataset.originalHeaderPosition = 'top-right'",
  "accordion.classList.toggle('is-open', !panel.hidden)",
  "httpsCallable(functions, 'getPublicCaseOriginal')",
  "const host = document.body;",
  "normalizeOriginalUi(document);",
  "window.addEventListener('hashchange', schedule)",
  "attributeFilter: ['aria-expanded', 'hidden']"
]) assert.ok(cacheGuard.includes(required), `개인·공개 판결 공통 원문보기 보호 누락: ${required}`);
assert.ok(!cacheGuard.includes("const host = document.getElementById('page-content') || document.body;"), '원문보기 가드가 교체되는 옛 page-content에 묶이면 안 됩니다.');
assert.ok(!detailGuard.includes("const host = document.getElementById('page-content') || document.body;"), '상세 원문보기 가드가 교체되는 옛 page-content에 묶이면 안 됩니다.');
assert.ok(!cacheGuard.includes('const isPublicResult = Boolean('), '원문보기 보호가 공개 판결만 대상으로 제한되면 안 됩니다.');
assert.ok(!cacheGuard.includes('if (!isPublicResult) return;'), '비공개 개인 판결에서 원문보기 생성을 중단하면 안 됩니다.');

const publicGuardVersion = '20260810-owner-original-route-2';
const publicGuardAsset = `/js/original-inline-accordion-guard.js?v=${publicGuardVersion}`;
const detailGuardAsset = `/js/original-detail-header-guard.js?v=${publicGuardVersion}`;
assert.ok(index.includes(publicGuardAsset), 'index.html이 원문보기 보호 스크립트를 현재 버전으로 불러와야 합니다.');
assert.ok(serviceWorker.includes(`'${publicGuardAsset}'`), '서비스워커가 원문보기 보호 스크립트를 현재 버전으로 캐시해야 합니다.');
assert.ok(index.includes(detailGuardAsset), 'index.html이 판결 상세 원문 헤더 보호 스크립트를 현재 버전으로 불러와야 합니다.');
assert.ok(serviceWorker.includes(`'${detailGuardAsset}'`), '서비스워커가 판결 상세 원문 헤더 보호 스크립트를 현재 버전으로 캐시해야 합니다.');

console.log('Original submission validation passed: public records and owner verdicts keep the same original-view control across SPA route replacement with server authorization intact.');
