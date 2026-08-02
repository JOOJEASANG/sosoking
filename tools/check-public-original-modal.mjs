import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const backend = read('functions/public-original.js');
const functionsMain = read('functions/main.js');
const workflow = read('.github/workflows/firebase-deploy.yml');
const resultPage = read('public/js/pages/result-comments.js');
const cacheGuard = read('public/js/original-inline-accordion-guard.js');
const index = read('public/index.html');
const serviceWorker = read('public/sw.js');

for (const required of [
  "exports.getPublicCaseOriginal = onCall",
  "resultSnap.data().isPublic !== true",
  "const safety = inspectContent(caseDescription);",
  "개인정보 보호를 위해 이 접수 원문은 공개할 수 없습니다.",
  "caseDescription"
]) {
  assert.ok(backend.includes(required), `공개 접수 원문 함수 안전장치가 누락되었습니다: ${required}`);
}

assert.ok(functionsMain.includes("require('./public-original')"), '공개 접수 원문 함수가 Functions 엔트리에서 export되어야 합니다.');
assert.ok(workflow.includes('functions:getPublicCaseOriginal'), 'Firebase 배포 대상에 공개 접수 원문 함수가 포함되어야 합니다.');

for (const required of [
  "if (!container.querySelector('#court-comment-input')) return;",
  "addOriginalAccordion(container, caseId)",
  "judgeSummary.insertAdjacentElement('beforebegin', accordion)",
  "data-original-accordion-trigger=\"true\"",
  "aria-expanded=\"false\"",
  "📄 접수 원문 펼쳐보기",
  "📄 접수 원문 접기",
  "httpsCallable(functions, 'getPublicCaseOriginal')",
  "panel.hidden = !willOpen",
  "AI가 정리한 사건접수보고서가 아니라"
]) {
  assert.ok(resultPage.includes(required), `공개 판결 원문 펼침 기능이 누락되었습니다: ${required}`);
}

for (const retired of [
  "layer.setAttribute('role', 'dialog')",
  "layer.setAttribute('aria-modal', 'true')",
  "header.appendChild(trigger)",
  "body.result-original-open"
]) {
  assert.ok(!resultPage.includes(retired), `구형 모달 또는 직접 헤더 삽입 방식이 남아 있습니다: ${retired}`);
}

for (const required of [
  "page.querySelectorAll('.result-original-layer').forEach(layer => layer.remove())",
  "legacyTrigger?.remove()",
  "createAccordion(page, caseId)",
  "new MutationObserver(schedule)",
  "accordion.dataset.originalSource = 'cache-guard'",
  "positionOriginalHeaderButton(page)",
  "toolbar.dataset.originalHeaderToolbar = 'true'",
  "toolbar.appendChild(trigger)",
  "trigger.dataset.originalHeaderPosition = 'top-right'",
  "label.textContent = expanded ? '원문닫기' : '원문보기'",
  "accordion.classList.toggle('is-open', !panel.hidden)",
  "attributeFilter: ['aria-expanded', 'hidden']",
  '.result-cover-toolbar',
  '.result-original-panel-host:not(.is-open)'
]) {
  assert.ok(cacheGuard.includes(required), `원문보기 헤더 버튼 또는 캐시 정리 보호가 누락되었습니다: ${required}`);
}

const guardVersion = '20260802-original-header-button-1';
const guardAsset = `/js/original-inline-accordion-guard.js?v=${guardVersion}`;
assert.ok(index.includes(guardAsset), 'index.html이 원문보기 헤더 버튼 버전의 보호 스크립트를 불러와야 합니다.');
assert.ok(serviceWorker.includes(`'${guardAsset}'`), '서비스워커가 원문보기 헤더 버튼 스크립트를 현재 버전으로 캐시해야 합니다.');
assert.ok(serviceWorker.includes("const CACHE_NAME = 'sosoking-app-v20260802-original-header-button-1'"), '원문보기 배치 변경 시 서비스워커 캐시 이름이 갱신되어야 합니다.');

console.log('Public original submission validation passed: public-only server lookup, safety recheck, top-right header button, inline original panel, and stale-cache cleanup are connected.');
